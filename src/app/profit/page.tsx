'use client';

import { useMemo, useState } from 'react';
import { Search, TrendingUp, DollarSign, Percent, FileText, Receipt } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency, formatCurrencyFull, formatDate } from '@/lib/utils';
import { invoiceProfit } from '@/lib/profit';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export default function ProfitPage() {
  const { state } = useApp();
  const [search, setSearch] = useState('');

  // Profit per invoice, newest first
  const rows = useMemo(() =>
    [...state.invoices]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(inv => ({ inv, p: invoiceProfit(inv, state.stockItems) })),
    [state.invoices, state.stockItems]
  );

  const filtered = rows.filter(({ inv }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
  });

  const grossProfit = rows.reduce((s, r) => s + r.p.profit, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.p.revenue, 0);
  const now = new Date();
  const grossMonthProfit = rows
    .filter(({ inv }) => {
      const d = new Date(inv.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, r) => s + r.p.profit, 0);

  // Expenses reduce profit — tracked separately on the Expenses page
  const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const monthExpenses = state.expenses
    .filter(e => { const d = new Date(e.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((s, e) => s + e.amount, 0);

  const totalProfit = grossProfit - totalExpenses;
  const monthProfit = grossMonthProfit - monthExpenses;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Last 6 months profit chart — invoice profit for that month minus that month's expenses
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) };
    });
    const map: Record<string, number> = {};
    rows.forEach(({ inv, p }) => {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map[key] = (map[key] ?? 0) + p.profit;
    });
    state.expenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map[key] = (map[key] ?? 0) - e.amount;
    });
    return months.map(m => ({ month: m.label, profit: map[`${m.year}-${m.month}`] ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, state.expenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profit</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Profit = (sell rate − buy rate) × quantity, minus invoice discount and business expenses.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Net Profit" value={formatCurrency(totalProfit)}
          sub={`Gross ${formatCurrency(grossProfit)} − Expenses ${formatCurrency(totalExpenses)}`}
          icon={TrendingUp}
          iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-900/20" />
        <StatCard title="This Month" value={formatCurrency(monthProfit)} sub="Net of expenses" icon={TrendingUp}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} sub="Click to manage →" icon={Receipt}
          iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20"
          onClick={() => { window.location.href = '/expenses'; }} />
        <StatCard title="Profit Margin" value={`${margin.toFixed(1)}%`} sub="net, of revenue" icon={Percent}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign}
          iconColor="text-teal-600" iconBg="bg-teal-50 dark:bg-teal-900/20" />
      </div>

      {/* Monthly chart */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Monthly Profit</h2>
        <p className="text-xs text-gray-400 mb-4">Last 6 months</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', fontSize: 12 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [formatCurrencyFull(v), 'Profit']}
            />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {monthlyData.map((m, i) => (
                <Cell key={i} fill={m.profit >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-invoice table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Profit per Invoice</h2>
          <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, customer..." className="input pl-8 py-1.5" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Profit shows here once you create invoices." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header text-right">Revenue</th>
                  <th className="table-header text-right">Cost of Stock</th>
                  <th className="table-header text-right">Discount</th>
                  <th className="table-header text-right">Profit</th>
                  <th className="table-header text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ inv, p }) => {
                  const rowMargin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <tr key={inv.id} className="table-row">
                      <td className="table-cell font-semibold text-blue-600 dark:text-blue-400 text-xs">{inv.invoiceNumber}</td>
                      <td className="table-cell text-xs text-gray-400">{formatDate(inv.createdAt)}</td>
                      <td className="table-cell font-medium">{inv.customerName}</td>
                      <td className="table-cell text-right">{formatCurrency(p.revenue)}</td>
                      <td className="table-cell text-right text-gray-500">{formatCurrency(p.cost)}</td>
                      <td className="table-cell text-right text-orange-500">{p.discount > 0 ? `− ${formatCurrency(p.discount)}` : '—'}</td>
                      <td className={`table-cell text-right font-bold ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {formatCurrencyFull(p.profit)}
                      </td>
                      <td className={`table-cell text-right text-xs font-medium ${rowMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {rowMargin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
