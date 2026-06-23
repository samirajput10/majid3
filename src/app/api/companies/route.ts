import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Company } from '@/lib/models/Company';

export async function GET() {
  try {
    await connectDB();
    const companies = await Company.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(companies);
  } catch (err) {
    console.error('[GET /api/companies]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const company = await Company.create(body);
    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error('[POST /api/companies]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
