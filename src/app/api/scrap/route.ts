import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Scrap } from '@/lib/models/Scrap';
import { StockItem } from '@/lib/models/StockItem';

export async function GET() {
  try {
    await connectDB();
    const list = await Scrap.find().sort({ date: -1, _id: -1 }).lean();
    return NextResponse.json(list);
  } catch (err) {
    console.error('[GET /api/scrap]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const qty = Number(body.weightKg);

    if (!body.stockItemId || !qty || qty <= 0) {
      return NextResponse.json({ error: 'A stock batch and a quantity above zero are required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stock = await StockItem.findById(body.stockItemId).lean() as any;
    if (!stock) {
      return NextResponse.json({ error: 'Stock batch not found' }, { status: 404 });
    }
    const unitWord = stock.category === 'Cement' ? 'packs' : 'kg';
    if (qty > stock.weightKg) {
      return NextResponse.json(
        { error: `Only ${stock.weightKg} ${unitWord} remaining in this batch — cannot scrap ${qty}` },
        { status: 400 }
      );
    }

    // Snapshot batch details server-side so the record stays accurate even
    // if the batch is edited or deleted later.
    const scrap = await Scrap.create({
      stockItemId: body.stockItemId,
      category: stock.category ?? 'Steel',
      steelType: stock.steelType,
      grade: stock.grade ?? '',
      weightKg: qty,
      unit: stock.unit,
      pricePerKg: stock.pricePerKg ?? 0,
      companyName: stock.companyName ?? '',
      batchNumber: stock.batchNumber ?? '',
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes ?? '',
    });

    // Deduct from the batch and refresh its status
    await StockItem.findByIdAndUpdate(body.stockItemId, { $inc: { weightKg: -qty } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await StockItem.findById(body.stockItemId).lean() as any;
    if (updated) {
      const lowThreshold = updated.category === 'Cement' ? 50 : 500;
      const status = updated.weightKg <= 0 ? 'Out of Stock'
        : updated.weightKg < lowThreshold ? 'Low Stock' : 'In Stock';
      await StockItem.findByIdAndUpdate(body.stockItemId, { status });
    }

    return NextResponse.json(scrap, { status: 201 });
  } catch (err) {
    console.error('[POST /api/scrap]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
