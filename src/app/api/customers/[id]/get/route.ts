import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Customer } from '@/lib/models/Customer';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const customer = await Customer.findById(params.id).lean();
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(customer);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}
