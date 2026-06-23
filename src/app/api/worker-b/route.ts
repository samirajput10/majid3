import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { WorkerB } from '@/lib/models/WorkerB';

export async function GET() {
  try {
    await connectDB();
    const list = await WorkerB.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    body.createdAt = new Date().toISOString().split('T')[0];
    body.totalEarnings = 0;
    body.totalPaid = body.totalPaid ?? 0;
    body.totalDeals = 0;
    const wb = await WorkerB.create(body);
    return NextResponse.json(wb, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
