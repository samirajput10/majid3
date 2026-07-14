import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { LedgerEntry } from '@/lib/models/LedgerEntry';
import { StockItem } from '@/lib/models/StockItem';
import { computeRunningBalances } from '@/lib/ledger';

// ── Best-effort: bump an existing stock item's quantity when a purchase line
// item's name matches one (case-insensitive, scoped to this company). Never
// blocks or fails the purchase — this is a "nice to have" only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryBumpStock(companyId: string, items: any[]) {
  for (const item of items ?? []) {
    try {
      const name = String(item.name ?? '').trim().toLowerCase();
      if (!name || !item.qty) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = await StockItem.find({ companyId }).lean() as any[];
      const match = candidates.find(s => {
        const bare = String(s.steelType ?? '').trim().toLowerCase();
        const withGrade = s.grade ? `${bare} ${String(s.grade).trim().toLowerCase()}` : bare;
        return bare === name || withGrade === name;
      });
      if (!match) continue;

      await StockItem.findByIdAndUpdate(match._id, {
        $inc: { weightKg: item.qty, quantity: item.qty },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await StockItem.findById(match._id).lean() as any;
      if (updated) {
        const lowThreshold = updated.category === 'Cement' ? 50 : 500;
        const status = updated.weightKg <= 0 ? 'Out of Stock'
          : updated.weightKg < lowThreshold ? 'Low Stock' : 'In Stock';
        await StockItem.findByIdAndUpdate(match._id, { status });
      }
    } catch (err) {
      console.error('[POST /api/ledger] stock bump skipped for item', item, err);
    }
  }
}

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
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: 'At least one item is required for a purchase' }, { status: 400 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body.items = body.items.map((it: any) => ({
        name: it.name,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        amount: (Number(it.qty) || 0) * (Number(it.rate) || 0),
      }));
      if (body.items.some((it: { name: string; qty: number }) => !it.name || it.qty <= 0)) {
        return NextResponse.json({ error: 'Each item needs a name and a quantity above zero' }, { status: 400 });
      }
      body.amount = body.items.reduce((s: number, it: { amount: number }) => s + it.amount, 0);
      body.method = undefined;
      body.reference = '';
    } else if (body.type === 'Payment') {
      body.amount = Number(body.amount) || 0;
      if (body.amount <= 0) {
        return NextResponse.json({ error: 'Payment amount must be above zero' }, { status: 400 });
      }
      if (!['Bank Transfer', 'Cheque', 'Cash', 'Other'].includes(body.method)) {
        return NextResponse.json({ error: 'A valid payment method is required' }, { status: 400 });
      }
      body.items = undefined;
    } else {
      return NextResponse.json({ error: 'type must be Purchase or Payment' }, { status: 400 });
    }

    const entry = await LedgerEntry.create(body);

    if (body.type === 'Purchase') {
      await tryBumpStock(body.companyId, body.items);
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
