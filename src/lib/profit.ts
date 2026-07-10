import type { Invoice, StockItem } from './types';

export interface InvoiceProfit {
  revenue: number;     // what the customer was billed (invoice total)
  cost: number;        // what the sold stock originally cost
  itemProfit: number;  // Σ (sell rate − buy rate) × qty
  discount: number;    // discount given on this invoice
  profit: number;      // itemProfit − discount
}

/**
 * Profit for one invoice: (sell rate − buy rate) × quantity per item, minus
 * the invoice discount. Uses the buy rate snapshotted on the item at save
 * time (costPerKg); older invoices without a snapshot fall back to the
 * batch's current price. Extra charges (labour/transport) are excluded.
 */
export function invoiceProfit(inv: Invoice, stockItems: StockItem[]): InvoiceProfit {
  let cost = 0;
  let itemProfit = 0;
  for (const it of inv.items ?? []) {
    const costRate = it.costPerKg && it.costPerKg > 0
      ? it.costPerKg
      : (stockItems.find(s => s.id === it.stockItemId)?.pricePerKg ?? 0);
    cost += costRate * it.weightKg;
    itemProfit += (it.pricePerKg - costRate) * it.weightKg;
  }
  const discount = inv.discountType === 'percent'
    ? inv.subtotal * inv.discount / 100
    : inv.discount;
  return { revenue: inv.total, cost, itemProfit, discount, profit: itemProfit - discount };
}
