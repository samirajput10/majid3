'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import StatCard from '@/components/ui/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Package, Building2, Users, FileText, HardHat,
  AlertTriangle, TrendingUp, DollarSign, Clock,
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';
import { CHART_COLORS } from '@/lib/utils';

export default function DashboardPage() {
  const { state, getDashboardStats } = useApp();
  const stats = getDashboardStats();
  const [showPending, setShowPending] = useState(false);

  const pendingInvoices = state.invoices
    .filter(i => i.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  // Group by customer
  const pendingByCustomer = pendingInvoices.reduce<Record<string, { name: string; phone: string; invoices: typeof pendingInvoices }>>((acc, inv) => {
    if (!acc[inv.customerId]) acc[inv.customerId] = { name: inv.customerName, phone: inv.customerPhone, invoices: [] };
    acc[inv.customerId].invoices.push(inv);
    return acc;
  }, {});

  const recentInvoices = [...state.invoices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const lowStockItems = state.stockItems.filter(s => s.status !== 'In Stock');

  // ── Dynamic: last 6 months revenue from real invoices ────────────────────
  const monthlyRevenueData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) };
    });
    const revenueMap: Record<string, number> = {};
    state.invoices.forEach(inv => {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      revenueMap[key] = (revenueMap[key] ?? 0) + inv.total;
    });
    return months.map(m => ({ month: m.label, revenue: revenueMap[`${m.year}-${m.month}`] ?? 0 }));
  }, [state.invoices]);

  // ── Dynamic: stock distribution from real inventory ───────────────────────
  const stockPieData = useMemo(() => {
    const typeMap: Record<string, number> = {};
    state.stockItems.forEach(s => {
      typeMap[s.steelType] = (typeMap[s.steelType] ?? 0) + s.weightKg;
    });
    return Object.entries(typeMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [state.stockItems]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Welcome back — here&apos;s your warehouse overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Stock"
          value={formatWeight(stats.totalStockKg)}
          sub={formatCurrency(stats.totalStockValue)}
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          trend={{ value: 8.2, label: 'vs last month' }}
        />
        <StatCard
          title="Companies"
          value={stats.totalCompanies}
          sub="Active suppliers"
          icon={Building2}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 dark:bg-purple-900/20"
        />
        <StatCard
          title="Customers"
          value={stats.totalCustomers}
          sub="Registered buyers"
          icon={Users}
          iconColor="text-teal-600"
          iconBg="bg-teal-50 dark:bg-teal-900/20"
          trend={{ value: 12, label: 'this month' }}
        />
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          sub={`${formatCurrency(stats.pendingPayments)} pending`}
          icon={FileText}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          sub="This month"
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBg="bg-green-50 dark:bg-green-900/20"
          trend={{ value: 14.5, label: 'vs last month' }}
        />
        <StatCard
          title="Monthly Profit"
          value={formatCurrency(stats.monthlyProfit)}
          sub={`${formatCurrency(stats.totalProfit)} all time — click for details`}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          onClick={() => { window.location.href = '/profit'; }}
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(stats.pendingPayments)}
          sub={`${pendingInvoices.length} invoices — click to view`}
          icon={DollarSign}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-900/20"
          onClick={() => setShowPending(true)}
        />
        <StatCard
          title="Active Workers"
          value={stats.activeWorkers}
          sub="On payroll"
          icon={HardHat}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50 dark:bg-yellow-900/20"
        />
        <StatCard
          title="Low / Out of Stock"
          value={stats.lowStockItems}
          sub="Items need attention"
          icon={AlertTriangle}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Bar Chart */}
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Monthly Revenue</h2>
              <p className="text-xs text-gray-400">Last 6 months</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyRevenueData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => [formatCurrency(v), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Distribution Pie */}
        <div className="card p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Stock by Type</h2>
            <p className="text-xs text-gray-400">Current warehouse distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={stockPieData}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {stockPieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [formatWeight(v), 'Stock']}
              />
              <Legend
                formatter={(v) => <span className="text-xs text-gray-500 dark:text-gray-400">{v}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
            <Link href="/invoices" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Invoice</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell font-medium text-blue-600 dark:text-blue-400 text-xs">{inv.invoiceNumber}</td>
                  <td className="table-cell">{inv.customerName}</td>
                  <td className="table-cell font-medium">{formatCurrency(inv.total)}</td>
                  <td className="table-cell"><Badge label={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Low Stock Alerts */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Stock Alerts
              {lowStockItems.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">{lowStockItems.length}</span>
              )}
            </h2>
            <Link href="/inventory" className="text-xs text-blue-600 hover:underline">Manage →</Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-gray-400">
              <Package size={16} /> All stock levels are healthy.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Type</th>
                  <th className="table-header">Stock</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell font-medium">{item.steelType}</td>
                    <td className="table-cell">{formatWeight(item.weightKg)}</td>
                    <td className="table-cell text-xs text-gray-400">{item.companyName}</td>
                    <td className="table-cell"><Badge label={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Company Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Company-wise Purchase Summary</h2>
          <Link href="/companies" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Company</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Total Purchased</th>
                <th className="table-header">Total Cost</th>
                <th className="table-header">Since</th>
              </tr>
            </thead>
            <tbody>
              {state.companies.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-medium">{c.name}</td>
                  <td className="table-cell text-gray-400">{c.contactPerson}</td>
                  <td className="table-cell">{formatWeight(c.totalPurchased)}</td>
                  <td className="table-cell font-medium text-green-600 dark:text-green-400">{formatCurrency(c.totalCost)}</td>
                  <td className="table-cell text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* ─── Pending Payments Modal ─── */}
      <Modal
        open={showPending}
        onClose={() => setShowPending(false)}
        title="Pending Payments"
        subtitle={`${pendingInvoices.length} invoices · Total outstanding: ${formatCurrency(stats.pendingPayments)}`}
        size="xl"
        footer={<button onClick={() => setShowPending(false)} className="btn-primary">Close</button>}
      >
        {pendingInvoices.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending payments — all invoices are settled!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(pendingByCustomer).map(({ name, phone, invoices }) => {
              const customerTotal = invoices.reduce((s, i) => s + i.balance, 0);
              return (
                <div key={phone} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* Customer header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/40">
                    <div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
                      <span className="text-xs text-gray-400 ml-2">{phone}</span>
                    </div>
                    <span className="text-sm font-bold text-red-500">{formatCurrency(customerTotal)}</span>
                  </div>
                  {/* Invoices */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="table-header">Invoice #</th>
                        <th className="table-header">Date</th>
                        <th className="table-header text-right">Total</th>
                        <th className="table-header text-right">Paid</th>
                        <th className="table-header text-right">Balance</th>
                        <th className="table-header">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id} className="table-row">
                          <td className="table-cell font-medium text-blue-600 dark:text-blue-400 text-xs">{inv.invoiceNumber}</td>
                          <td className="table-cell text-xs text-gray-400">{formatDate(inv.createdAt)}</td>
                          <td className="table-cell text-right">{formatCurrency(inv.total)}</td>
                          <td className="table-cell text-right text-green-600">{formatCurrency(inv.amountPaid)}</td>
                          <td className="table-cell text-right font-bold text-red-500">{formatCurrency(inv.balance)}</td>
                          <td className="table-cell"><Badge label={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
