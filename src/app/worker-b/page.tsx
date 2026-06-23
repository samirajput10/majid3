'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Briefcase, Plus, Trash2, Phone, FileText, DollarSign, TrendingUp } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { WorkerB } from '@/lib/types';

const EMPTY = { name: '', phone: '', notes: '', paid: '' };

export default function WorkerBPage() {
  const { state, addWorkerB, updateWorkerB, deleteWorkerB } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkerB | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkerB | null>(null);

  // Per-agent invoice breakdown from state
  const invoicesByAgent = (agentId: string) =>
    state.invoices.filter(i => i.workerBId === agentId);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (w: WorkerB) => {
    setEditing(w);
    setForm({ name: w.name, phone: w.phone ?? '', notes: w.notes ?? '', paid: w.totalPaid ? String(w.totalPaid) : '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateWorkerB({
          ...editing,
          name: form.name,
          phone: form.phone,
          notes: form.notes,
          totalPaid: parseFloat(form.paid) || 0,
        });
      } else {
        await addWorkerB({ name: form.name, phone: form.phone, notes: form.notes });
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteWorkerB(confirmDelete.id);
    setConfirmDelete(null);
  };

  const totalEarningsAll = state.workerBs.reduce((s, w) => s + w.totalEarnings, 0);
  const totalPaidAll = state.workerBs.reduce((s, w) => s + (w.totalPaid ?? 0), 0);
  const totalRemainingAll = Math.max(0, totalEarningsAll - totalPaidAll);
  const totalDealsAll = state.workerBs.reduce((s, w) => s + w.totalDeals, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Worker B</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sales agents & brokers — track deals, labour & payouts</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Register Worker B
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <DollarSign size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Labour</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalEarningsAll)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
            <DollarSign size={18} className="text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Paid</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalPaidAll)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <DollarSign size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Remaining Payable</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(totalRemainingAll)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Deals</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalDealsAll}</p>
          </div>
        </div>
      </div>

      {/* Agent cards */}
      {state.workerBs.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500">No Worker B registered yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4 mx-auto flex items-center gap-2">
            <Plus size={15} /> Register First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.workerBs.map(wb => {
            const deals = invoicesByAgent(wb.id);
            const paid = wb.totalPaid ?? 0;
            const remaining = Math.max(0, wb.totalEarnings - paid);
            return (
              <div key={wb.id} className="card p-5 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {wb.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{wb.name}</p>
                      {wb.phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {wb.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(wb)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <TrendingUp size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(wb)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Total Labour</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(wb.totalEarnings)}
                    </p>
                  </div>
                  <div className="bg-teal-50 dark:bg-teal-900/10 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Paid</p>
                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">
                      − {formatCurrency(paid)}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Remaining</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-2.5 text-center">
                  <span className="text-[11px] text-gray-400">Deals Closed: </span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{wb.totalDeals}</span>
                </div>

                {/* Recent deals */}
                {deals.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Deals</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {deals.slice(0, 5).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{inv.invoiceNumber}</span>
                          <span className="text-gray-500">{inv.customerName}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(inv.workerBCharge ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {wb.notes && (
                  <p className="text-xs text-gray-400 italic border-t border-gray-100 dark:border-gray-700/50 pt-2">{wb.notes}</p>
                )}

                <p className="text-[10px] text-gray-300 dark:text-gray-600">
                  Registered {formatDate(wb.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Worker B' : 'Register Worker B'}
        subtitle="Sales agents or brokers who bring customers"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Update' : 'Register'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Full Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rashid Khan"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Phone (optional)</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="03xx-xxxxxxx"
              className="input w-full"
            />
          </div>
          {editing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Total Paid to Agent (PKR)
              </label>
              <input
                value={form.paid}
                onChange={e => setForm(f => ({ ...f, paid: e.target.value }))}
                type="number"
                min="0"
                placeholder="0"
                className="input w-full"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Total labour earned: <strong>{formatCurrency(editing.totalEarnings)}</strong>
                {' · '}Remaining after payout:{' '}
                <strong className="text-red-500">
                  {formatCurrency(Math.max(0, editing.totalEarnings - (parseFloat(form.paid) || 0)))}
                </strong>
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional info…"
              className="input w-full resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove Worker B"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Remove</button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Remove <strong>{confirmDelete?.name}</strong>? Their historical invoice records will remain, but totals won&apos;t update.
        </p>
      </Modal>
    </div>
  );
}
