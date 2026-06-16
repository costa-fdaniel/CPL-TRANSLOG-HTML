from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from pyxlsb import open_workbook


OVERVIEW_SHEET = "Overview"
SUMMARY_SHEET = "Resumo 2025"

KNOWN_MOVEMENT_COLUMNS = {
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
    "BB": (54, "regra_ajuste_nc"),
    "BC": (55, "regra_ajuste_c"),
    "BD": (56, "transf_contas_redutoras"),
    "BE": (57, "juros_nc_redutora_acum"),
    "BF": (58, "juros_c_redutora_acum"),
}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ").strip()
    return re.sub(r"\s+", " ", text)


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
        entity = "TLOG" if contract_id >= 136 else "SAGA"
        monthly = []
        for col in month_columns:
            amount = as_number(get(row, col["index"]))
            if amount is not None and abs(amount) >= 0.005:
                monthly.append({"date": col["date"], "label": col["label"], "amount": amount})
        contract = {
            "id": int(contract_id),
            "contractNumber": as_account(get(row, 2)),
            "entity": entity,
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
    details: dict[str, Any] = {
        "sheet": sheet_name,
        "sheetId": normalize_sheet_id(sheet_name),
        "replacedSheet": sheet_name.endswith("(X)"),
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
        for letter, (col_number, key) in KNOWN_MOVEMENT_COLUMNS.items():
            value = as_number(get(row, col_number - 1))
            if value is not None and abs(value) >= 0.005:
                movement["values"][key] = value
        if movement["values"]:
            details["movements"].append(movement)

    if details["replacedSheet"]:
        details["warnings"].append("Aba marcada como substituida no arquivo.")
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
        if sheet_id and sheet_id in contract_by_id:
            has_adjustment_rule = any(
                "regra_ajuste_nc" in m["values"] or "regra_ajuste_c" in m["values"]
                for m in detail["movements"]
            )
            if has_adjustment_rule:
                audit.append({
                    "severity": "warning",
                    "contractId": sheet_id,
                    "message": "Movimentos com regras BB/BC identificados; conferir ajuste NC/C.",
                })
    return audit


def extract(input_path: Path) -> dict[str, Any]:
    workbook = open_workbook(str(input_path))
    overview_rows = read_rows(workbook, OVERVIEW_SHEET)
    contracts, monthly_series, totals = extract_overview(overview_rows)

    detail_sheets = [
        sheet for sheet in workbook.sheets
        if normalize_sheet_id(sheet) is not None
    ]
    details = [extract_contract_details(workbook, sheet) for sheet in detail_sheets]

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
        "audit": build_audit(contracts, details),
        "rules": [
            {"column": "AL", "name": "Transferencia de principal circulante"},
            {"column": "AM", "name": "Juros NC x Resultado"},
            {"column": "AN", "name": "Juros NC x Redutora NC"},
            {"column": "AO", "name": "Ajuste NC"},
            {"column": "AT", "name": "Juros C x Resultado"},
            {"column": "AU", "name": "Juros C x Redutora C"},
            {"column": "AV/AW", "name": "Amortizacao principal e juros"},
            {"column": "AX", "name": "Ajuste C"},
            {"column": "BA", "name": "Ajuste no pagamento"},
            {"column": "BB/BC", "name": "Regra especial de ajuste NC/C"},
            {"column": "BD", "name": "Transferencia entre redutoras"},
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

