// ─── Company payment ledger — balance math ─────────────────────────────────
// Pure, framework-agnostic helpers shared by the API routes (server) and the
// frontend (display). No Mongoose/Next imports here on purpose.

export type LedgerBalanceLabel = 'Payable' | 'Advance' | 'Settled';

interface EntryLike {
  type: string;      // 'Purchase' | 'Payment'
  amount: number;
  date: string;       // YYYY-MM-DD
  createdAt?: string | Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chronoKey(e: any): string {
  const created = e.createdAt ? new Date(e.createdAt).toISOString() : '';
  return `${e.date}|${created}`;
}

/**
 * Sorts entries chronologically (oldest first) and attaches `balanceAfter` —
 * the running balance immediately after each entry. Purchases add to what we
 * owe, Payments subtract. Returns a NEW array in chronological (oldest-first)
 * order; sort again for display if you need newest-first.
 */
export function computeRunningBalances<T extends EntryLike>(entries: T[]): (T & { balanceAfter: number })[] {
  const sorted = [...entries].sort((a, b) => chronoKey(a).localeCompare(chronoKey(b)));
  let balance = 0;
  return sorted.map(e => {
    balance += e.type === 'Purchase' ? e.amount : -e.amount;
    return { ...e, balanceAfter: balance };
  });
}

export function getBalanceLabel(balance: number): LedgerBalanceLabel {
  if (balance > 0) return 'Payable';
  if (balance < 0) return 'Advance';
  return 'Settled';
}

export interface LedgerSummary {
  balance: number;       // always shown as a positive number in the UI (see label)
  label: LedgerBalanceLabel;
  totalPurchases: number;
  totalPayments: number;
  entryCount: number;
}

export function getLedgerSummary<T extends EntryLike>(entries: T[]): LedgerSummary {
  const totalPurchases = entries.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.amount, 0);
  const totalPayments = entries.filter(e => e.type === 'Payment').reduce((s, e) => s + e.amount, 0);
  const balance = totalPurchases - totalPayments;
  return {
    balance: Math.abs(balance),
    label: getBalanceLabel(balance),
    totalPurchases,
    totalPayments,
    entryCount: entries.length,
  };
}
