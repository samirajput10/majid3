import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Worker } from '@/lib/models/Worker';

export async function GET() {
  try {
    await connectDB();
    const workers = await Worker.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(workers);
  } catch (err) {
    console.error('[GET /api/workers]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const worker = await Worker.create(body);
    return NextResponse.json(worker, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 });
  }
}
