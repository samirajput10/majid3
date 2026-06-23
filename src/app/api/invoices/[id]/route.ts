import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Invoice } from '@/lib/models/Invoice';
import { StockItem } from '@/lib/models/StockItem';
import { WorkerB } from '@/lib/models/WorkerB';

async function adjustStock(items: any[], direction: 1 | -1) {
  for (const item of items) {
    if (!item.stockItemId || !item.weightKg) continue;
    await StockItem.findByIdAndUpdate(item.stockItemId, {
      $inc: { weightKg: direction * item.weightKg },
    });
    const updated = await StockItem.findById(item.stockItemId).lean() as any;
    if (updated) {
      const lowThreshold = updated.category === 'Cement' ? 50 : 500;
      const status = updated.weightKg <= 0 ? 'Out of Stock'
        : updated.weightKg < lowThreshold ? 'Low Stock' : 'In Stock';
      await StockItem.findByIdAndUpdate(item.stockItemId, { status });
    }
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();

    // Restore old stock, then deduct new stock
    const old = await Invoice.findById(params.id).lean() as any;
    if (old?.items?.length) await adjustStock(old.items, +1);   // restore
    if (body.items?.length)  await adjustStock(body.items,  -1); // deduct new

    const updated = await Invoice.findByIdAndUpdate(params.id, body, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/invoices]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const invoice = await Invoice.findById(params.id).lean() as any;

    // Restore stock before deleting
    if (invoice?.items?.length) await adjustStock(invoice.items, +1);

    // Reverse Worker B totals
    if (invoice?.workerBId) {
      await WorkerB.findByIdAndUpdate(invoice.workerBId, {
        $inc: { totalEarnings: -(invoice.workerBCharge ?? 0), totalDeals: -1 },
      });
    }

    await Invoice.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/invoices]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
