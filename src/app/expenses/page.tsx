'use client';

import { useState } from 'react';
import { Plus, Search, Receipt, Edit2, Trash2, PlusCircle, MinusCircle, DollarSign, Calendar } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency, formatDate, generateId, todayISO } from '@/lib/utils';
import type { Expense } from '@/lib/types';

const newRow = () => ({ id: generateId('exp'), description: '', amount: '' });

export default function ExpensesPage() {
  const { state, addExpense, updateExpense, deleteExpense } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add mode supports multiple rows ("add more expense"); edit mode always
  // has exactly one row, since it edits a single existing record.
  const [rows, setRows] = useState([newRow()]);
  const [sharedDate, setSharedDate] = useState(todayISO());
  const [sharedNote, setSharedNote] = useState('');

  const filtered = state.expenses.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.description.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q);
  });

  const now = new Date();
  const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const monthExpenses = state.expenses
    .filter(e => { const d = new Date(e.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditTarget(null);
    setRows([newRow()]);
    setSharedDate(todayISO());
    setSharedNote('');
    setModalOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditTarget(e);
    setRows([{ id: generateId('exp'), description: e.description, amount: String(e.amount) }]);
    setSharedDate(e.date);
    setSharedNote(e.note ?? '');
    setModalOpen(true);
  };

  const updateRow = (idx: number, field: 'description' | 'amount', value: string) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const validRows = rows.filter(r => r.description.trim() && parseFloat(r.amount) > 0);
  const rowsTotal = validRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const handleSave = async () => {
    if (validRows.length === 0 || saving) return;
    setSaving(true);
    try {
      if (editTarget) {
        const r = validRows[0];
        await updateExpense({ ...editTarget, description: r.description.trim(), amount: parseFloat(r.amount) || 0, date: sharedDate, note: sharedNote });
      } else {
        await Promise.all(validRows.map(r =>
          addExpense({ description: r.description.trim(), amount: parseFloat(r.amount) || 0, date: sharedDate, note: sharedNote })
        ));
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track business expenses — these reduce your profit</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Expense</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={DollarSign}
          iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
        <StatCard title="This Month" value={formatCurrency(monthExpenses)} icon={Calendar}
          iconColor="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
        <StatCard title="Records" value={state.expenses.length} icon={Receipt}
          iconColor="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, notes..." className="input pl-8 py-1.5" />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Add your first expense to start tracking it against profit."
            action={<button onClick={openAdd} className="btn-primary text-sm">Add Expense</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Description</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Note</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="table-row">
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">{e.description}</td>
                    <td className="table-cell font-medium text-red-600 dark:text-red-400">− {formatCurrency(e.amount)}</td>
                    <td className="table-cell text-xs text-gray-400">{formatDate(e.date)}</td>
                    <td className="table-cell text-xs text-gray-400 max-w-[200px] truncate">{e.note || '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(e.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Expense' : 'Add Expense'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={validRows.length === 0 || saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Expense'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Expense{!editTarget ? 's' : ''} *</label>
              {!editTarget && (
                <button
                  onClick={() => setRows(rs => [...rs, newRow()])}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <PlusCircle size={13} /> Add More Expense
                </button>
              )}
            </div>
            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={r.id} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <div className="flex-1">
                    <label className="label text-[10px]">Description</label>
                    <input
                      value={r.description}
                      onChange={e => updateRow(idx, 'description', e.target.value)}
                      placeholder="e.g. Fuel, Office Rent, Electricity Bill"
                      className="input py-1.5 text-xs"
                    />
                  </div>
                  <div className="w-32">
                    <label className="label text-[10px]">Amount (PKR)</label>
                    <input
                      value={r.amount}
                      onChange={e => updateRow(idx, 'amount', e.target.value)}
                      type="number" min="0" placeholder="0"
                      className="input py-1.5 text-xs"
                    />
                  </div>
                  {!editTarget && rows.length > 1 && (
                    <button
                      onClick={() => setRows(rs => rs.filter((_, i) => i !== idx))}
                      className="p-1.5 text-red-400 hover:text-red-600 mb-0.5"
                    >
                      <MinusCircle size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input value={sharedDate} onChange={e => setSharedDate(e.target.value)} type="date" className="input" />
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-red-700 dark:text-red-300">Total</span>
              <span className="text-base font-bold text-red-700 dark:text-red-300">{formatCurrency(rowsTotal)}</span>
            </div>
          </div>
          <div>
            <label className="label">Note</label>
            <input value={sharedNote} onChange={e => setSharedNote(e.target.value)} placeholder="Optional note" className="input" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteExpense(deleteId); }}
        title="Delete Expense"
        message="This will permanently remove this expense record. Are you sure?"
      />
    </div>
  );
}
