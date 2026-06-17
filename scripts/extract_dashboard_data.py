from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from pyxlsb import open_workbook


OVERVIEW_SHEET = "Overview"
SUMMARY_SHEET = "Resumo 2025"

DEFAULT_MOVEMENT_COLUMNS = {
    "AL": (38, "transf_circ_principal"),
    "AM": (39, "juros_nc_resultado"),
    "AN": (40, "juros_nc_redutora"),
    "AO": (41, "ajuste_nc"),
    "AT": (46, "juros_c_resultado"),
    "AU": (47, "juros_c_redutora"),
    "AV": (48, "amortizacao_principal"),
    "AW": (49, "amortizacao_juros"),
    "AX": (50, "ajuste_c"),
    "BA": (53, "ajuste_pgto"),
    "BD": (56, "transf_contas_redutoras"),
    "BE": (57, "juros_nc_redutora_acum"),
    "BF": (58, "juros_c_redutora_acum"),
}

MOVEMENT_LABELS = {
    "transf_circ_principal": ("TRANSF. CIRCULANTE", "PRINCIPAL"),
    "juros_nc_resultado": ("JUROS NC X RESULTADO",),
    "juros_nc_redutora": ("JUROS NC X REDUTORA NC",),
    "ajuste_nc": ("AJUSTE NC",),
    "juros_c_resultado": ("JUROS C X RESULTADO",),
    "juros_c_redutora": ("JUROS C X REDUTORA C",),
    "amortizacao_principal": ("AMORTIZACAO (PRINCIPAL)",),
    "amortizacao_juros": ("AMORTIZACAO (JUROS)",),
    "ajuste_c": ("AJUSTE C",),
    "ajuste_pgto": ("AJUSTE NO PGTO",),
    "transf_contas_redutoras": ("TRANSFERENCIA ENTRE CONTAS REDUTORAS",),
    "juros_nc_redutora_acum": ("(-) JUROS N-CIRC CONTA REDUTORA",),
    "juros_c_redutora_acum": ("(-) JUROS CIRC CONTA REDUTORA",),
}

MARKER_LABELS = {
    "dc": ("D/C",),
}

TEXT_MARKER_COLUMNS = {53, 54, 55}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ").strip()
    return re.sub(r"\s+", " ", text)


