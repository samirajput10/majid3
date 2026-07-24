import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { LedgerEntry } from '@/lib/models/LedgerEntry';
import { Company } from '@/lib/models/Company';
import { WorkerB } from '@/lib/models/WorkerB';
import { computeRunningBalances } from '@/lib/ledger';
import { applyStockForItems } from '@/lib/stockSync';
import { normalizePurchaseBody } from '@/lib/purchase';

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const query = companyId ? { companyId } : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = await LedgerEntry.find(query).lean() as any[];

    // Running balance is per company — group, compute chronologically, then
    // flatten back out sorted newest-first (matching other list endpoints).
    const byCompany = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byCompany.get(e.companyId) ?? [];
      list.push(e);
      byCompany.set(e.companyId, list);
    }
    const withBalances = Array.from(byCompany.values()).flatMap(group => computeRunningBalances(group));
    withBalances.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });

    return NextResponse.json(withBalances);
  } catch (err) {
    console.error('[GET /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.companyId || !body.type || !body.date) {
      return NextResponse.json({ error: 'companyId, type and date are required' }, { status: 400 });
    }

    if (body.type === 'Purchase') {
      const err = normalizePurchaseBody(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });

      // Server-assigned purchase invoice number (PB- prefix, so it can never
      // collide with the sales SV- sequence).
      if (!body.invoiceNumber || body.invoiceNumber === 'Pending…') {
        const count = await LedgerEntry.countDocuments({ type: 'Purchase' });
        body.invoiceNumber = `PB-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      }

      // Create/bump the real StockItem(s) first so stockItemId is persisted on the entry.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const company = await Company.findById(body.companyId).lean() as any;
      body.items = await applyStockForItems(body.companyId, company?.name || '', body.items, body.date);
    } else if (body.type === 'Payment') {
      body.amount = Number(body.amount) || 0;
      if (body.amount <= 0) {
        return NextResponse.json({ error: 'Payment amount must be above zero' }, { status: 400 });
      }
      if (!['Bank Transfer', 'Cheque', 'Cash', 'Other'].includes(body.method)) {
        return NextResponse.json({ error: 'A valid payment method is required' }, { status: 400 });
      }
      body.direction = body.direction === 'from_company' ? 'from_company' : 'to_company';
      body.items = undefined;
    } else {
      return NextResponse.json({ error: 'type must be Purchase or Payment' }, { status: 400 });
    }

    const entry = await LedgerEntry.create(body);

    // Worker B (labour agent) totals — mirror of the customer invoice flow
    if (body.type === 'Purchase' && body.workerBId) {
      await WorkerB.findByIdAndUpdate(body.workerBId, {
        $inc: { totalEarnings: body.workerBCharge ?? 0, totalDeals: 1 },
      });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
