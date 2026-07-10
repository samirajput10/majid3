import { StockItem } from '@/lib/models/StockItem';

// ── Cost snapshot ────────────────────────────────────────────────────────────
// Stamps each invoice item with the batch's current purchase rate so profit
// stays accurate even if the batch price is edited or deleted later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function snapshotItemCosts(items: any[]) {
  for (const item of items ?? []) {
    if (!item.stockItemId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stock = await StockItem.findById(item.stockItemId).lean() as any;
    if (stock) item.costPerKg = stock.pricePerKg ?? 0;
  }
}

// ── Stock availability check ────────────────────────────────────────────────
// Returns human-readable shortage messages for invoice items that request
// more than their stock batch has. `oldByBatch` credits back quantities
// already held by the invoice being edited.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function stockShortages(items: any[], oldByBatch: Record<string, number> = {}) {
  const requested: Record<string, number> = {};
  for (const item of items ?? []) {
    if (!item.stockItemId || !item.weightKg) continue;
    requested[item.stockItemId] = (requested[item.stockItemId] ?? 0) + item.weightKg;
  }
  const shortages: string[] = [];
  for (const [id, qty] of Object.entries(requested)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stock = await StockItem.findById(id).lean() as any;
    if (!stock) { shortages.push('a selected stock batch no longer exists'); continue; }
    const available = (stock.weightKg ?? 0) + (oldByBatch[id] ?? 0);
    if (qty > available) {
      const unit = stock.category === 'Cement' ? 'packs' : 'kg';
      shortages.push(
        `${stock.steelType}${stock.grade ? ` (${stock.grade})` : ''}: only ${available} ${unit} in stock, invoice needs ${qty}`
      );
    }
  }
  return shortages;
}
