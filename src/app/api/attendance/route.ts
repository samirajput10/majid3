import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/lib/models/Attendance';

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const workerId = searchParams.get('workerId');
    const query: Record<string, string> = {};
    if (date) query.date = date;
    if (workerId) query.workerId = workerId;
    const records = await Attendance.find(query).lean();
    return NextResponse.json(records);
  } catch (err) {
    console.error('[GET /api/attendance]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    // Upsert: one record per worker per day
    const record = await Attendance.findOneAndUpdate(
      { workerId: body.workerId, date: body.date },
      body,
      { upsert: true, new: true }
    );
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
  }
}
