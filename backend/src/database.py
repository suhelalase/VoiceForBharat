"""
Persistent memory database for the VoiceForBharat agent.

Stores caller profiles in a local SQLite database so the agent can
greet returning callers by name and recall facts from prior sessions.

Schema
------
users
  user_id          TEXT PRIMARY KEY   — LiveKit participant identity
  name             TEXT               — caller's name
  language_pref    TEXT               — preferred language / locale
  facts            TEXT               — JSON blob of arbitrary key→value facts
  last_interaction TEXT               — ISO-8601 timestamp of last session
"""

import json
import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("agent.database")

# The DB file sits next to this module so it survives restarts.
_DB_PATH = Path(__file__).parent.parent / "memory.db"


@dataclass
class UserMemory:
    user_id: str
    name: str = ""
    language_preference: str = ""
    facts: dict = field(default_factory=dict)
    last_interaction: str = ""

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "language_preference": self.language_preference,
            "facts": self.facts,
            "last_interaction": self.last_interaction,
        }

    def summary(self) -> str:
        """Human-readable summary for the LLM system prompt."""
        lines = [f"Name: {self.name}" if self.name else "Name: unknown"]
        if self.language_preference:
            lines.append(f"Language preference: {self.language_preference}")
        if self.facts:
            for k, v in self.facts.items():
                lines.append(f"{k}: {v}")
        if self.last_interaction:
            lines.append(f"Last interaction: {self.last_interaction}")
        return "\n".join(lines)


class MemoryDB:
    """Thin synchronous SQLite wrapper (sqlite3 is always available)."""

    def __init__(self, db_path: Path = _DB_PATH) -> None:
        self._db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id          TEXT PRIMARY KEY,
                    name             TEXT    NOT NULL DEFAULT '',
                    language_pref    TEXT    NOT NULL DEFAULT '',
                    facts            TEXT    NOT NULL DEFAULT '{}',
                    last_interaction TEXT    NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    session_id       TEXT PRIMARY KEY,
                    user_id          TEXT    NOT NULL DEFAULT '',
                    title            TEXT    NOT NULL DEFAULT 'Voice Session',
                    messages         TEXT    NOT NULL DEFAULT '[]',
                    created_at       TEXT    NOT NULL DEFAULT ''
                )
                """
            )
            conn.commit()
            conn.close()
            logger.info("MemoryDB initialised at %s", self._db_path)
        except Exception:
            logger.exception("Failed to initialise MemoryDB")

    def get_user(self, user_id: str) -> UserMemory | None:
        """Return the stored profile for *user_id*, or None if not found."""
        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM users WHERE user_id = ?", (user_id,)
            ).fetchone()
            conn.close()
            if row is None:
                return None
            return UserMemory(
                user_id=row["user_id"],
                name=row["name"],
                language_preference=row["language_pref"],
                facts=json.loads(row["facts"] or "{}"),
                last_interaction=row["last_interaction"],
            )
        except Exception:
            logger.exception("get_user failed for %s", user_id)
            return None

    def save_user(
        self,
        user_id: str,
        name: str = "",
        language_preference: str = "",
        facts: dict | None = None,
        merge_facts: bool = True,
    ) -> UserMemory:
        """
        Upsert a caller profile.

        If *merge_facts* is True (default) new facts are merged with
        existing ones rather than overwriting the whole record.
        """
        try:
            existing = self.get_user(user_id)
            if existing and merge_facts and facts:
                merged = {**existing.facts, **facts}
            else:
                merged = facts or (existing.facts if existing else {})

            now = datetime.now(timezone.utc).isoformat()

            conn = sqlite3.connect(str(self._db_path))
            conn.execute(
                """
                INSERT INTO users (user_id, name, language_pref, facts, last_interaction)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    name             = excluded.name,
                    language_pref    = excluded.language_pref,
                    facts            = excluded.facts,
                    last_interaction = excluded.last_interaction
                """,
                (
                    user_id,
                    name or (existing.name if existing else ""),
                    language_preference
                    or (existing.language_preference if existing else ""),
                    json.dumps(merged, ensure_ascii=False),
                    now,
                ),
            )
            conn.commit()
            conn.close()
            logger.info("Saved memory for user %s", user_id)

            return UserMemory(
                user_id=user_id,
                name=name or (existing.name if existing else ""),
                language_preference=language_preference
                or (existing.language_preference if existing else ""),
                facts=merged,
                last_interaction=now,
            )
        except Exception:
            logger.exception("save_user failed for %s", user_id)
            return UserMemory(user_id=user_id)

    def save_chat_session(
        self,
        session_id: str,
        user_id: str = "",
        title: str = "Voice Session",
        messages: list | None = None,
    ) -> dict:
        """Save or update a chat session transcript."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            msgs_json = json.dumps(messages or [], ensure_ascii=False)
            conn = sqlite3.connect(str(self._db_path))
            conn.execute(
                """
                INSERT INTO chat_sessions (session_id, user_id, title, messages, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    user_id    = excluded.user_id,
                    title      = excluded.title,
                    messages   = excluded.messages,
                    created_at = excluded.created_at
                """,
                (session_id, user_id, title, msgs_json, now),
            )
            conn.commit()
            conn.close()
            return {
                "session_id": session_id,
                "user_id": user_id,
                "title": title,
                "messages": messages or [],
                "created_at": now,
            }
        except Exception:
            logger.exception("save_chat_session failed for %s", session_id)
            return {}

    def get_chat_sessions(self, user_id: str | None = None) -> list[dict]:
        """Fetch all chat sessions (optionally filtered by user_id)."""
        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row
            if user_id:
                rows = conn.execute(
                    "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC",
                    (user_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM chat_sessions ORDER BY created_at DESC"
                ).fetchall()
            conn.close()

            results = []
            for row in rows:
                results.append(
                    {
                        "session_id": row["session_id"],
                        "user_id": row["user_id"],
                        "title": row["title"],
                        "messages": json.loads(row["messages"] or "[]"),
                        "created_at": row["created_at"],
                    }
                )
            return results
        except Exception:
            logger.exception("get_chat_sessions failed")
            return []

    def delete_chat_session(self, session_id: str) -> bool:
        """Delete a chat session by ID, or delete all if session_id == 'ALL'."""
        try:
            conn = sqlite3.connect(str(self._db_path))
            if session_id.upper() == "ALL":
                conn.execute("DELETE FROM chat_sessions")
            else:
                conn.execute(
                    "DELETE FROM chat_sessions WHERE session_id = ?",
                    (session_id,),
                )
            conn.commit()
            conn.close()
            return True
        except Exception:
            logger.exception("delete_chat_session failed for %s", session_id)
            return False


if __name__ == "__main__":
    import sys

    db = MemoryDB()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"

    if cmd == "list":
        print(json.dumps(db.get_chat_sessions(), ensure_ascii=False))
    elif cmd == "save":
        payload = json.loads(sys.stdin.read())
        saved = db.save_chat_session(
            session_id=payload.get("session_id", ""),
            user_id=payload.get("user_id", ""),
            title=payload.get("title", "Voice Session"),
            messages=payload.get("messages", []),
        )
        print(json.dumps(saved, ensure_ascii=False))
    elif cmd == "delete":
        sid = sys.argv[2] if len(sys.argv) > 2 else "ALL"
        ok = db.delete_chat_session(sid)
        print(json.dumps({"success": ok}))
    elif cmd == "users":
        user_id = sys.argv[2] if len(sys.argv) > 2 else ""
        u = db.get_user(user_id) if user_id else None
        print(json.dumps(u.to_dict() if u else {}, ensure_ascii=False))
