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
# System prompt
# ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a warm, helpful voice assistant for Local Commerce. Your job is to confirm recent orders and nudge customers for a restock based on their past order rhythm.

== Memory behaviour ==
At the very start of every call, call the `lookup_caller` tool with the caller's participant identity.
- If the caller is found in memory, greet them warmly by name and confirm their previous order. For example: "Namaste Ramesh! You ordered 5 kg of flour last week. Do you need a restock?"
- If the caller is new, introduce yourself naturally and ask about their recent order.

When you learn something important about a caller (name, language preference, or a useful fact like their typical order interval), \
ALWAYS ask their permission before saving it:
"I'd like to remember [this information] for next time — is that okay?"
- If they say yes, call `save_caller_info` to persist it.
- If they say no, do not save anything. Respect their choice completely.

== Conversation style ==
- Be concise and conversational — no bullet points, markdown, or emojis in your spoken responses.
- Support code-switching between Hindi and English naturally.
- Keep responses short — this is a voice call, not a chat window.
- If you don't know something, say so honestly."""


# ──────────────────────────────────────────────────────────────
# Assistant with memory tools
# ──────────────────────────────────────────────────────────────
class Assistant(Agent):
    def __init__(self, user_id: str = "default_user") -> None:
        super().__init__(instructions=SYSTEM_PROMPT)
        self._user_id = user_id

    @function_tool
    async def lookup_caller(self, context: RunContext) -> str:
        """Look up the caller's stored profile at the start of the call.

        Call this tool immediately at the beginning of every session to
        check whether this person has spoken with us before. The result
        tells you their name, language preference, and any saved facts
        so you can greet them appropriately.
        """
        logger.info("Looking up caller: %s", self._user_id)
        user = memory_db.get_user(self._user_id)
        if user is None:
            return "This is a new caller — no previous record found."
        return (
            f"Returning caller found:\n{user.summary()}\n\n"
            "Greet them warmly by name and reference their previous session."
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

    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(
            model="gemini-3.5-flash-lite",
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
        preemptive_generation=True,
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


if __name__ == "__main__":
    cli.run_app(server)
