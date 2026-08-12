import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const revalidate = 0;

function runDbScript(command: string): string {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');
    const result = execSync(`uv run python src/database.py ${command}`, {
      cwd: backendDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim();
  } catch (error) {
    console.error('runDbScript failed:', error);
    return '[]';
  }
}

export async function GET() {
  try {
    const raw = runDbScript('escalations ALL');
    const escalations = JSON.parse(raw || '[]');
    return NextResponse.json({ success: true, escalations });
  } catch (error) {
    console.error('GET /api/escalations error:', error);
    return NextResponse.json({ success: false, escalations: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { escalation_id, action, destination, caller_name } = await req.json();

    if (action === 'resolve' && escalation_id) {
      // Update escalation status to resolved in DB
      const raw = runDbScript(`resolve_escalation ${escalation_id}`);
      const updated = JSON.parse(raw || '{}');

      // Trigger resolution callback outbound call using Day 6 outbound call flow
      try {
        const backendDir = path.resolve(process.cwd(), '../backend');
        const dest = destination || 'browser-user';
        const name = caller_name || 'Valued Customer';
        execSync(`uv run python src/make_outbound_call.py "${dest}" "${name}"`, {
          cwd: backendDir,
          encoding: 'utf-8',
          timeout: 10000,
        });
      } catch (cbErr) {
        console.warn('Outbound call trigger note:', cbErr);
      }

      return NextResponse.json({
        success: true,
        escalation: updated,
        message: `Escalation ${escalation_id} resolved and resolution callback call dispatched.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const err = error as Error;
    console.error('POST /api/escalations error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update escalation' },
      { status: 500 }
    );
  }
}
