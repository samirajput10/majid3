import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { StockItem } from '@/lib/models/StockItem';
import { Company } from '@/lib/models/Company';

async function syncCompanyTotals(companyId: string) {
  const items = await StockItem.find({ companyId }).lean();
  const totalPurchased = items.reduce((s: number, i: any) => s + (i.weightKg || 0), 0);
  const totalCost = items.reduce((s: number, i: any) => s + (i.weightKg || 0) * (i.pricePerKg || 0), 0);
  await Company.findByIdAndUpdate(companyId, { totalPurchased, totalCost });
}

export async function GET() {
  try {
    await connectDB();
    const items = await StockItem.find().sort({ dateAdded: -1 }).lean();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/stock]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const item = await StockItem.create(body);
    if (body.companyId) await syncCompanyTotals(body.companyId);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[POST /api/stock]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
