import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Invoice } from '@/lib/models/Invoice';
import { Customer } from '@/lib/models/Customer';
import { StockItem } from '@/lib/models/StockItem';
import { WorkerB } from '@/lib/models/WorkerB';
import { stockShortages } from '@/lib/stockGuard';

// ── Deduct stock for each invoice item ──────────────────────────────────────
async function deductStock(items: any[]) {
  for (const item of items) {
    if (!item.stockItemId || !item.weightKg) continue;
    await StockItem.findByIdAndUpdate(item.stockItemId, {
      $inc: { weightKg: -item.weightKg },
    });
    // Update status after deduction
    const updated = await StockItem.findById(item.stockItemId).lean() as any;
    if (updated) {
      const lowThreshold = updated.category === 'Cement' ? 50 : 500;
      const status = updated.weightKg <= 0 ? 'Out of Stock'
        : updated.weightKg < lowThreshold ? 'Low Stock' : 'In Stock';
      await StockItem.findByIdAndUpdate(item.stockItemId, { status });
    }
  }
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const query = customerId ? { customerId } : {};
    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(invoices);
  } catch (err) {
    console.error('[GET /api/invoices]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    // Refuse to sell more than the stock batches hold
    const shortages = await stockShortages(body.items);
    if (shortages.length) {
      return NextResponse.json(
        { error: 'Not enough stock — ' + shortages.join('; ') },
        { status: 400 }
      );
    }

    // Auto-generate invoice number
    const count = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    body.invoiceNumber = `SV-${year}-${String(count + 1).padStart(4, '0')}`;
    body.createdAt = new Date().toISOString().split('T')[0];

    const invoice = await Invoice.create(body);

    // Deduct purchased stock from inventory
    if (body.items?.length) await deductStock(body.items);

    // Update customer totals
    await Customer.findByIdAndUpdate(body.customerId, {
      $inc: {
        totalPurchases: 1,
        totalSpent: body.total,
        pendingBalance: body.balance,
      },
    });

    // Update Worker B totals
    if (body.workerBId) {
      await WorkerB.findByIdAndUpdate(body.workerBId, {
        $inc: { totalEarnings: body.workerBCharge ?? 0, totalDeals: 1 },
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    console.error('[POST /api/invoices]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
