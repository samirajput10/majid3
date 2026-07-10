import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Scrap } from '@/lib/models/Scrap';
import { StockItem } from '@/lib/models/StockItem';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrap = await Scrap.findById(params.id).lean() as any;
    if (!scrap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Undo: put the scrapped quantity back into the batch (if it still exists)
    if (scrap.stockItemId && scrap.weightKg) {
      await StockItem.findByIdAndUpdate(scrap.stockItemId, { $inc: { weightKg: scrap.weightKg } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await StockItem.findById(scrap.stockItemId).lean() as any;
      if (updated) {
        const lowThreshold = updated.category === 'Cement' ? 50 : 500;
        const status = updated.weightKg <= 0 ? 'Out of Stock'
          : updated.weightKg < lowThreshold ? 'Low Stock' : 'In Stock';
        await StockItem.findByIdAndUpdate(scrap.stockItemId, { status });
      }
    }

    await Scrap.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/scrap]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
