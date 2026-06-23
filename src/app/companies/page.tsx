'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Building2, Edit2, Trash2, BarChart2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency, formatWeight, formatDate } from '@/lib/utils';
import type { Company } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };

export default function CompaniesPage() {
  const { state, addCompany, updateCompany, deleteCompany } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewId, setViewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = state.companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setModalOpen(true); };
  const openEdit = (c: Company) => {
    setEditTarget(c);
    setForm({ name: c.name, contactPerson: c.contactPerson, phone: c.phone, address: c.address, email: c.email ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateCompany({ ...editTarget, ...form });
      } else {
        await addCompany(form);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const viewCompany = viewId ? state.companies.find(c => c.id === viewId) : null;

  // ── Calculate purchased totals dynamically from stock items ───────────────
  const companyStats = useMemo(() => {
    const map: Record<string, { kg: number; cost: number }> = {};
    state.stockItems.forEach(s => {
      if (!map[s.companyId]) map[s.companyId] = { kg: 0, cost: 0 };
      map[s.companyId].kg   += s.weightKg;
      map[s.companyId].cost += s.weightKg * s.pricePerKg;
    });
    return map;
  }, [state.stockItems]);
  const getPurchased = (id: string) => companyStats[id] ?? { kg: 0, cost: 0 };
  const companyStock = viewId ? state.stockItems.filter(s => s.companyId === viewId) : [];

  const totalStock = state.stockItems.reduce((s, i) => s + i.weightKg, 0);
  const totalCost = Object.values(companyStats).reduce((s, v) => s + v.cost, 0);

  const chartData = state.companies.map(c => ({
    name: c.name.split(' ')[0],
    purchased: (getPurchased(c.id).kg) / 1000,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage steel suppliers and track purchases</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Company</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Companies" value={state.companies.length} icon={Building2}
          iconColor="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
        <StatCard title="Total Stock" value={formatWeight(totalStock)} icon={BarChart2}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Total Purchased" value={formatCurrency(totalCost)} icon={Building2}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Avg per Company" value={formatCurrency(totalCost / (state.companies.length || 1))} icon={Building2}
          iconColor="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
      </div>

      {chartData.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Company-wise Stock (tons)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v.toFixed(1)} ton`, 'Purchased']} />
              <Bar dataKey="purchased" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">All Companies ({filtered.length})</h2>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..." className="input pl-8 py-1.5" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No companies found" description="Add your first steel supplier to get started."
            action={<button onClick={openAdd} className="btn-primary text-sm">Add Company</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="table-header">Company</th><th className="table-header">Contact</th>
                <th className="table-header">Phone</th><th className="table-header">Address</th>
                <th className="table-header">Total Purchased</th><th className="table-header">Total Cost</th>
                <th className="table-header">Added</th><th className="table-header">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 size={13} className="text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{c.contactPerson}</td>
                    <td className="table-cell"><a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a></td>
                    <td className="table-cell text-gray-500 max-w-[160px] truncate">{c.address}</td>
                    <td className="table-cell font-medium">{formatWeight(getPurchased(c.id).kg)}</td>
                    <td className="table-cell font-medium text-green-600 dark:text-green-400">{formatCurrency(getPurchased(c.id).cost)}</td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewId(c.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><BarChart2 size={14} /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Company' : 'Add New Company'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.name || !form.phone || saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Company'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Company Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ittefaq Steel Mills" className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact Person</label><input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Full name" className="input" /></div>
            <div><label className="label">Phone *</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-0000000" className="input" /></div>
          </div>
          <div><label className="label">Email</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="company@example.com" className="input" type="email" /></div>
          <div><label className="label">Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" rows={2} className="input resize-none" /></div>
        </div>
      </Modal>

      {viewCompany && (
        <Modal open={!!viewId} onClose={() => setViewId(null)} title={viewCompany.name} subtitle="Company details and stock" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Contact Person', value: viewCompany.contactPerson },
                { label: 'Phone', value: viewCompany.phone },
                { label: 'Total Purchased', value: formatWeight(getPurchased(viewCompany.id).kg) },
                { label: 'Total Cost', value: formatCurrency(getPurchased(viewCompany.id).cost) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Stock</h3>
              {companyStock.length === 0 ? <p className="text-sm text-gray-400">No active stock records.</p> : (
                <table className="w-full text-sm">
                  <thead><tr><th className="table-header">Type</th><th className="table-header">Batch</th><th className="table-header">Weight</th><th className="table-header">Status</th></tr></thead>
                  <tbody>
                    {companyStock.map(s => (
                      <tr key={s.id} className="table-row">
                        <td className="table-cell font-medium">{s.steelType}</td>
                        <td className="table-cell text-gray-400 text-xs">{s.batchNumber}</td>
                        <td className="table-cell">{formatWeight(s.weightKg)}</td>
                        <td className="table-cell"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'In Stock' ? 'bg-green-100 text-green-700' : s.status === 'Low Stock' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteCompany(deleteId); }}
        title="Delete Company" message="This will remove the company and all its records." />
    </div>
  );
}
