import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const revalidate = 0;

function runDbScript(command: string, stdinData?: string): string {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');
    const input = stdinData ? { input: stdinData } : {};
    const result = execSync(`uv run python src/database.py ${command}`, {
      cwd: backendDir,
      encoding: 'utf-8',
      timeout: 5000,
      ...input,
    });
    return result.trim();
  } catch (error) {
    console.error('runDbScript failed:', error);
    return '[]';
  }
}

export async function GET() {
  try {
    const raw = runDbScript('list');
    const sessions = JSON.parse(raw || '[]');
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('GET /api/history error:', error);
    return NextResponse.json({ success: false, sessions: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = JSON.stringify(body);
    const raw = runDbScript('save', payload);
    const saved = JSON.parse(raw || '{}');
    return NextResponse.json({ success: true, session: saved });
  } catch (error) {
    console.error('POST /api/history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || 'ALL';
    runDbScript(`delete ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
