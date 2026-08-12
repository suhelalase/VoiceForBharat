import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

import pytest
from livekit.agents import AgentSession, inference, llm

from agent import Assistant
from database import MemoryDB, redact_pii


def _llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


def test_pii_redaction():
    """Verify sensitive information is removed from text."""
    raw_text = "Customer password is secret123, OTP is 849201, PIN 9912, card 4532112233445566."
    redacted = redact_pii(raw_text)
    assert "849201" not in redacted
    assert "4532112233445566" not in redacted
    assert "[REDACTED]" in redacted or "[REDACTED_ACCOUNT]" in redacted


def test_escalation_deduplication():
    """Verify duplicate escalation requests for the same user and category update the open request."""
    db = MemoryDB()
    rec1 = db.create_or_update_escalation(
        user_id="test_user_1",
        caller_name="Ramesh",
        category="refund",
        summary_what_happened="Wrong item charged, PIN 1234",
        summary_agent_checked="Checked receipt",
        urgency="high",
    )
    assert rec1.escalation_id.startswith("ESC-")
    assert "1234" not in rec1.summary_what_happened

    # Create second request for same category while first is open
    rec2 = db.create_or_update_escalation(
        user_id="test_user_1",
        caller_name="Ramesh",
        category="refund",
        summary_what_happened="Followup on wrong item charged",
        summary_agent_checked="Re-verified with store manager",
        urgency="emergency",
    )
    # Should maintain the same escalation_id
    assert rec2.escalation_id == rec1.escalation_id
    assert rec2.urgency == "emergency"

    # Status check
    updated = db.update_escalation_status(rec1.escalation_id, "resolved")
    assert updated["status"] == "resolved"


@pytest.mark.asyncio
async def test_normal_conversation_no_escalation():
    """Test normal grocery restock conversation does not trigger escalation."""
    db = MemoryDB()
    async with (
        _llm() as llm_proc,
        AgentSession(llm=llm_proc) as session,
    ):
        await session.start(Assistant(user_id="test_normal_user"))

        result = await session.run(
            user_input="Hi, what are the prices for rice and wheat today?"
        )

        # Ensure assistant responds normally without creating escalations
        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm_proc,
                intent="Provides standard helpful answer about grocery items or states current status politely.",
            )
        )
        result.expect.no_more_events()

        escalations = db.get_escalations(user_id="test_normal_user")
        assert len(escalations) == 0


@pytest.mark.asyncio
async def test_escalation_dispute_flow():
    """Test escalation path when refund dispute occurs and consent is given."""
    async with (
        _llm() as llm_proc,
        AgentSession(llm=llm_proc) as session,
    ):
        await session.start(Assistant(user_id="test_dispute_user"))

        # User reports a refund dispute
        result = await session.run(
            user_input="I was charged 500 rupees extra for missing milk packets. I want a refund!"
        )

        # Agent should acknowledge dispute and ask for permission before creating request
        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                llm_proc,
                intent="Acknowledges refund issue and asks user for consent to create an escalation/ticket for the human support team.",
            )
        )