def normalize_label(value: Any) -> str:
    text = unicodedata.normalize("NFD", clean_text(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.upper()


def is_blank(value: Any) -> bool:
    return value is None or clean_text(value) == ""


def as_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if math.isnan(float(value)) or math.isinf(float(value)):
            return None
        return float(value)
    text = clean_text(value)
    if not text or text == "-":
        return None
    text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def as_account(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        rounded = int(round(float(value)))
        if abs(float(value) - rounded) < 1e-7:
            return str(rounded)
    return clean_text(value)


def excel_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # Excel serial date system used by Windows workbooks.
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date().isoformat()
    text = clean_text(value)
    if not text:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return text


def normalize_sheet_id(name: str) -> int | None:
    match = re.fullmatch(r"(\d+)(?:\(X\))?", name)
    return int(match.group(1)) if match else None


def column_letter(col_number: int) -> str:
    result = ""
    while col_number:
        col_number, remainder = divmod(col_number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def find_schedule_header_row(rows: list[list[Any]]) -> int | None:
    for row_idx in range(13, min(18, len(rows))):
        row = rows[row_idx]
        for col_idx in range(20, min(37, len(row))):
            if clean_text(get(row, col_idx)) == "Juros / Resultado":
                return row_idx
    return None


def header_text_at(rows: list[list[Any]], header_row: int, col_idx: int) -> str:
    pieces = []
    for row_idx in range(max(0, header_row - 2), min(len(rows), header_row + 3)):
        text = normalize_label(get(rows[row_idx], col_idx))
        if text:
            pieces.append(text)
    return " ".join(pieces)


def detect_columns_by_label(
    rows: list[list[Any]],
    header_row: int | None,
    labels: dict[str, tuple[str, ...]],
) -> dict[str, int]:
    if header_row is None:
        return {}

    detected: dict[str, int] = {}
    max_width = max((len(row) for row in rows[: min(len(rows), header_row + 3)]), default=0)
    for key, tokens in labels.items():
        normalized_tokens = tuple(normalize_label(token) for token in tokens)
        for col_idx in range(20, min(max_width, 62)):
            text = header_text_at(rows, header_row, col_idx)
            if all(token in text for token in normalized_tokens):
                detected[key] = col_idx
                break
    return detected


def default_columns_by_key() -> dict[str, dict[str, Any]]:
    columns: dict[str, dict[str, Any]] = {}
    for letter, (col_number, key) in DEFAULT_MOVEMENT_COLUMNS.items():
        columns[key] = {
            "index": col_number - 1,
            "letter": letter,
            "defaultLetter": letter,
            "dynamic": False,
        }
    return columns


def detect_movement_columns(rows: list[list[Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    header_row = find_schedule_header_row(rows)
    columns = default_columns_by_key()
    detected = detect_columns_by_label(rows, header_row, MOVEMENT_LABELS)
    marker_columns = detect_columns_by_label(rows, header_row, MARKER_LABELS)
    layout_changes = []
    missing_labels = []

    for key, meta in columns.items():
        if key not in detected:
            missing_labels.append(key)
            continue
        detected_index = detected[key]
        detected_letter = column_letter(detected_index + 1)
        if detected_index != meta["index"]:
            layout_changes.append({
                "key": key,
                "default": meta["letter"],
                "detected": detected_letter,
            })
        meta["index"] = detected_index
        meta["letter"] = detected_letter
        meta["dynamic"] = detected_index != (DEFAULT_MOVEMENT_COLUMNS[meta["defaultLetter"]][0] - 1)

    markers = {
        key: {
            "index": col_idx,
            "letter": column_letter(col_idx + 1),
        }
        for key, col_idx in marker_columns.items()
    }
    return columns, {
        "headerRow": header_row + 1 if header_row is not None else None,
        "markers": markers,
        "layoutChanges": layout_changes,
        "missingLabels": missing_labels,
    }


def read_rows(workbook: Any, sheet_name: str) -> list[list[Any]]:
    rows: list[list[Any]] = []
    with workbook.get_sheet(sheet_name) as sheet:
        for row in sheet.rows():
            rows.append([cell.v for cell in row])
    return rows


def get(row: list[Any], index: int) -> Any:
    return row[index] if index < len(row) else None


def extract_overview(rows: list[list[Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    header = rows[3] if len(rows) >= 4 else []
    month_columns: list[dict[str, Any]] = []
    for idx, value in enumerate(header):
        date_value = excel_date(value)
        if date_value and re.match(r"^\d{4}-\d{2}-\d{2}$", date_value):
            label = datetime.fromisoformat(date_value).strftime("%m/%Y")
            month_columns.append({"index": idx, "date": date_value, "label": label})

    contracts: list[dict[str, Any]] = []
    for row in rows[4:]:
        contract_id = as_number(get(row, 1))
        if contract_id is None:
            continue
        comments = clean_text(get(row, 14))
        accounts = [as_account(get(row, idx)) for idx in (3, 4, 5, 6)]
        is_quitado = "quitado" in comments.lower() or any(a.lower() == "quitado" for a in accounts)
        entity_marker = clean_text(get(row, 0)).upper()
        entity = "TLOG" if entity_marker == "T" or (not entity_marker and contract_id >= 136) else "SAGA"
        monthly = []
        for col in month_columns:
            amount = as_number(get(row, col["index"]))
            if amount is not None and abs(amount) >= 0.005:
                monthly.append({"date": col["date"], "label": col["label"], "amount": amount})
        contract = {
            "id": int(contract_id),
            "contractNumber": as_account(get(row, 2)),
            "entity": entity,
            "entityMarker": entity_marker,
            "status": "quitado" if is_quitado else "ativo",
            "type": clean_text(get(row, 15)),
            "comments": comments,
            "accounts": {
                "circ": as_account(get(row, 3)),
                "jurosCirc": as_account(get(row, 4)),
                "naoCirc": as_account(get(row, 5)),
                "jurosNaoCirc": as_account(get(row, 6)),
            },
            "balances": {
                "initialDebt": as_number(get(row, 7)) or 0,
                "currentFinal": as_number(get(row, 8)) or 0,
                "nonCurrentFinal": as_number(get(row, 9)) or 0,
                "finalDebt": as_number(get(row, 10)) or 0,
                "interestCurrent": as_number(get(row, 11)) or 0,
                "interestNonCurrent": as_number(get(row, 12)) or 0,
                "interestTotal": as_number(get(row, 13)) or 0,
            },
            "monthlyPayments": monthly,
            "flags": [],
        }
        if contract["type"].lower() == "leasing":
            contract["flags"].append("leasing")
        if contract["id"] in {108, 109}:
            contract["flags"].append("substituido_recriado")
        if contract["entity"] == "TLOG":
            contract["flags"].append("tlog")
        contracts.append(contract)

    monthly_series: dict[str, dict[str, Any]] = {}
    for contract in contracts:
        if contract["status"] == "quitado":
            continue
        for item in contract["monthlyPayments"]:
            bucket = monthly_series.setdefault(item["date"], {"date": item["date"], "label": item["label"], "amount": 0.0})
            bucket["amount"] += item["amount"]

    totals = {
        "contracts": len(contracts),
        "activeContracts": sum(1 for c in contracts if c["status"] == "ativo"),
        "settledContracts": sum(1 for c in contracts if c["status"] == "quitado"),
        "initialDebt": sum(c["balances"]["initialDebt"] for c in contracts),
        "currentFinal": sum(c["balances"]["currentFinal"] for c in contracts),
        "nonCurrentFinal": sum(c["balances"]["nonCurrentFinal"] for c in contracts),
        "finalDebt": sum(c["balances"]["finalDebt"] for c in contracts),
        "interestCurrent": sum(c["balances"]["interestCurrent"] for c in contracts),
        "interestNonCurrent": sum(c["balances"]["interestNonCurrent"] for c in contracts),
        "interestTotal": sum(c["balances"]["interestTotal"] for c in contracts),
    }
    return contracts, list(monthly_series.values()), totals


def extract_contract_details(workbook: Any, sheet_name: str) -> dict[str, Any]:
    rows = read_rows(workbook, sheet_name)
    movement_columns, layout = detect_movement_columns(rows)
    details: dict[str, Any] = {
        "sheet": sheet_name,
        "sheetId": normalize_sheet_id(sheet_name),
        "replacedSheet": sheet_name.endswith("(X)"),
        "headerRow": layout["headerRow"],
        "movementColumns": {
            key: {
                "letter": meta["letter"],
                "defaultLetter": meta["defaultLetter"],
                "dynamic": meta["dynamic"],
            }
            for key, meta in movement_columns.items()
        },
        "markerColumns": {
            key: {"letter": meta["letter"]}
            for key, meta in layout["markers"].items()
        },
        "layoutChanges": layout["layoutChanges"],
        "missingLabels": layout["missingLabels"],
        "general": {},
        "movements": [],
        "warnings": [],
    }

    general_map = {
        "financiado": (2, 6),
        "contractNumber": (3, 6),
        "signingDate": (4, 6),
        "firstInstallmentDate": (5, 6),
        "lastInstallmentDate": (6, 6),
        "operationValue": (7, 6),
        "iof": (8, 6),
        "tac": (9, 6),
        "rateOrInstallments": (5, 14),
        "method": (9, 14),
    }
    for key, (row_idx, col_idx) in general_map.items():
        value = get(rows[row_idx], col_idx) if row_idx < len(rows) else None
        if "Date" in key:
            details["general"][key] = excel_date(value)
        elif key in {"operationValue", "iof", "tac", "rateOrInstallments"}:
            details["general"][key] = as_number(value) if as_number(value) is not None else clean_text(value)
        else:
            details["general"][key] = as_account(value) if key == "contractNumber" else clean_text(value)

    for row_number, row in enumerate(rows, start=1):
        parc = as_number(get(row, 1))
        date_value = excel_date(get(row, 2))
        if parc is None or not date_value:
            continue
        movement: dict[str, Any] = {
            "row": row_number,
            "parcel": int(parc) if abs(parc - round(parc)) < 1e-7 else parc,
            "date": date_value,
            "values": {},
        }
        for key, meta in movement_columns.items():
            value = as_number(get(row, meta["index"]))
            if value is not None and abs(value) >= 0.005:
                movement["values"][key] = value
        marker_indexes = set(TEXT_MARKER_COLUMNS)
        marker_indexes.update(meta["index"] + 1 for meta in layout["markers"].values())
        text_markers = {}
        for col_number in sorted(marker_indexes):
            text = clean_text(get(row, col_number - 1))
            if text and as_number(text) is None:
                text_markers[column_letter(col_number)] = text
        if text_markers:
            movement["textMarkers"] = text_markers
        if movement["values"]:
            details["movements"].append(movement)

    if details["replacedSheet"]:
        details["warnings"].append("Aba marcada como substituida no arquivo.")
    if details["layoutChanges"]:
        changed = ", ".join(
            f"{item['key']} {item['default']}->{item['detected']}"
            for item in details["layoutChanges"]
        )
        details["warnings"].append(f"Layout de colunas diferente do padrao: {changed}.")
    if not details["movements"]:
        details["warnings"].append("Nenhum movimento com valor relevante encontrado.")
    return details


def build_audit(contracts: list[dict[str, Any]], details: list[dict[str, Any]]) -> list[dict[str, Any]]:
    audit: list[dict[str, Any]] = []
    contract_by_id = {c["id"]: c for c in contracts}
    for contract in contracts:
        if contract["status"] == "quitado":
            audit.append({
                "severity": "info",
                "contractId": contract["id"],
                "message": "Contrato quitado: nao deve gerar novos lancamentos.",
            })
        if not contract["accounts"]["circ"] or not contract["accounts"]["naoCirc"]:
            audit.append({
                "severity": "warning",
                "contractId": contract["id"],
                "message": "Conta de principal ausente ou nao numerica.",
            })
        if contract["flags"]:
            audit.append({
                "severity": "info",
                "contractId": contract["id"],
                "message": "Marcadores: " + ", ".join(contract["flags"]),
            })

    for detail in details:
        sheet_id = detail["sheetId"]
        if detail["replacedSheet"]:
            audit.append({
                "severity": "warning",
                "contractId": sheet_id,
                "message": f"Aba {detail['sheet']} preservada como substituida.",
            })
            continue
        if sheet_id and sheet_id in contract_by_id:
            if detail.get("layoutChanges"):
                changes = ", ".join(
                    f"{item['key']} {item['default']}->{item['detected']}"
                    for item in detail["layoutChanges"]
                )
                audit.append({
                    "severity": "warning",
                    "contractId": sheet_id,
                    "message": f"Aba {detail['sheet']} usa layout diferente do padrao: {changes}.",
                })
            marker_count = sum(1 for m in detail["movements"] if m.get("textMarkers"))
            if marker_count:
                audit.append({
                    "severity": "warning",
                    "contractId": sheet_id,
                    "message": f"{marker_count} movimento(s) com marcadores textuais/D-C; conferir ajuste especial.",
                })
    return audit


def is_account_ready(account: str) -> bool:
    if not account:
        return False
    lowered = account.lower()
    if lowered in {"aaa", "quitado"}:
        return False
    return bool(re.fullmatch(r"\d+", account))


def result_account_for(contract: dict[str, Any]) -> str:
    contract_type = contract.get("type", "").lower()
    return "4773" if "leasing" in contract_type else "375"


def ledger_entry(
    entries: list[dict[str, Any]],
    contract: dict[str, Any],
    movement: dict[str, Any],
    rule: str,
    debit: str,
    credit: str,
    value: float,
    description: str,
    source_column: str,
) -> None:
    if value is None or abs(value) < 0.005:
        return
    amount = float(value)
    debit_account = debit
    credit_account = credit
    if amount < 0:
        debit_account, credit_account = credit_account, debit_account
        amount = abs(amount)

    issues = []
    if not is_account_ready(debit_account):
        issues.append(f"Debito pendente: {debit_account or 'vazio'}")
    if not is_account_ready(credit_account):
        issues.append(f"Credito pendente: {credit_account or 'vazio'}")
    if contract["status"] == "quitado":
        issues.append("Contrato quitado")

    entries.append({
        "id": f"{contract['id']}-{movement['row']}-{rule}-{len(entries) + 1}",
        "contractId": contract["id"],
        "contractNumber": contract["contractNumber"],
        "entity": contract["entity"],
        "contractType": contract["type"],
        "status": contract["status"],
        "parcel": movement["parcel"],
        "date": movement["date"],
        "year": int(movement["date"][:4]),
        "month": movement["date"][:7],
        "debit": debit_account,
        "credit": credit_account,
        "amount": amount,
        "historyCode": "",
        "description": f"{description} ref. contrato {contract['contractNumber']} aba ({contract['id']})",
        "rule": rule,
        "sourceColumn": source_column,
        "sourceRow": movement["row"],
        "reviewStatus": "revisar" if issues else "pronto",
        "issues": issues,
    })


def source_column_for(detail: dict[str, Any], key: str, fallback: str) -> str:
    return detail.get("movementColumns", {}).get(key, {}).get("letter", fallback)


def source_columns_for(detail: dict[str, Any], columns: list[tuple[str, str]]) -> str:
    result: list[str] = []
    for key, fallback in columns:
        letter = source_column_for(detail, key, fallback)
        if letter not in result:
            result.append(letter)
    return "/".join(result)


def is_relevant_amount(value: float | None) -> bool:
    return value is not None and abs(value) >= 0.005


def opposite_equal_amount(left: float, right: float) -> bool:
    return is_relevant_amount(left) and is_relevant_amount(right) and left * right < 0 and abs(abs(left) - abs(right)) < 0.005


def subtract_transfer_component(value: float, component: float) -> float:
    if not is_relevant_amount(value) or component <= 0:
        return value
    residual = abs(value) - component
    if residual < 0.005:
        return 0.0
    return math.copysign(residual, value)


def movement_has_marker(movement: dict[str, Any], *tokens: str) -> bool:
    marker_text = " ".join(movement.get("textMarkers", {}).values())
    if not marker_text:
        return False
    normalized_text = normalize_label(marker_text)
    return all(normalize_label(token) in normalized_text for token in tokens)


def build_ledger_entries(contracts: list[dict[str, Any]], details: list[dict[str, Any]]) -> list[dict[str, Any]]:
    contracts_by_id = {contract["id"]: contract for contract in contracts}
    entries: list[dict[str, Any]] = []

    for detail in details:
        if detail["replacedSheet"]:
            continue
        contract = contracts_by_id.get(detail["sheetId"])
        if not contract:
            continue

        accounts = contract["accounts"]
        conta_circ = accounts["circ"]
        juros_circ = accounts["jurosCirc"]
        conta_nc = accounts["naoCirc"]
        juros_nc = accounts["jurosNaoCirc"]
        result_account = result_account_for(contract)

        for movement in detail["movements"]:
            values = movement["values"]
            ajuste_nc = float(values.get("ajuste_nc", 0) or 0)
            ajuste_c = float(values.get("ajuste_c", 0) or 0)
            residual_ajuste_nc = ajuste_nc
            residual_ajuste_c = ajuste_c
            has_paired_adjustment = opposite_equal_amount(ajuste_nc, ajuste_c)
            has_interest_transfer_marker = movement_has_marker(movement, "TRANSF", "JUROS", "PASSIVO", "NC/C")
            has_liability_transfer_marker = (
                movement_has_marker(movement, "TRANSF", "PASSIVO", "NC/C")
                and not has_interest_transfer_marker
            )
            interest_transfer_value = float(values.get("transf_contas_redutoras", 0) or 0)

            if values.get("transf_circ_principal", 0) < 0:
                ledger_entry(entries, contract, movement, "R1", conta_nc, conta_circ, abs(values["transf_circ_principal"]),
                             "Transferencia de principal nao circulante para circulante",
                             source_column_for(detail, "transf_circ_principal", "AL"))

            if is_relevant_amount(values.get("juros_nc_resultado")):
                juros_nc_resultado = values["juros_nc_resultado"]
                if juros_nc_resultado > 0:
                    ledger_entry(entries, contract, movement, "R2", result_account, juros_nc, juros_nc_resultado,
                                 "Complemento de juros DRE no passivo nao circulante",
                                 source_column_for(detail, "juros_nc_resultado", "AM"))
                else:
                    ledger_entry(entries, contract, movement, "R2E", juros_nc, result_account, abs(juros_nc_resultado),
                                 "Estorno de juros DRE no passivo nao circulante",
                                 source_column_for(detail, "juros_nc_resultado", "AM"))

            if "juros_nc_redutora" in values:
                ledger_entry(entries, contract, movement, "R3", juros_nc, conta_nc, values["juros_nc_redutora"],
                             "Provisionamento de juros N-CIRC",
                             source_column_for(detail, "juros_nc_redutora", "AN"))

            if is_relevant_amount(interest_transfer_value):
                ledger_entry(entries, contract, movement, "R12", juros_nc, juros_circ, abs(interest_transfer_value),
                             "Transferencia de juros do passivo nao circulante para circulante",
                             source_column_for(detail, "transf_contas_redutoras", "BD"))
                if is_relevant_amount(ajuste_nc) and is_relevant_amount(ajuste_c) and ajuste_nc * ajuste_c < 0:
                    transfer_component = min(abs(ajuste_nc), abs(ajuste_c), abs(interest_transfer_value))
                    residual_ajuste_nc = subtract_transfer_component(ajuste_nc, transfer_component)
                    residual_ajuste_c = subtract_transfer_component(ajuste_c, transfer_component)
            elif has_interest_transfer_marker and has_paired_adjustment:
                ledger_entry(entries, contract, movement, "R12", juros_nc, juros_circ, abs(ajuste_nc),
                             "Transferencia de juros do passivo nao circulante para circulante",
                             source_columns_for(detail, [("ajuste_nc", "AO"), ("ajuste_c", "AX")]))
                residual_ajuste_nc = 0.0
                residual_ajuste_c = 0.0
            elif (has_liability_transfer_marker or has_paired_adjustment) and has_paired_adjustment:
                ledger_entry(entries, contract, movement, "R4T", conta_nc, conta_circ, abs(ajuste_nc),
                             "Transferencia de passivo nao circulante para circulante",
                             source_columns_for(detail, [("ajuste_nc", "AO"), ("ajuste_c", "AX")]))
                residual_ajuste_nc = 0.0
                residual_ajuste_c = 0.0

            if is_relevant_amount(residual_ajuste_nc):
                ledger_entry(entries, contract, movement, "R4", "AAA", conta_nc, residual_ajuste_nc,
                             "Ajuste residual do passivo nao circulante",
                             source_column_for(detail, "ajuste_nc", "AO"))

            if is_relevant_amount(values.get("juros_c_resultado")):
                juros_c_resultado = values["juros_c_resultado"]
                if juros_c_resultado > 0:
                    ledger_entry(entries, contract, movement, "R5", result_account, juros_circ, juros_c_resultado,
                                 "Complemento de juros DRE no passivo circulante",
                                 source_column_for(detail, "juros_c_resultado", "AT"))
                else:
                    ledger_entry(entries, contract, movement, "R5E", juros_circ, result_account, abs(juros_c_resultado),
                                 "Estorno de juros DRE no passivo circulante",
                                 source_column_for(detail, "juros_c_resultado", "AT"))

            if "juros_c_redutora" in values:
                ledger_entry(entries, contract, movement, "R6", juros_circ, conta_circ, values["juros_c_redutora"],
                             "Provisionamento de juros CIRC",
                             source_column_for(detail, "juros_c_redutora", "AU"))

            if values.get("amortizacao_principal", 0) < 0:
                ledger_entry(entries, contract, movement, "R7A", conta_circ, "000", abs(values["amortizacao_principal"]),
                             "Amortizacao de principal",
                             source_column_for(detail, "amortizacao_principal", "AV"))

            if values.get("amortizacao_juros", 0) < 0:
                ledger_entry(entries, contract, movement, "R7B", conta_circ, "000", abs(values["amortizacao_juros"]),
                             "Amortizacao de juros",
                             source_column_for(detail, "amortizacao_juros", "AW"))

            if is_relevant_amount(residual_ajuste_c):
                ledger_entry(entries, contract, movement, "R8", "AAA", conta_circ, residual_ajuste_c,
                             "Ajuste residual do passivo circulante",
                             source_column_for(detail, "ajuste_c", "AX"))

            if "ajuste_pgto" in values:
                value = values["ajuste_pgto"]
                if value > 0:
                    ledger_entry(entries, contract, movement, "R9A", conta_circ, result_account, value,
                                 "Reconhecimento de juros extras",
                                 source_column_for(detail, "ajuste_pgto", "BA"))
                    ledger_entry(entries, contract, movement, "R9B", "000", conta_circ, value,
                                 "Amortizacao de juros extras",
                                 source_column_for(detail, "ajuste_pgto", "BA"))
                else:
                    ledger_entry(entries, contract, movement, "R9C", result_account, conta_circ, abs(value),
                                 "Desconto de juros",
                                 source_column_for(detail, "ajuste_pgto", "BA"))

            if values.get("juros_nc_redutora_acum", 0) > 0:
                ledger_entry(entries, contract, movement, "R10", result_account, juros_nc, values["juros_nc_redutora_acum"],
                             "Impacto de juros N-CIRC",
                             source_column_for(detail, "juros_nc_redutora_acum", "BE"))

            if values.get("juros_c_redutora_acum", 0) > 0:
                ledger_entry(entries, contract, movement, "R11", result_account, juros_circ, values["juros_c_redutora_acum"],
                             "Impacto de juros CIRC",
                             source_column_for(detail, "juros_c_redutora_acum", "BF"))

    return entries


def summarize_ledger(entries: list[dict[str, Any]]) -> dict[str, Any]:
    by_year: dict[str, float] = {}
    by_rule: dict[str, float] = {}
    for entry in entries:
        by_year[str(entry["year"])] = by_year.get(str(entry["year"]), 0.0) + entry["amount"]
        by_rule[entry["rule"]] = by_rule.get(entry["rule"], 0.0) + entry["amount"]
    return {
        "entries": len(entries),
        "readyEntries": sum(1 for entry in entries if entry["reviewStatus"] == "pronto"),
        "reviewEntries": sum(1 for entry in entries if entry["reviewStatus"] == "revisar"),
        "amount": sum(entry["amount"] for entry in entries),
        "byYear": by_year,
        "byRule": by_rule,
    }


def extract(input_path: Path) -> dict[str, Any]:
    workbook = open_workbook(str(input_path))
    overview_rows = read_rows(workbook, OVERVIEW_SHEET)
    contracts, monthly_series, totals = extract_overview(overview_rows)

    detail_sheets = [
        sheet for sheet in workbook.sheets
        if normalize_sheet_id(sheet) is not None
    ]
    details = [extract_contract_details(workbook, sheet) for sheet in detail_sheets]
    ledger_entries = build_ledger_entries(contracts, details)

    payload = {
        "metadata": {
            "sourceFile": input_path.name,
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "overviewSheet": OVERVIEW_SHEET,
            "summarySheet": SUMMARY_SHEET,
            "sheetCount": len(workbook.sheets),
            "contractSheetCount": len(detail_sheets),
        },
        "totals": totals,
        "contracts": contracts,
        "monthlySeries": sorted(monthly_series, key=lambda x: x["date"]),
        "contractDetails": details,
        "ledgerEntries": ledger_entries,
        "ledgerSummary": summarize_ledger(ledger_entries),
        "audit": build_audit(contracts, details),
        "rules": [
            {"column": "AL", "name": "Transferencia de principal N-CIRC para CIRC"},
            {"column": "AM", "name": "Complemento/estorno de juros DRE N-CIRC"},
            {"column": "AN", "name": "Juros NC x Redutora NC"},
            {"column": "AO/AX", "name": "Transf. Passivo NC/C quando valores sao opostos e iguais"},
            {"column": "AO", "name": "Ajuste residual NC"},
            {"column": "AT", "name": "Complemento/estorno de juros DRE CIRC"},
            {"column": "AU", "name": "Juros C x Redutora C"},
            {"column": "AV/AW", "name": "Amortizacao principal e juros"},
            {"column": "AX", "name": "Ajuste residual C"},
            {"column": "BA", "name": "Ajuste no pagamento"},
            {"column": "BB/BC", "name": "Marcadores textuais e D/C para revisao"},
            {"column": "BD", "name": "Transf. Juros Passivo NC/C"},
            {"column": "BE/BF", "name": "Reducao de juros redutores"},
        ],
    }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai dados do CPL TRANSLOG para o dashboard HTML.")
    parser.add_argument("input", type=Path, help="Arquivo .xlsb fonte.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("data/processed/dashboard.json"),
        help="Arquivo JSON de saida.",
    )
    args = parser.parse_args()

    payload = extract(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Dashboard JSON criado: {args.output}")
    print(f"Contratos: {payload['totals']['contracts']} | Ativos: {payload['totals']['activeContracts']}")


if __name__ == "__main__":
    main()
