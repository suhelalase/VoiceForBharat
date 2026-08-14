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
import re
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("agent.database")

# The DB file sits next to this module so it survives restarts.
_DB_PATH = Path(__file__).parent.parent / "memory.db"


def redact_pii(text: str) -> str:
    """Remove private details like passwords, OTPs, PINs, card & account numbers."""
    if not text:
        return ""
    # Redact explicit keyword pattern value matches: OTP/PIN/Password/Account/Card followed by numbers/tokens
    redacted = re.sub(
        r"(?i)\b(otp|pin|password|passcode|cvv|account\s*number|card\s*number)\s*(?:is|[:=])?\s*\w+",
        r"\1: [REDACTED]",
        text,
    )
    # Redact 13 to 19 digit account / credit card numbers
    redacted = re.sub(r"\b\d{13,19}\b", "[REDACTED_ACCOUNT]", redacted)
    # Redact standalone 4 to 6 digit codes/PINs/OTPs
    redacted = re.sub(
        r"\b(otp|pin)\s*(?:is|[:=])?\s*\d{4,6}\b",
        r"\1: [REDACTED]",
        redacted,
        flags=re.IGNORECASE,
    )
    return redacted


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


@dataclass
class EscalationRecord:
    escalation_id: str
    user_id: str
    caller_name: str = ""
    category: str = "general"
    summary_what_happened: str = ""
    summary_agent_checked: str = ""
    urgency: str = "medium"  # low, medium, high, emergency
    language: str = "Hindi"
    followup_method: str = "phone"
    status: str = "open"  # open, in_progress, resolved
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "escalation_id": self.escalation_id,
            "user_id": self.user_id,
            "caller_name": self.caller_name,
            "category": self.category,
            "summary_what_happened": self.summary_what_happened,
            "summary_agent_checked": self.summary_agent_checked,
            "urgency": self.urgency,
            "language": self.language,
            "followup_method": self.followup_method,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class CallRecord:
    call_id: str
    user_id: str
    caller_name: str = ""
    status: str = "in_progress"  # successful, failed, in_progress
    summary: str = ""
    duration_seconds: int = 0
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "call_id": self.call_id,
            "user_id": self.user_id,
            "caller_name": self.caller_name,
            "status": self.status,
            "summary": self.summary,
            "duration_seconds": self.duration_seconds,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS escalations (
                    escalation_id         TEXT PRIMARY KEY,
                    user_id               TEXT NOT NULL,
                    caller_name           TEXT NOT NULL DEFAULT '',
                    category              TEXT NOT NULL DEFAULT 'general',
                    summary_what_happened TEXT NOT NULL DEFAULT '',
                    summary_agent_checked TEXT NOT NULL DEFAULT '',
                    urgency               TEXT NOT NULL DEFAULT 'medium',
                    language              TEXT NOT NULL DEFAULT 'Hindi',
                    followup_method       TEXT NOT NULL DEFAULT 'phone',
                    status                TEXT NOT NULL DEFAULT 'open',
                    created_at            TEXT NOT NULL DEFAULT '',
                    updated_at            TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS call_analytics (
                    call_id               TEXT PRIMARY KEY,
                    user_id               TEXT NOT NULL,
                    caller_name           TEXT NOT NULL DEFAULT '',
                    status                TEXT NOT NULL DEFAULT 'in_progress',
                    summary               TEXT NOT NULL DEFAULT '',
                    duration_seconds      INTEGER NOT NULL DEFAULT 0,
                    created_at            TEXT NOT NULL DEFAULT '',
                    updated_at            TEXT NOT NULL DEFAULT ''
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

    def create_or_update_escalation(
        self,
        user_id: str,
        caller_name: str = "",
        category: str = "general",
        summary_what_happened: str = "",
        summary_agent_checked: str = "",
        urgency: str = "medium",
        language: str = "Hindi",
        followup_method: str = "phone",
    ) -> EscalationRecord:
        """
        Create a new escalation record or update an existing open duplicate request.
        Also redacts sensitive information (PII/OTPs/PINs/passwords).
        """
        try:
            clean_happened = redact_pii(summary_what_happened)
            clean_checked = redact_pii(summary_agent_checked)
            now = datetime.now(timezone.utc).isoformat()

            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row

            # Check if there is an existing open/in_progress escalation for this user and category (Deduplication)
            existing = conn.execute(
                """
                SELECT * FROM escalations
                WHERE user_id = ? AND category = ? AND status IN ('open', 'in_progress')
                ORDER BY created_at DESC LIMIT 1
                """,
                (user_id, category),
            ).fetchone()

            if existing:
                escalation_id = existing["escalation_id"]
                conn.execute(
                    """
                    UPDATE escalations SET
                        caller_name           = ?,
                        summary_what_happened = ?,
                        summary_agent_checked = ?,
                        urgency               = ?,
                        language              = ?,
                        followup_method       = ?,
                        updated_at            = ?
                    WHERE escalation_id = ?
                    """,
                    (
                        caller_name or existing["caller_name"],
                        clean_happened or existing["summary_what_happened"],
                        clean_checked or existing["summary_agent_checked"],
                        urgency or existing["urgency"],
                        language or existing["language"],
                        followup_method or existing["followup_method"],
                        now,
                        escalation_id,
                    ),
                )
                logger.info("Updated existing escalation duplicate %s", escalation_id)
            else:
                # Generate new reference ID e.g. ESC-1042
                rand_num = uuid.uuid4().hex[:4].upper()
                escalation_id = f"ESC-{rand_num}"
                conn.execute(
                    """
                    INSERT INTO escalations (
                        escalation_id, user_id, caller_name, category,
                        summary_what_happened, summary_agent_checked,
                        urgency, language, followup_method, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
                    """,
                    (
                        escalation_id,
                        user_id,
                        caller_name,
                        category,
                        clean_happened,
                        clean_checked,
                        urgency,
                        language,
                        followup_method,
                        now,
                        now,
                    ),
                )
                logger.info(
                    "Created new escalation %s for user %s", escalation_id, user_id
                )

            conn.commit()
            conn.close()

            return EscalationRecord(
                escalation_id=escalation_id,
                user_id=user_id,
                caller_name=caller_name,
                category=category,
                summary_what_happened=clean_happened,
                summary_agent_checked=clean_checked,
                urgency=urgency,
                language=language,
                followup_method=followup_method,
                status=existing["status"] if existing else "open",
                created_at=existing["created_at"] if existing else now,
                updated_at=now,
            )
        except Exception:
            logger.exception("create_or_update_escalation failed for %s", user_id)
            return EscalationRecord(escalation_id="ESC-ERR", user_id=user_id)

    def get_escalations(
        self, user_id: str | None = None, status: str | None = None
    ) -> list[dict]:
        """Fetch escalation requests with optional filters."""
        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row
            query = "SELECT * FROM escalations WHERE 1=1"
            params = []
            if user_id:
                query += " AND user_id = ?"
                params.append(user_id)
            if status:
                query += " AND status = ?"
                params.append(status)
            query += " ORDER BY created_at DESC"

            rows = conn.execute(query, params).fetchall()
            conn.close()

            results = []
            for r in rows:
                results.append(
                    {
                        "escalation_id": r["escalation_id"],
                        "user_id": r["user_id"],
                        "caller_name": r["caller_name"],
                        "category": r["category"],
                        "summary_what_happened": r["summary_what_happened"],
                        "summary_agent_checked": r["summary_agent_checked"],
                        "urgency": r["urgency"],
                        "language": r["language"],
                        "followup_method": r["followup_method"],
                        "status": r["status"],
                        "created_at": r["created_at"],
                        "updated_at": r["updated_at"],
                    }
                )
            return results
        except Exception:
            logger.exception("get_escalations failed")
            return []

    def update_escalation_status(self, escalation_id: str, status: str) -> dict | None:
        """Update the status of an escalation (e.g. open -> in_progress / resolved)."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row
            conn.execute(
                "UPDATE escalations SET status = ?, updated_at = ? WHERE escalation_id = ?",
                (status, now, escalation_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM escalations WHERE escalation_id = ?", (escalation_id,)
            ).fetchone()
            conn.close()
            if not row:
                return None
            return {
                "escalation_id": row["escalation_id"],
                "user_id": row["user_id"],
                "caller_name": row["caller_name"],
                "category": row["category"],
                "summary_what_happened": row["summary_what_happened"],
                "summary_agent_checked": row["summary_agent_checked"],
                "urgency": row["urgency"],
                "language": row["language"],
                "followup_method": row["followup_method"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        except Exception:
            logger.exception("update_escalation_status failed for %s", escalation_id)
            return None

    def record_call_start(
        self, call_id: str, user_id: str, caller_name: str = ""
    ) -> CallRecord:
        """Record the initiation of a call."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            conn = sqlite3.connect(str(self._db_path))
            conn.execute(
                """
                INSERT INTO call_analytics (call_id, user_id, caller_name, status, summary, duration_seconds, created_at, updated_at)
                VALUES (?, ?, ?, 'in_progress', '', 0, ?, ?)
                ON CONFLICT(call_id) DO UPDATE SET
                    caller_name = excluded.caller_name,
                    updated_at  = excluded.updated_at
                """,
                (call_id, user_id, caller_name, now, now),
            )
            conn.commit()
            conn.close()
            return CallRecord(
                call_id=call_id,
                user_id=user_id,
                caller_name=caller_name,
                status="in_progress",
                created_at=now,
                updated_at=now,
            )
        except Exception:
            logger.exception("record_call_start failed for %s", call_id)
            return CallRecord(call_id=call_id, user_id=user_id)

    def record_call_outcome(
        self,
        call_id: str,
        user_id: str = "",
        status: str = "successful",
        summary: str = "",
        duration_seconds: int = 0,
    ) -> CallRecord:
        """Record the outcome of a call (successful vs failed)."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            status_clean = (
                "successful"
                if status.lower() in ("successful", "success")
                else "failed"
            )
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row

            existing = conn.execute(
                "SELECT * FROM call_analytics WHERE call_id = ?", (call_id,)
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE call_analytics SET
                        status           = ?,
                        summary          = ?,
                        duration_seconds = ?,
                        updated_at       = ?
                    WHERE call_id = ?
                    """,
                    (status_clean, summary, duration_seconds, now, call_id),
                )
                user_id_val = existing["user_id"]
                caller_name_val = existing["caller_name"]
                created_at_val = existing["created_at"]
            else:
                user_id_val = user_id or "default_user"
                caller_name_val = ""
                created_at_val = now
                conn.execute(
                    """
                    INSERT INTO call_analytics (call_id, user_id, caller_name, status, summary, duration_seconds, created_at, updated_at)
                    VALUES (?, ?, '', ?, ?, ?, ?, ?)
                    """,
                    (
                        call_id,
                        user_id_val,
                        status_clean,
                        summary,
                        duration_seconds,
                        now,
                        now,
                    ),
                )

            conn.commit()
            conn.close()
            logger.info("Recorded call outcome for %s -> %s", call_id, status_clean)

            return CallRecord(
                call_id=call_id,
                user_id=user_id_val,
                caller_name=caller_name_val,
                status=status_clean,
                summary=summary,
                duration_seconds=duration_seconds,
                created_at=created_at_val,
                updated_at=now,
            )
        except Exception:
            logger.exception("record_call_outcome failed for %s", call_id)
            return CallRecord(call_id=call_id, user_id=user_id, status=status)

    def get_call_analytics(self) -> dict:
        """Fetch summary stats: total_calls, successful_calls, failed_calls, success_rate, and recent calls list."""
        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row

            total = conn.execute(
                "SELECT COUNT(*) as cnt FROM call_analytics"
            ).fetchone()["cnt"]
            successful = conn.execute(
                "SELECT COUNT(*) as cnt FROM call_analytics WHERE status = 'successful'"
            ).fetchone()["cnt"]
            failed = conn.execute(
                "SELECT COUNT(*) as cnt FROM call_analytics WHERE status = 'failed'"
            ).fetchone()["cnt"]
            in_progress = conn.execute(
                "SELECT COUNT(*) as cnt FROM call_analytics WHERE status = 'in_progress'"
            ).fetchone()["cnt"]

            rows = conn.execute(
                "SELECT * FROM call_analytics ORDER BY created_at DESC LIMIT 50"
            ).fetchall()
            conn.close()

            recent = []
            for r in rows:
                recent.append(
                    {
                        "call_id": r["call_id"],
                        "user_id": r["user_id"],
                        "caller_name": r["caller_name"],
                        "status": r["status"],
                        "summary": r["summary"],
                        "duration_seconds": r["duration_seconds"],
                        "created_at": r["created_at"],
                        "updated_at": r["updated_at"],
                    }
                )

            total_finished = successful + failed
            success_rate = (
                round((successful / total_finished) * 100, 1)
                if total_finished > 0
                else 0.0
            )

            return {
                "total_calls": total,
                "successful_calls": successful,
                "failed_calls": failed,
                "in_progress_calls": in_progress,
                "success_rate": success_rate,
                "recent_calls": recent,
            }
        except Exception:
            logger.exception("get_call_analytics failed")
            return {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "in_progress_calls": 0,
                "success_rate": 0.0,
                "recent_calls": [],
            }


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
    elif cmd == "escalations":
        user_id = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "ALL" else None
        print(json.dumps(db.get_escalations(user_id), ensure_ascii=False))
    elif cmd == "resolve_escalation":
        eid = sys.argv[2] if len(sys.argv) > 2 else ""
        updated = db.update_escalation_status(eid, "resolved")
        print(json.dumps(updated or {}, ensure_ascii=False))
    elif cmd == "analytics":
        print(json.dumps(db.get_call_analytics(), ensure_ascii=False))
    elif cmd == "record_outcome":
        payload = json.loads(sys.stdin.read())
        rec = db.record_call_outcome(
            call_id=payload.get("call_id", ""),
            user_id=payload.get("user_id", ""),
            status=payload.get("status", "successful"),
            summary=payload.get("summary", ""),
            duration_seconds=payload.get("duration_seconds", 0),
        )
        print(json.dumps(rec.to_dict(), ensure_ascii=False))
