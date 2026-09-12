"""Bounded local history for threat records.

SQLite is deliberately used here because it is free and requires no service. On Render's
Free web plan the filesystem is ephemeral, so this module treats persistence as a best-
effort enhancement and never lets a database error take down the API.
"""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
import json
import logging
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class StorageResult:
    threats: list[dict[str, Any]]
    total: int
    status: str
    message: str | None = None
    counts: dict[str, int] | None = None


class ThreatStorage:
    """Small SQLite repository with a retention window and serialized writes."""

    def __init__(self, retention_days: int = 90, max_api_records: int = 250) -> None:
        self.retention_days = max(1, retention_days)
        self.max_api_records = max(1, max_api_records)
        default_path = "/tmp/vanguardintel.db" if os.getenv("VERCEL") else "data/vanguardintel.db"
        configured_path = os.getenv("DATABASE_PATH", "").strip()
        if configured_path in {"", ".", "./"}:
            configured_path = default_path
        self.path = Path(configured_path)
        self._lock = asyncio.Lock()
        self._initialized = False

    @property
    def metadata(self) -> dict[str, Any]:
        return {
            "engine": "sqlite",
            "retention_days": self.retention_days,
            "durability": "ephemeral serverless filesystem; use PostgreSQL for durable history",
            "database_path": str(self.path),
        }

    def _connect(self) -> sqlite3.Connection:
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(self.path), timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=10000")
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize_sync(self) -> None:
        with self._connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS threats (
                    record_key TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    date_added TEXT,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_threats_last_seen ON threats(last_seen DESC)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity)")
        self._initialized = True

    async def initialize(self) -> bool:
        if self._initialized:
            return True
        async with self._lock:
            if self._initialized:
                return True
            try:
                await asyncio.to_thread(self._initialize_sync)
                return True
            except (OSError, sqlite3.Error) as exc:
                LOGGER.warning("Threat history storage unavailable: %s", exc)
                return False

    def _persist_and_fetch_sync(self, threats: list[dict[str, Any]]) -> StorageResult:
        now = datetime.now(timezone.utc)
        seen_at = now.isoformat()
        cutoff = (now - timedelta(days=self.retention_days)).isoformat()
        with self._connection() as connection:
            for threat in threats:
                source = str(threat.get("source") or "Unknown source")
                external_id = str(threat.get("external_id") or threat.get("title") or "unknown")
                record_key = f"{source}:{external_id}"
                connection.execute(
                    """
                    INSERT INTO threats(record_key, source, severity, title, date_added, first_seen, last_seen, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(record_key) DO UPDATE SET
                      source=excluded.source,
                      severity=excluded.severity,
                      title=excluded.title,
                      date_added=excluded.date_added,
                      last_seen=excluded.last_seen,
                      payload_json=excluded.payload_json
                    """,
                    (
                        record_key,
                        source,
                        str(threat.get("severity") or "medium"),
                        str(threat.get("title") or external_id),
                        threat.get("date_added"),
                        seen_at,
                        seen_at,
                        json.dumps(threat, separators=(",", ":"), ensure_ascii=False),
                    ),
                )
            connection.execute("DELETE FROM threats WHERE last_seen < ?", (cutoff,))
            total = int(connection.execute("SELECT COUNT(*) FROM threats").fetchone()[0])
            count_rows = connection.execute("SELECT severity, COUNT(*) AS count FROM threats GROUP BY severity").fetchall()
            rows = connection.execute(
                "SELECT payload_json FROM threats ORDER BY last_seen DESC LIMIT ?", (self.max_api_records,)
            ).fetchall()
        records: list[dict[str, Any]] = []
        for row in rows:
            try:
                records.append(json.loads(row["payload_json"]))
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
        return StorageResult(records, total, "operational", counts={str(row["severity"]): int(row["count"]) for row in count_rows})

    async def persist_and_fetch(self, threats: list[dict[str, Any]]) -> StorageResult:
        """Upsert current observations, purge expired records, and return a bounded view."""
        if not await self.initialize():
            return StorageResult(threats[: self.max_api_records], len(threats), "degraded", "Local history storage is unavailable; serving the current snapshot.", counts=None)
        async with self._lock:
            try:
                return await asyncio.to_thread(self._persist_and_fetch_sync, threats)
            except (OSError, sqlite3.Error, TypeError, ValueError) as exc:
                LOGGER.warning("Threat history write/read failed: %s", exc)
                return StorageResult(threats[: self.max_api_records], len(threats), "degraded", "Local history storage failed; serving the current snapshot.", counts=None)
