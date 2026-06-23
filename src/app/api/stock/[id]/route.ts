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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const body = await req.json();
    const old = await StockItem.findById(params.id).lean() as any;
    const updated = await StockItem.findByIdAndUpdate(params.id, body, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const companyId = body.companyId || old?.companyId;
    if (companyId) await syncCompanyTotals(companyId);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update stock item' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const item = await StockItem.findById(params.id).lean() as any;
    await StockItem.findByIdAndDelete(params.id);
    if (item?.companyId) await syncCompanyTotals(item.companyId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete stock item' }, { status: 500 });
  }
}
