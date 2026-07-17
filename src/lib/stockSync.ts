// ─── Ledger purchase ↔ Stock sync ──────────────────────────────────────────
// Shared by the ledger POST and PUT/DELETE routes so a Purchase entry's items
// always map to real StockItem records (bump an existing one, or create a new
// one) instead of the old fuzzy name-matching guess.
import { StockItem } from '@/lib/models/StockItem';
import { getStockStatus } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyStockForItems(
  companyId: string,
  companyName: string,
  items: any[],
  entryDate: string
) {
  const results = [];
  for (const item of items ?? []) {
    const qty = Number(item.qty) || 0;
    const quantityUnits = Number(item.quantityUnits) || 0;
    const category = item.category || 'Steel';

    if (item.stockItemId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await StockItem.findByIdAndUpdate(
        item.stockItemId,
        { $inc: { weightKg: qty, quantity: quantityUnits } },
        { new: true }
      ).lean() as any;
      if (updated) {
        await StockItem.findByIdAndUpdate(item.stockItemId, {
          status: getStockStatus(updated.weightKg, updated.category),
        });
      }
      results.push({ ...item, stockItemId: item.stockItemId });
    } else {
      const created = await StockItem.create({
        category,
        steelType: item.name,
        grade: item.grade || '',
        weightKg: qty,
        quantity: quantityUnits,
        unit: item.unit || 'piece',
        pricePerKg: Number(item.rate) || 0,
        companyId,
        companyName,
        batchNumber: item.batchNumber || '',
        dateAdded: entryDate,
        location: item.location || '',
        notes: item.notes || '',
        status: getStockStatus(qty, category),
      });
      results.push({ ...item, stockItemId: String(created._id) });
    }
  }
  return results;
}

// Best-effort: subtract what a Purchase entry's items previously added back
// out of stock. Uses an atomic $inc (not read-then-write) so two reversals
// racing on the same StockItem — e.g. an edit and a delete landing close
// together — can't lose one of the updates. Clamped at 0 afterwards — if the
// stock was already partially sold or scrapped since the purchase, we don't
// leave it negative.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reverseStockForItems(items: any[]) {
  for (const item of items ?? []) {
    if (!item.stockItemId) continue;
    try {
      const qty = Number(item.qty) || 0;
      const quantityUnits = Number(item.quantityUnits) || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await StockItem.findByIdAndUpdate(
        item.stockItemId,
        { $inc: { weightKg: -qty, quantity: -quantityUnits } },
        { new: true }
      ).lean() as any;
      if (!updated) continue;
      const clampedWeight = Math.max(0, updated.weightKg);
      const clampedQty = Math.max(0, updated.quantity);
      await StockItem.findByIdAndUpdate(item.stockItemId, {
        weightKg: clampedWeight,
        quantity: clampedQty,
        status: getStockStatus(clampedWeight, updated.category),
      });
    } catch (err) {
      console.error('[stockSync] reversal skipped for item', item, err);
    }
  }
}
