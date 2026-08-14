import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    room_io,
    tokenize,
)
from livekit.plugins import deepgram, google, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from database import MemoryDB

logger = logging.getLogger("agent")

load_dotenv(".env.local")

# ──────────────────────────────────────────────────────────────
# Single shared DB instance (sqlite3 is thread-safe for reads)
# ──────────────────────────────────────────────────────────────
memory_db = MemoryDB()

# ──────────────────────────────────────────────────────────────
# System prompts
# ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are Pooja, a warm and professional outbound voice assistant for Local Commerce (FreshMart Grocery). Your job is to confirm recent orders and nudge customers for a restock based on their past order rhythm.

== Mandatory Outbound Call Opening (CRITICAL) ==
In the FIRST TWO SENTENCES of every session, you MUST state:
1. Who you are and who is calling: "Namaste! Main Pooja FreshMart Local Store se bol rahi hoon."
2. Why you are calling: "Aapke pichhle grocery order confirmation aur restock reminder ke silsile mein phone kiya hai."
3. How to make it stop / opt-out: "Agar aap yeh calls nahi chahte, toh bas 'stop calling' ya 'opt out' keh dein."

== Specialist Handoff Policy (CRITICAL) ==
You are the primary assistant for general order confirmation, restock, and general queries.
However, when a user asks about:
- Returning an item, defective/damaged goods, wrong items received, or requesting a refund/exchange.
You MUST hand off the conversation to the Returns and Refunds Specialist.

Step 1: Announce handoff clearly to user BEFORE switching:
Tell the caller in simple words: "Main aapko humare Returns and Refunds Specialist se connect kar rahi hoon." (or in English: "I will connect you to our Returns and Refunds Specialist.")
Step 2: Execute the `transfer_to_returns_specialist` tool immediately.

== Memory behaviour ==
The caller's profile is already looked up before the conversation starts and provided in your initial greeting instructions. Use that context to personalise the call.
Use `save_caller_info` to persist any new information the caller shares (name, preferences, opt-out requests, etc.).

== Human Escalation & Help Policy (CRITICAL) ==
You MUST know when to ask for human help. Human help is required when:
- The caller explicitly requests to speak with a manager or human support team.
- The caller is dissatisfied after talking with specialists or has complex account disputes.

Step 1: ASK BEFORE SHARING (MANDATORY CONSENT)
Before creating an escalation request, tell the caller what information you want to share with the support team (their name, issue summary, urgency, language, follow-up preference) and ASK FOR PERMISSION.
Example: "Kya main aapki yeh issue details humare human support team ke saath share karke escalation ticket create kar doon?"
- If the caller says NO or declines: Do NOT call `create_escalation`. Apologize and offer standard help.
- If the caller says YES: Proceed to call `create_escalation` with `user_consent_given=True`.

Step 2: REDACTION & SHORT SUMMARY
Do NOT include passwords, OTPs, PINs, card details, or full account numbers in the summary. Keep your summary short and focused.

Step 3: CLEAR NEXT STEP & REFERENCE ID
After creating the escalation, speak the reference ID (e.g., ESC-1042) clearly to the caller.

Step 4: CHECK STATUS
If the caller asks about the status of a previous dispute or ticket, call `check_escalation_status`.

== Opt-Out & Stop Calling Rule ==
If the user requests to stop calling, opt out, or unsubscribes:
- Immediately apologize politely, promise not to call again, call `save_caller_info` with `facts={"opt_out": "true"}`, and conclude the call.

== Conversation style ==
- Be concise and conversational — no bullet points, markdown, or emojis in your spoken responses.
- Support code-switching between Hindi and English naturally (Hinglish/Hindi).
- Keep responses short — this is a voice call, not a chat window."""

RETURNS_SPECIALIST_PROMPT = """You are Rohan, the dedicated Returns and Refunds Specialist for FreshMart Local Store.
Your ONLY role is handling product returns, replacement requests, damaged/defective item complaints, and processing refunds.

== Introduction Policy ==
When taking over a conversation, introduce yourself immediately:
"Namaste! Main Rohan hoon, FreshMart ka Returns and Refunds Specialist. Mujhe bataya gaya hai ki aapko item return ya refund ki zaroorat hai. Main aapki poori madad karunga."

