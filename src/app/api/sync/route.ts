import { NextResponse } from 'next/server';
import { runAtlasPush, runAtlasPull } from '@/lib/atlasSync';

// Manual sync, triggered by the TopBar buttons:
//   { direction: 'push' } (default) — Save: mirror local DB → cloud (Atlas)
//   { direction: 'pull' }           — Refresh: mirror cloud → local DB
// Both are no-ops ('idle') on the web deployment where MONGODB_URI is
// already the cloud database.
export async function POST(req: Request) {
  try {
    let direction = 'push';
    try {
      const body = await req.json();
      if (body?.direction === 'pull') direction = 'pull';
    } catch { /* no body — default to push */ }

    const result = direction === 'pull' ? await runAtlasPull() : await runAtlasPush();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/sync]', err);
    return NextResponse.json({ mode: 'error', reason: String(err) }, { status: 500 });
  }
}
