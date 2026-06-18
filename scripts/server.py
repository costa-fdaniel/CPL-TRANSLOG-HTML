from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


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
        conn.execute(
            """
            INSERT INTO audit_events (event_type, ref_id, payload, created_at)
            VALUES (?, ?, ?, ?)
            """,
            ("state_saved", "system_state", json.dumps(payload.get("counts", {}), ensure_ascii=False), timestamp),
        )


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
        conn.execute(
            """
            INSERT INTO audit_events (event_type, ref_id, payload, created_at)
            VALUES (?, ?, ?, ?)
            """,
            ("export_batch", batch_id, json.dumps(payload, ensure_ascii=False), timestamp),
        )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            write_json(self, {"ok": True, "db": str(DB_PATH), "time": now_iso()})
            return
        if path == "/api/state":
            write_json(self, load_state())
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

    def route_write(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = read_json_body(self)
            if path == "/api/state":
                persist_state(payload)
                write_json(self, {"ok": True, "updatedAt": now_iso()})
                return
            if path == "/api/export-batches":
                persist_export_batch(payload)
                write_json(self, {"ok": True, "id": payload.get("id")})
                return
            if path == "/api/audit":
                with connect() as conn:
                    conn.execute(
                        """
                        INSERT INTO audit_events (event_type, ref_id, payload, created_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            payload.get("eventType") or "event",
                            payload.get("refId") or "",
                            json.dumps(payload, ensure_ascii=False),
                            now_iso(),
                        ),
                    )
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
