import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(req: NextRequest) {
  try {
    const { destination, name } = await req.json();

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json({ error: 'Missing LiveKit environment variables' }, { status: 500 });
    }

    const roomName = `outbound-${Date.now()}`;
    const participantIdentity = destination || `outbound-user-${Date.now()}`;

    // Create room token for the client or dispatch agent
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: name || 'Valued Customer',
      ttl: '15m',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      success: true,
      roomName,
      token,
      url: livekitUrl,
      message: `Outbound call dispatch initialized for ${name || 'Customer'} (${destination || 'Browser UI'})`,
    });
  } catch (error: any) {
    console.error('Outbound trigger error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
