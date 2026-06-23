import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Customer } from '@/lib/models/Customer';

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const query = phone ? { phone: { $regex: phone.replace(/[-\s]/g, ''), $options: 'i' } } : {};
    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(customers);
  } catch (err) {
    console.error('[GET /api/customers]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const customer = await Customer.create(body);
    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
