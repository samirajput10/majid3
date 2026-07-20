import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { LedgerEntry } from '@/lib/models/LedgerEntry';
import { Company } from '@/lib/models/Company';
import { WorkerB } from '@/lib/models/WorkerB';
import { applyStockForItems, reverseStockForItems } from '@/lib/stockSync';
import { normalizePurchaseBody } from '@/lib/purchase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reverseWorkerB(entry: any) {
  if (entry?.type !== 'Purchase' || !entry.workerBId) return;
  await WorkerB.findByIdAndUpdate(entry.workerBId, {
    $inc: { totalEarnings: -(entry.workerBCharge ?? 0), totalDeals: -1 },
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await LedgerEntry.findById(params.id).lean() as any;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Validate BEFORE touching stock/worker totals, so a bad edit can't leave
    // the old entry's effects half-reversed.
    if (body.type === 'Purchase') {
      const err = normalizePurchaseBody(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      // Keep the entry's invoice number stable across edits; backfill one for
      // purchases created before invoice numbers existed.
      if (existing.invoiceNumber) {
        body.invoiceNumber = existing.invoiceNumber;
      } else if (!body.invoiceNumber || body.invoiceNumber === 'Pending…') {
        const count = await LedgerEntry.countDocuments({ type: 'Purchase' });
        body.invoiceNumber = `PB-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      }
    } else if (body.type === 'Payment') {
      body.amount = Number(body.amount) || 0;
      if (body.amount <= 0) {
        return NextResponse.json({ error: 'Payment amount must be above zero' }, { status: 400 });
      }
      if (!['Bank Transfer', 'Cheque', 'Cash', 'Other'].includes(body.method)) {
        return NextResponse.json({ error: 'A valid payment method is required' }, { status: 400 });
      }
      body.items = undefined;
    }

    // Undo whatever effects the old version of this entry had before applying
    // the new one — keeps stock and worker totals in sync across edits.
    if (existing.type === 'Purchase') {
      await reverseStockForItems(existing.items ?? []);
      await reverseWorkerB(existing);
    }

    if (body.type === 'Purchase') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const company = await Company.findById(body.companyId ?? existing.companyId).lean() as any;
      body.items = await applyStockForItems(
        body.companyId ?? existing.companyId,
        company?.name || '',
        body.items,
        body.date ?? existing.date
      );
    }

    const updated = await LedgerEntry.findByIdAndUpdate(params.id, body, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.type === 'Purchase' && body.workerBId) {
      await WorkerB.findByIdAndUpdate(body.workerBId, {
        $inc: { totalEarnings: body.workerBCharge ?? 0, totalDeals: 1 },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await LedgerEntry.findById(params.id).lean() as any;
    if (existing?.type === 'Purchase') {
      await reverseStockForItems(existing.items ?? []);
      await reverseWorkerB(existing);
    }
    const deleted = await LedgerEntry.findByIdAndDelete(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
