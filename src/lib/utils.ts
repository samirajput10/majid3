import { clsx, type ClassValue } from 'clsx';

// ─── Class merging ────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ─── Currency formatting ──────────────────────────────────────────────────────
// Always the full number — no Cr/L abbreviation anywhere in the app.
export function formatCurrency(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
}

export const formatCurrencyFull = formatCurrency;

// ─── Weight formatting ────────────────────────────────────────────────────────
export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} ton`;
  return `${kg.toLocaleString()} kg`;
}

// ─── Date formatting ──────────────────────────────────────────────────────────
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── ID generation ────────────────────────────────────────────────────────────
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateInvoiceNumber(existingInvoices: { invoiceNumber: string }[]): string {
  const year = new Date().getFullYear();
  const nums = existingInvoices
    .map(i => parseInt(i.invoiceNumber.split('-').pop() || '0'))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `SV-${year}-${String(next).padStart(4, '0')}`;
}

// ─── Stock status helper ──────────────────────────────────────────────────────
// Steel is measured in kg, cement in packs — so each uses its own "low" threshold.
export function getStockStatus(
  qty: number,
  category: 'Steel' | 'Cement' = 'Steel'
): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (qty <= 0) return 'Out of Stock';
  const lowThreshold = category === 'Cement' ? 50 : 2000;
  if (qty < lowThreshold) return 'Low Stock';
  return 'In Stock';
}

// ─── Invoice status helpers ───────────────────────────────────────────────────
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    'Paid':      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Pending':   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Partial':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Cancelled': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'In Stock':  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Low Stock': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Out of Stock': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Active':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Inactive':  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    'Payable':   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Advance':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Settled':   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

// ─── Salary calculation ───────────────────────────────────────────────────────
export function calculateMonthlySalary(
  salaryType: 'Daily' | 'Weekly' | 'Monthly',
  rate: number,
  daysPresent: number
): number {
  if (salaryType === 'Monthly') return rate;
  if (salaryType === 'Weekly')  return (rate / 7) * daysPresent;
  return rate * daysPresent; // Daily
}

// ─── Search helpers ───────────────────────────────────────────────────────────
export function normalizePhone(phone: string): string {
  return phone.replace(/[-\s]/g, '');
}

export function matchPhone(stored: string, query: string): boolean {
  return normalizePhone(stored).includes(normalizePhone(query));
}

// ─── Chart colours ────────────────────────────────────────────────────────────
export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];
