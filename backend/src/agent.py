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
SYSTEM_PROMPT = """You are Pooja, a warm and professional outbound voice assistant for Local Commerce (FreshMart Grocery). Your job is to confirm recent orders and nudge customers for a restock based on their past order rhythm.

== Mandatory Outbound Call Opening (CRITICAL) ==
In the FIRST TWO SENTENCES of every session, you MUST state:
1. Who you are and who is calling: "Namaste! Main Pooja FreshMart Local Store se bol rahi hoon."
2. Why you are calling: "Aapke pichhle grocery order confirmation aur restock reminder ke silsile mein phone kiya hai."
3. How to make it stop / opt-out: "Agar aap yeh calls nahi chahte, toh bas 'stop calling' ya 'opt out' keh dein."

== Memory behaviour ==
At the very start of every call, call the `lookup_caller` tool with the caller's participant identity.
- If the caller is found in memory, greet them warmly by name, state the mandatory opening, and confirm their previous order.
- If the caller is new, deliver the mandatory opening and introduce the restock nudge.

== Opt-Out & Stop Calling Rule ==
If the user requests to stop calling, opt out, or unsubscribes:
- Immediately apologize politely, promise not to call again, call `save_caller_info` with `facts={"opt_out": "true"}`, and conclude the call.

== Conversation style ==
- Be concise and conversational — no bullet points, markdown, or emojis in your spoken responses.
- Support code-switching between Hindi and English naturally (Hinglish/Hindi).
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

    # Outbound call behavior: Agent initiates the conversation first before the user speaks
    await session.generate_reply(
        instructions="Greet the caller immediately with your mandatory outbound call opening. State who you are (Pooja from FreshMart Local Store), why you are calling (order confirmation and restock reminder), and how to opt out (say 'stop calling')."
    )


if __name__ == "__main__":
    cli.run_app(server)
