// ─── Purchase-invoice body normalization ────────────────────────────────────
// Shared by the ledger POST and PUT routes. Mutates the request body in place
// (matching the routes' existing style): normalizes item lines and extra
// charges, then computes the money fields exactly like the customer invoice
// form does — subtotal = items + extra charges, amount (total) = subtotal −
// discount, balance = amount − amountPaid, status from balance.
// Returns an error message, or null when the body is valid.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePurchaseBody(body: any): string | null {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'At least one item is required for a purchase';
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body.items = body.items.map((it: any) => ({
    name: it.name,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    amount: (Number(it.qty) || 0) * (Number(it.rate) || 0),
    stockItemId: it.stockItemId || '',
    category: it.category || 'Steel',
    grade: it.grade || '',
    unit: it.unit || 'piece',
    quantityUnits: Number(it.quantityUnits) || 0,
    batchNumber: it.batchNumber || '',
    location: it.location || '',
    notes: it.notes || '',
  }));
  if (body.items.some((it: { name: string; qty: number }) => !it.name || it.qty <= 0)) {
    return 'Each item needs a name and a quantity above zero';
  }

  body.extraCharges = Array.isArray(body.extraCharges)
    ? body.extraCharges
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => String(c.description ?? '').trim())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({ description: String(c.description).trim(), amount: Number(c.amount) || 0 }))
    : undefined;
  if (body.extraCharges && body.extraCharges.length === 0) body.extraCharges = undefined;

  const itemsTotal = body.items.reduce((s: number, it: { amount: number }) => s + it.amount, 0);
  const extraTotal = (body.extraCharges ?? []).reduce((s: number, c: { amount: number }) => s + c.amount, 0);
  const subtotal = itemsTotal + extraTotal;
  body.discount = Number(body.discount) || 0;
  body.discountType = body.discountType === 'percent' ? 'percent' : 'flat';
  const discountAmt = body.discountType === 'percent' ? subtotal * (body.discount / 100) : body.discount;

  body.subtotal = subtotal;
  body.amount = Math.max(0, subtotal - discountAmt);
  body.amountPaid = Number(body.amountPaid) || 0;
  body.balance = Math.max(0, body.amount - body.amountPaid);
  body.status = body.balance === 0 ? 'Paid' : body.amountPaid > 0 ? 'Partial' : 'Pending';
  body.vehicleNumber = body.vehicleNumber || '';
  body.dueDate = body.dueDate || '';
  body.workerBId = body.workerBId || '';
  body.workerBName = body.workerBName || '';
  body.workerBCharge = Number(body.workerBCharge) || 0;
  body.method = undefined;
  body.reference = '';
  return null;
}
