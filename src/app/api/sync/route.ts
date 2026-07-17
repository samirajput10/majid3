import { NextResponse } from 'next/server';
import { runAtlasPush } from '@/lib/atlasSync';

// Manual "Save" push — mirrors the local database to the cloud (Atlas).
// No-op ('idle') on the web deployment where MONGODB_URI is already the cloud.
export async function POST() {
  try {
    const result = await runAtlasPush();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/sync]', err);
    return NextResponse.json({ mode: 'error', reason: String(err) }, { status: 500 });
  }
}
