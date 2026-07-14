import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Expense } from '@/lib/models/Expense';

export async function GET() {
  try {
    await connectDB();
    const expenses = await Expense.find().sort({ date: -1, createdAt: -1 }).lean();
    return NextResponse.json(expenses);
  } catch (err) {
    console.error('[GET /api/expenses]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const expense = await Expense.create({
      description: String(body.description).trim(),
      amount,
      date: body.date || new Date().toISOString().split('T')[0],
      note: body.note ?? '',
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error('[POST /api/expenses]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
