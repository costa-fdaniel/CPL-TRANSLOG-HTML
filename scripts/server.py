from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "system" / "translog.sqlite3"


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS system_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ledger_entries (
                id TEXT PRIMARY KEY,
                contract_id INTEGER,
                operation_id TEXT,
                operation_status TEXT,
                review_status TEXT,
                export_batch_id TEXT,
                amount REAL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contract_overrides (
                contract_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS export_batches (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                ref_id TEXT,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if not length:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw) if raw.strip() else {}


def write_json(handler: SimpleHTTPRequestHandler, payload: Any, status: int = 200) -> None:
    data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def audit_event(conn: sqlite3.Connection, event_type: str, ref_id: str, payload: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO audit_events (event_type, ref_id, payload, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (event_type, ref_id, json.dumps(payload, ensure_ascii=False), now_iso()),
    )


def ledger_payload(entry: dict[str, Any]) -> tuple[str, int | None, str, str, str, str, float, str, str]:
    entry_id = str(entry.get("id") or f"entry-{now_iso()}")
    contract_id = entry.get("contractId")
    return (
        entry_id,
        int(contract_id) if isinstance(contract_id, int) or str(contract_id).isdigit() else None,
        str(entry.get("operationId") or ""),
        str(entry.get("operationStatus") or ""),
        str(entry.get("reviewStatus") or ""),
        str(entry.get("exportBatchId") or ""),
        float(entry.get("amount") or 0),
        json.dumps({**entry, "id": entry_id}, ensure_ascii=False),
        now_iso(),
    )


def upsert_ledger_entry(payload: dict[str, Any]) -> dict[str, Any]:
    row = ledger_payload(payload)
    entry_id = row[0]
    entry = json.loads(row[7])
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO ledger_entries (
                id, contract_id, operation_id, operation_status, review_status,
                export_batch_id, amount, payload, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                contract_id = excluded.contract_id,
                operation_id = excluded.operation_id,
                operation_status = excluded.operation_status,
                review_status = excluded.review_status,
                export_batch_id = excluded.export_batch_id,
                amount = excluded.amount,
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            row,
        )
        audit_event(conn, "ledger_upsert", entry_id, {"entryId": entry_id, "contractId": entry.get("contractId")})
    return entry


def list_ledger_entries() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT payload FROM ledger_entries ORDER BY updated_at DESC, id DESC").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def read_ledger_entry(entry_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT payload FROM ledger_entries WHERE id = ?", (entry_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


def delete_ledger_entry(entry_id: str) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM ledger_entries WHERE id = ?", (entry_id,))
        deleted = cursor.rowcount > 0
        audit_event(conn, "ledger_delete", entry_id, {"entryId": entry_id, "deleted": deleted})
    return deleted


def upsert_contract_override(contract_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO contract_overrides (contract_id, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(contract_id) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (contract_id, json.dumps(payload, ensure_ascii=False), now_iso()),
        )
        audit_event(conn, "contract_override_upsert", contract_id, {"contractId": contract_id})
    return payload


def list_contract_overrides() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute("SELECT contract_id, payload FROM contract_overrides ORDER BY updated_at DESC").fetchall()
    return {str(row["contract_id"]): json.loads(row["payload"]) for row in rows}


def read_contract_override(contract_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT payload FROM contract_overrides WHERE contract_id = ?", (contract_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


def delete_contract_override(contract_id: str) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM contract_overrides WHERE contract_id = ?", (contract_id,))
        deleted = cursor.rowcount > 0
        audit_event(conn, "contract_override_delete", contract_id, {"contractId": contract_id, "deleted": deleted})
    return deleted


def persist_state(payload: dict[str, Any]) -> None:
    timestamp = now_iso()
    entries = payload.get("entries") if isinstance(payload.get("entries"), list) else []
    overrides = payload.get("contractOverrides") if isinstance(payload.get("contractOverrides"), dict) else {}

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO system_state (id, payload, updated_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (json.dumps(payload, ensure_ascii=False), timestamp),
        )
        conn.execute("DELETE FROM ledger_entries")
        conn.executemany(
            """
            INSERT INTO ledger_entries (
                id, contract_id, operation_id, operation_status, review_status,
                export_batch_id, amount, payload, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    str(entry.get("id") or f"entry-{index}"),
                    entry.get("contractId"),
                    entry.get("operationId") or "",
                    entry.get("operationStatus") or "",
                    entry.get("reviewStatus") or "",
                    entry.get("exportBatchId") or "",
                    float(entry.get("amount") or 0),
                    json.dumps(entry, ensure_ascii=False),
                    timestamp,
                )
                for index, entry in enumerate(entries)
                if isinstance(entry, dict)
            ],
        )
        conn.execute("DELETE FROM contract_overrides")
        conn.executemany(
            """
            INSERT INTO contract_overrides (contract_id, payload, updated_at)
            VALUES (?, ?, ?)
            """,
            [
                (str(contract_id), json.dumps(override, ensure_ascii=False), timestamp)
                for contract_id, override in overrides.items()
            ],
        )
        audit_payload = payload.get("counts", {}) if isinstance(payload.get("counts"), dict) else {}
        if payload.get("operator"):
            audit_payload = {**audit_payload, "operator": payload.get("operator")}
        audit_event(conn, "state_saved", "system_state", audit_payload)


def load_state() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT payload, updated_at FROM system_state WHERE id = 1").fetchone()
    if not row:
        return {"found": False, "payload": None}
    return {"found": True, "updatedAt": row["updated_at"], "payload": json.loads(row["payload"])}


def persist_export_batch(payload: dict[str, Any]) -> None:
    batch_id = str(payload.get("id") or f"exp-{now_iso()}")
    timestamp = now_iso()
    entry_ids = [str(entry_id) for entry_id in payload.get("entryIds", [])]
    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO export_batches (id, payload, created_at)
            VALUES (?, ?, ?)
            """,
            (batch_id, json.dumps(payload, ensure_ascii=False), timestamp),
        )
        if entry_ids:
            conn.execute(
                """
                UPDATE ledger_entries
                SET operation_status = 'exportado',
                    export_batch_id = ?,
                    updated_at = ?
                WHERE id IN ({})
                """.format(",".join("?" for _ in entry_ids)),
                (batch_id, timestamp, *entry_ids),
            )
        audit_event(conn, "export_batch", batch_id, payload)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        parts = [unquote(part) for part in path.strip("/").split("/") if part]
        if path == "/api/health":
            write_json(self, {"ok": True, "db": str(DB_PATH), "time": now_iso()})
            return
        if path == "/api/state":
            write_json(self, load_state())
            return
        if parts == ["api", "ledger-entries"]:
            write_json(self, {"items": list_ledger_entries()})
            return
        if len(parts) == 3 and parts[:2] == ["api", "ledger-entries"]:
            entry = read_ledger_entry(parts[2])
            write_json(self, {"found": bool(entry), "item": entry}, 200 if entry else 404)
            return
        if parts == ["api", "contract-overrides"]:
            write_json(self, {"items": list_contract_overrides()})
            return
        if len(parts) == 3 and parts[:2] == ["api", "contract-overrides"]:
            override = read_contract_override(parts[2])
            write_json(self, {"found": bool(override), "item": override}, 200 if override else 404)
            return
        if path == "/api/audit":
            with connect() as conn:
                rows = conn.execute(
                    "SELECT event_type, ref_id, payload, created_at FROM audit_events ORDER BY id DESC LIMIT 200"
                ).fetchall()
            write_json(self, [
                {
                    "eventType": row["event_type"],
                    "refId": row["ref_id"],
                    "payload": json.loads(row["payload"]),
                    "createdAt": row["created_at"],
                }
                for row in rows
            ])
            return
        super().do_GET()

    def do_POST(self) -> None:
        self.route_write()

    def do_PUT(self) -> None:
        self.route_write()

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        parts = [unquote(part) for part in path.strip("/").split("/") if part]
        try:
            if len(parts) == 3 and parts[:2] == ["api", "ledger-entries"]:
                deleted = delete_ledger_entry(parts[2])
                write_json(self, {"ok": deleted, "id": parts[2]}, 200 if deleted else 404)
                return
            if len(parts) == 3 and parts[:2] == ["api", "contract-overrides"]:
                deleted = delete_contract_override(parts[2])
                write_json(self, {"ok": deleted, "id": parts[2]}, 200 if deleted else 404)
                return
            write_json(self, {"ok": False, "error": "Endpoint nao encontrado."}, 404)
        except Exception as exc:  # noqa: BLE001 - API should return JSON errors.
            write_json(self, {"ok": False, "error": str(exc)}, 500)

    def route_write(self) -> None:
        path = urlparse(self.path).path
        parts = [unquote(part) for part in path.strip("/").split("/") if part]
        try:
            payload = read_json_body(self)
            if path == "/api/state":
                persist_state(payload)
                write_json(self, {"ok": True, "updatedAt": now_iso()})
                return
            if parts == ["api", "ledger-entries"]:
                if not isinstance(payload.get("items"), list):
                    write_json(self, {"ok": False, "error": "Informe items como lista."}, 400)
                    return
                items = [upsert_ledger_entry(item) for item in payload["items"] if isinstance(item, dict)]
                write_json(self, {"ok": True, "items": items, "count": len(items)})
                return
            if len(parts) == 3 and parts[:2] == ["api", "ledger-entries"]:
                item = upsert_ledger_entry({**payload, "id": parts[2]})
                write_json(self, {"ok": True, "item": item})
                return
            if parts == ["api", "contract-overrides"]:
                if not isinstance(payload.get("items"), dict):
                    write_json(self, {"ok": False, "error": "Informe items como objeto por contrato."}, 400)
                    return
                items = {
                    str(contract_id): upsert_contract_override(str(contract_id), override)
                    for contract_id, override in payload["items"].items()
                    if isinstance(override, dict)
                }
                write_json(self, {"ok": True, "items": items, "count": len(items)})
                return
            if len(parts) == 3 and parts[:2] == ["api", "contract-overrides"]:
                item = upsert_contract_override(parts[2], payload)
                write_json(self, {"ok": True, "item": item})
                return
            if path == "/api/export-batches":
                persist_export_batch(payload)
                write_json(self, {"ok": True, "id": payload.get("id")})
                return
            if path == "/api/audit":
                with connect() as conn:
                    audit_event(conn, payload.get("eventType") or "event", payload.get("refId") or "", payload)
                write_json(self, {"ok": True})
                return
            write_json(self, {"ok": False, "error": "Endpoint nao encontrado."}, 404)
        except Exception as exc:  # noqa: BLE001 - API should return JSON errors.
            write_json(self, {"ok": False, "error": str(exc)}, 500)


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local CPL TRANSLOG HTML com SQLite.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    init_db()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"CPL TRANSLOG HTML: http://{args.host}:{args.port}")
    print(f"Banco SQLite: {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
