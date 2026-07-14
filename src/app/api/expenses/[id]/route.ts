import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Expense } from '@/lib/models/Expense';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.description || !String(body.description).trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be above zero' }, { status: 400 });
    }

    const updated = await Expense.findByIdAndUpdate(params.id, {
      description: String(body.description).trim(),
      amount,
      date: body.date,
      note: body.note ?? '',
    }, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/expenses]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const deleted = await Expense.findByIdAndDelete(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/expenses]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
