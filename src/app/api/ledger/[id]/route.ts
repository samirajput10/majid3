import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { LedgerEntry } from '@/lib/models/LedgerEntry';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();

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
    }

    const updated = await LedgerEntry.findByIdAndUpdate(params.id, body, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const deleted = await LedgerEntry.findByIdAndDelete(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/ledger]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
