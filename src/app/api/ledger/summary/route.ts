import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { LedgerEntry } from '@/lib/models/LedgerEntry';
import { getLedgerSummary } from '@/lib/ledger';

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = await LedgerEntry.find({ companyId }).lean() as any[];
    return NextResponse.json({ companyId, ...getLedgerSummary(entries) });
  } catch (err) {
    console.error('[GET /api/ledger/summary]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
