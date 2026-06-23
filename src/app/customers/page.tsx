'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, Users, Phone, MapPin, Edit2, Trash2, Eye, FileText } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, matchPhone } from '@/lib/utils';
import type { Customer } from '@/lib/types';

const EMPTY_FORM = { name: '', phone: '', address: '', email: '', city: '' };

export default function CustomersPage() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Handle phone deep-link from global search / dashboard
  useEffect(() => {
    const phone = searchParams.get('phone');
    if (phone) setSearch(phone);
  }, [searchParams]);

  const filtered = state.customers.filter(c => {
    if (!search) return true;
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      matchPhone(c.phone, search) ||
      (c.city ?? '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setModalOpen(true); };
  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, email: c.email ?? '', city: c.city ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    if (editTarget) {
      await updateCustomer({ ...editTarget, ...form });
    } else {
      await addCustomer(form);
    }
    setModalOpen(false);
  };

  const viewCustomer = viewId ? state.customers.find(c => c.id === viewId) : null;
  const customerInvoices = viewId
    ? [...state.invoices]
        .filter(i => i.customerId === viewId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const totalPending = state.customers.reduce((s, c) => s + c.pendingBalance, 0);
  const totalRevenue = state.customers.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage buyers and view their purchase history</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Customer</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={state.customers.length} icon={Users}
          iconColor="text-teal-600" iconBg="bg-teal-50 dark:bg-teal-900/20" />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={FileText}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Pending Balance" value={formatCurrency(totalPending)} icon={FileText}
          iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
        <StatCard
          title="Total Invoices"
          value={state.invoices.length}
          icon={FileText}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
        />
      </div>

      {/* Phone Search Highlight */}
      {search && filtered.length > 0 && matchPhone(filtered[0]?.phone ?? '', search) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 flex items-center gap-3">
          <Phone size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{filtered[0].name}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">{filtered[0].phone} · {filtered[0].city}</p>
          </div>
          <button onClick={() => setViewId(filtered[0].id)} className="btn-secondary text-xs py-1">
            View Profile
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">All Customers ({filtered.length})</h2>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="input pl-8 py-1.5"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Add your first customer to start creating invoices."
            action={<button onClick={openAdd} className="btn-primary text-sm">Add Customer</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">City</th>
                  <th className="table-header">Invoices</th>
                  <th className="table-header">Total Spent</th>
                  <th className="table-header">Pending</th>
                  <th className="table-header">Since</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{c.name[0]}</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a>
                    </td>
                    <td className="table-cell text-gray-400">{c.city || '—'}</td>
                    <td className="table-cell">{c.totalPurchases}</td>
                    <td className="table-cell font-medium text-green-600 dark:text-green-400">{formatCurrency(c.totalSpent)}</td>
                    <td className="table-cell">
                      {c.pendingBalance > 0 ? (
                        <span className="font-medium text-red-500">{formatCurrency(c.pendingBalance)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Cleared</span>
                      )}
                    </td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewId(c.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View Profile">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Customer' : 'Add New Customer'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.name || !form.phone}>
              {editTarget ? 'Save Changes' : 'Add Customer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone * (Search Key)</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-0000000" className="input" />
            </div>
            <div>
              <label className="label">City</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Lahore" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" type="email" className="input" />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" rows={2} className="input resize-none" />
          </div>
        </div>
      </Modal>

      {/* Customer Profile Modal */}
      {viewCustomer && (
        <Modal
          open={!!viewId}
          onClose={() => setViewId(null)}
          title={viewCustomer.name}
          subtitle={`${viewCustomer.phone} · ${viewCustomer.city ?? ''}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{viewCustomer.totalPurchases}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Total Spent</p>
                <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(viewCustomer.totalSpent)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Pending Balance</p>
                <p className={`text-lg font-bold mt-1 ${viewCustomer.pendingBalance > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {viewCustomer.pendingBalance > 0 ? formatCurrency(viewCustomer.pendingBalance) : 'Cleared'}
                </p>
              </div>
            </div>

            {/* Address */}
            {viewCustomer.address && (
              <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span>{viewCustomer.address}</span>
              </div>
            )}

            {/* Invoice History */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice History</h3>
              {customerInvoices.length === 0 ? (
                <p className="text-sm text-gray-400">No invoices yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-header">Invoice #</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Total</th>
                      <th className="table-header">Paid</th>
                      <th className="table-header">Balance</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map(inv => (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell font-medium text-blue-600 dark:text-blue-400 text-xs">{inv.invoiceNumber}</td>
                        <td className="table-cell text-xs text-gray-400">{formatDate(inv.createdAt)}</td>
                        <td className="table-cell font-medium">{formatCurrency(inv.total)}</td>
                        <td className="table-cell text-green-600">{formatCurrency(inv.amountPaid)}</td>
                        <td className="table-cell text-red-500">{inv.balance > 0 ? formatCurrency(inv.balance) : '—'}</td>
                        <td className="table-cell"><Badge label={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteCustomer(deleteId); }}
        title="Delete Customer"
        message="This will remove the customer and all associated data. This cannot be undone."
      />
    </div>
  );
}