== Instructions & Limits ==
1. Only answer queries about returns, refunds, replacement items, damaged items, and refund status.
2. If the user asks about general grocery restock or new orders, offer to complete their return query first.
3. Use `process_return_and_refund` tool to process eligible returns.
4. Keep spoken responses short, clear, warm, and in natural Hindi/Hinglish or English. No markdown, emojis, or bullet points in voice responses."""


# ──────────────────────────────────────────────────────────────
# Specialist Agent: Returns and Refunds Specialist
# ──────────────────────────────────────────────────────────────
class ReturnsAndRefundsSpecialist(Agent):
    def __init__(self, user_id: str = "default_user", initial_reason: str = "") -> None:
        super().__init__(instructions=RETURNS_SPECIALIST_PROMPT)
        self._user_id = user_id
        self._initial_reason = initial_reason

    @function_tool
    async def process_return_and_refund(
        self,
        context: RunContext,
        item_name: str,
        reason: str,
        refund_type: str = "store_credit",
    ) -> str:
        """Process a return request for a damaged, defective, or incorrect grocery item.

        Args:
            item_name: Name of the item to be returned (e.g. "Amul Milk 1L", "Tomatoes 1kg").
            reason: Reason for return (e.g. "expired", "damaged packaging", "wrong item").
            refund_type: Preferred refund method ("store_credit" or "original_payment_method").
        """
        logger.info(
            "Processing return for user=%s item=%s reason=%s method=%s",
            self._user_id,
            item_name,
            reason,
            refund_type,
        )
        return (
            f"Return request approved for '{item_name}' due to '{reason}'. "
            f"Refund amount of 100% processed via {refund_type}. Return Ticket ID: RET-{self._user_id[:4].upper()}-99"
        )


# ──────────────────────────────────────────────────────────────
# Primary Assistant with memory, handoff, and escalation tools
# ──────────────────────────────────────────────────────────────
class Assistant(Agent):
    def __init__(self, user_id: str = "default_user") -> None:
        super().__init__(instructions=SYSTEM_PROMPT)
        self._user_id = user_id

    @function_tool
    async def transfer_to_returns_specialist(
        self,
        context: RunContext,
        reason: str,
    ) -> str:
        """Transfer the call/conversation to the Returns and Refunds Specialist agent.

        Use this tool IMMEDIATELY when the customer mentions returning an item, requesting a refund,
        complaining about damaged/expired goods, or asking for an order exchange.

        Args:
            reason: Specific reason for transferring to the returns specialist (e.g., "Customer received expired milk and wants a refund").
        """
        logger.info(
            "Handoff triggered for user=%s to Returns Specialist. Reason: %s",
            self._user_id,
            reason,
        )
        specialist = ReturnsAndRefundsSpecialist(
            user_id=self._user_id, initial_reason=reason
        )
        await context.session.update_agent(specialist)
        return (
            f"Handoff completed successfully to Returns & Refunds Specialist (Rohan). "
            f"Reason passed: '{reason}'. Specialist is now active."
        )

    @function_tool
    async def save_caller_info(
        self,
        context: RunContext,
        name: str,
        language_preference: str,
        facts: dict,
    ) -> str:
        """Save information about the caller to memory — only after they have given consent.

        Args:
            name: The caller's name (leave empty string if not known).
            language_preference: The caller's preferred language or locale (e.g. "Hindi", "Tamil", "en-IN").
            facts: A dictionary of useful facts about the caller relevant to their needs.
                   Examples: {"crop": "cotton", "district": "Nagpur", "land_size": "5 acres"}
                   Keep keys short and values concise.
        """
        logger.info(
            "Saving caller info for: %s  name=%s  facts=%s", self._user_id, name, facts
        )
        saved = memory_db.save_user(
            user_id=self._user_id,
            name=name,
            language_preference=language_preference,
            facts=facts,
        )
        return f"Saved successfully. Profile: {saved.to_dict()}"

    @function_tool
    async def create_escalation(
        self,
        context: RunContext,
        category: str,
        what_happened: str,
        agent_checked: str,
        urgency: str,
        language: str,
        followup_method: str,
        user_consent_given: bool,
        caller_name: str = "",
    ) -> str:
        """Create a human help escalation request when a payment, refund, or order dispute occurs.
        MUST ONLY BE CALLED AFTER ASKING AND RECEIVING THE CALLER'S EXPLICIT PERMISSION.

        Args:
            category: Category of the dispute ("payment", "refund", "order_dispute", "manager_request").
            what_happened: Short summary of the caller's issue (NO PINs/OTPs/Passwords/Card Numbers).
            agent_checked: Short summary of what the agent already verified (e.g., "Verified order #1042 was delivered missing 2 items").
            urgency: Priority level: "low", "medium", "high", or "emergency".
            language: Preferred language of the caller (e.g., "Hindi", "English", "Hinglish").
            followup_method: Preferred contact method: "phone", "email", or "whatsapp".
            user_consent_given: Set to True ONLY if caller explicitly gave permission to create the ticket.
            caller_name: Name of the caller (optional if known).
        """
        if not user_consent_given:
            return "Escalation cancelled: User permission was not granted."

        logger.info(
            "Creating escalation for user=%s category=%s urgency=%s",
            self._user_id,
            category,
            urgency,
        )
        record = memory_db.create_or_update_escalation(
            user_id=self._user_id,
            caller_name=caller_name,
            category=category,
            summary_what_happened=what_happened,
            summary_agent_checked=agent_checked,
            urgency=urgency,
            language=language,
            followup_method=followup_method,
        )

        return (
            f"Escalation request saved. Ticket Reference ID: {record.escalation_id}. "
            f"Status: {record.status}. Next step: Explain to the caller that reference ID is {record.escalation_id} "
            "and human support will review and follow up."
        )

    @function_tool
    async def check_escalation_status(
        self,
        context: RunContext,
        escalation_id: str = "",
    ) -> str:
        """Check the status of open human help requests or disputes for the caller.

        Args:
            escalation_id: Reference ID (e.g. 'ESC-1042') if provided, or leave blank to check all open requests.
        """
        if escalation_id:
            escalations = memory_db.get_escalations(status=None)
            filtered = [
                e
                for e in escalations
                if e["escalation_id"].upper() == escalation_id.upper()
            ]
        else:
            filtered = memory_db.get_escalations(user_id=self._user_id)

        if not filtered:
            return "No matching escalation requests found for this caller."

        summaries = []
        for e in filtered:
            summaries.append(
                f"ID: {e['escalation_id']} | Category: {e['category']} | Status: {e['status']} | Urgency: {e['urgency']}"
            )
        return "Current Escalations:\n" + "\n".join(summaries)

    @function_tool
    async def record_call_outcome(
        self,
        context: RunContext,
        outcome: str,
        reason_summary: str = "",
    ) -> str:
        """Record whether the current call reached a successful outcome or failed.

        Call outcome definition for Local Commerce (FreshMart Grocery):
        - 'successful': The caller found a product, completed an enquiry, placed/replenished an order, or resolved an order query smoothly.
        - 'failed': The caller hung up early, refused to complete an enquiry, explicitly opted out, or had an unhandled dispute.

        Args:
            outcome: 'successful' or 'failed'
            reason_summary: Short 1-sentence explanation of why the call was marked successful or failed.
        """
        call_id = f"CALL-{self._user_id}"
        rec = memory_db.record_call_outcome(
            call_id=call_id,
            user_id=self._user_id,
            status=outcome,
            summary=reason_summary,
        )
        logger.info(
            "Call outcome logged for %s: outcome=%s, summary=%s",
            self._user_id,
            outcome,
            reason_summary,
        )
        return f"Call outcome recorded as '{rec.status}'. Analytics updated."


# ──────────────────────────────────────────────────────────────
# LiveKit server setup
# ──────────────────────────────────────────────────────────────
server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Derive a stable user_id from the room name (or participant identity when available)
    # The room name is consistent across reconnects for the same user session.
    user_id = ctx.room.name
    user_profile = memory_db.get_user(user_id)
    caller_name = user_profile.name if (user_profile and user_profile.name) else ""

    # Record call start in call_analytics table
    call_id = f"CALL-{user_id}"
    memory_db.record_call_start(
        call_id=call_id, user_id=user_id, caller_name=caller_name
    )

    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(
            model="gemini-2.5-flash",
        ),
        tts=murf.TTS(
            voice="Anisha",
            locale="hi-IN",
            style="Conversation",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=False,
    )

    await session.start(
        agent=Assistant(user_id=user_id),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await ctx.connect()

    # Look up stored caller profile to welcome them by name and recall facts/escalations (Connect & Be Remembered)
    user_profile = memory_db.get_user(user_id)
    caller_name = user_profile.name if (user_profile and user_profile.name) else ""

    # Look up any open/in_progress escalation tickets for this caller
    open_escalations = memory_db.get_escalations(user_id=user_id, status="open")
    escalation_context = ""
    if open_escalations:
        latest = open_escalations[0]
        escalation_context = (
            f" [MEMORY UPDATE: Caller has an OPEN escalation ticket {latest['escalation_id']} "
            f"regarding '{latest['category']}' with status '{latest['status']}'. "
            f"Acknowledge that you remember their open dispute ticket.]"
        )

    # Outbound call initial greeting: Welcome caller by name + mandatory opening + remembered memory context
    greeting_prompt = (
        f"Greet the caller by name '{caller_name}' warmly in Hindi/Hinglish."
        if caller_name
        else "Greet the caller warmly in Hindi/Hinglish."
    )
    greeting_prompt += (
        " Deliver your mandatory outbound opening: State who you are (Pooja from FreshMart Local Store), "
        "why you are calling (order confirmation and restock reminder), and how to opt out (say 'stop calling')."
    )
    if user_profile and user_profile.facts:
        greeting_prompt += (
            f" Remembered facts about this customer: {user_profile.facts}."
        )
    if escalation_context:
        greeting_prompt += escalation_context

    await session.generate_reply(instructions=greeting_prompt)


if __name__ == "__main__":
    cli.run_app(server)
