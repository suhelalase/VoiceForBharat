import asyncio
import os
import sys

from dotenv import load_dotenv
from livekit.api import (
    CreateAgentDispatchRequest,
    CreateSIPParticipantRequest,
    LiveKitAPI,
)

load_dotenv(".env.local")


async def trigger_outbound_call(destination: str, name: str = "Valued Customer"):
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    agent_name = os.getenv("AGENT_NAME", "my-agent")

    if not url or not key or not secret:
        print(
            "Error: Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET in environment."
        )
        return

    room_name = f"outbound-{destination.replace(':', '-').replace('@', '-')}"
    api = LiveKitAPI(url=url, api_key=key, api_secret=secret)

    print("--- Triggering Outbound Call ---")
    print(f"Destination: {destination}")
    print(f"Customer Name: {name}")
    print(f"Target Room: {room_name}")

    try:
        # 1. Dispatch the agent to the outbound room
        print(f"Dispatching agent '{agent_name}' to room '{room_name}'...")
        dispatch_req = CreateAgentDispatchRequest(agent_name=agent_name, room=room_name)
        dispatch_res = await api.agent_dispatch.create_dispatch(dispatch_req)
        print(f"Agent dispatch created: {dispatch_res.id}")

        # 2. If destination is a phone or SIP URI, create SIP participant (Twilio / Linphone)
        if destination.startswith("sip:") or destination.startswith("+"):
            trunk_id = os.getenv("SIP_OUTBOUND_TRUNK_ID", "")
            print(f"Initiating SIP participant call to {destination}...")
            sip_req = CreateSIPParticipantRequest(
                sip_trunk_id=trunk_id,
                sip_call_to=destination,
                room_name=room_name,
                participant_identity=f"customer-{name}",
                participant_name=name,
            )
            sip_res = await api.sip.create_sip_participant(sip_req)
            print(f"SIP Call initiated: {sip_res}")
        else:
            print(f"Web/Simulated outbound call ready. Open frontend room: {room_name}")

    except Exception as e:
        print(f"Note/Notice during outbound call setup: {e}")
        print(
            "If using Linphone/Twilio, ensure SIP Trunk is configured in LiveKit Cloud."
        )
    finally:
        await api.close()


if __name__ == "__main__":
    dest = sys.argv[1] if len(sys.argv) > 1 else "sip:user@sip.linphone.org"
    cust_name = sys.argv[2] if len(sys.argv) > 2 else "Ramesh Kumar"
    asyncio.run(trigger_outbound_call(dest, cust_name))
