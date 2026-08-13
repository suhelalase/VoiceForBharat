import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const revalidate = 0;

function runDbScript(command: string, inputPayload?: string): string {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');
    const cmd = inputPayload
      ? `echo ${JSON.stringify(inputPayload)} | uv run python src/database.py ${command}`
      : `uv run python src/database.py ${command}`;
    const result = execSync(cmd, {
      cwd: backendDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim();
  } catch (error) {
    console.error('runDbScript analytics failed:', error);
    return '{}';
  }
}

export async function GET() {
  try {
    const raw = runDbScript('analytics');
    const data = JSON.parse(raw || '{}');
    return NextResponse.json({
      success: true,
      total_calls: data.total_calls ?? 0,
      successful_calls: data.successful_calls ?? 0,
      failed_calls: data.failed_calls ?? 0,
      in_progress_calls: data.in_progress_calls ?? 0,
      success_rate: data.success_rate ?? 0.0,
      recent_calls: data.recent_calls ?? [],
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        in_progress_calls: 0,
        success_rate: 0,
        recent_calls: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { call_id, user_id, status, summary, duration_seconds } = body;

    const backendDir = path.resolve(process.cwd(), '../backend');
    const payload = JSON.stringify({
      call_id: call_id || `CALL-${Date.now()}`,
      user_id: user_id || 'browser_user',
      status: status || 'successful',
      summary: summary || '',
      duration_seconds: duration_seconds || 0,
    });

    const result = execSync(`uv run python src/database.py record_outcome`, {
      cwd: backendDir,
      input: payload,
      encoding: 'utf-8',
      timeout: 5000,
    });

    return NextResponse.json({ success: true, record: JSON.parse(result.trim() || '{}') });
  } catch (error) {
    console.error('POST /api/analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record call outcome' },
      { status: 500 }
    );
  }
}
