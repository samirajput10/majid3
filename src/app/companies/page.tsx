'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Search, Building2, Edit2, Trash2, BarChart2,
  Wallet, ShoppingCart, Banknote, PlusCircle, MinusCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatCurrencyFull, formatWeight, formatDate, generateId, todayISO } from '@/lib/utils';
import type { Company, LedgerEntry, PaymentMethod } from '@/lib/types';
import { getLedgerSummary, getBalanceLabel } from '@/lib/ledger';
import { STEEL_TYPES, CEMENT_TYPES } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };
const PAYMENT_METHODS: PaymentMethod[] = ['Bank Transfer', 'Cheque', 'Cash', 'Other'];
const newLedgerItem = () => ({
  id: generateId('li'),
  mode: 'existing' as 'existing' | 'new',
  stockItemId: '',
  name: '',
  qty: '',
  rate: '',
  category: 'Steel' as 'Steel' | 'Cement',
  grade: '',
  unit: 'piece' as 'kg' | 'ton' | 'piece' | 'pack',
  quantity: '',
  batchNumber: '',
  location: '',
  notes: '',
});
type LedgerItemForm = ReturnType<typeof newLedgerItem>;

export default function CompaniesPage() {
  const { state, addCompany, updateCompany, deleteCompany, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewId, setViewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Payment ledger state ───────────────────────────────────────────────────
  const [ledgerCompanyId, setLedgerCompanyId] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [entryFormType, setEntryFormType] = useState<'Purchase' | 'Payment' | null>(null);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [ledgerSaving, setLedgerSaving] = useState(false);

  const [purchaseItems, setPurchaseItems] = useState([newLedgerItem()]);
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseNote, setPurchaseNote] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentNote, setPaymentNote] = useState('');

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

  // ── Payment ledger ──────────────────────────────────────────────────────────
  const ledgerCompany = ledgerCompanyId ? state.companies.find(c => c.id === ledgerCompanyId) : null;
  // Hide the ledger list modal (not the flow) while a child modal is active, so
  // only one modal is visually on top at a time — mirrors the view→edit pattern
  // used elsewhere in this app (close the parent, not stack over it).
  const ledgerModalVisible = !!ledgerCompanyId && !entryFormType && !detailEntryId;

  const ledgerCompanyStock = ledgerCompanyId ? state.stockItems.filter(s => s.companyId === ledgerCompanyId) : [];

  const companyLedger = ledgerCompanyId ? state.ledgerEntries.filter(e => e.companyId === ledgerCompanyId) : [];
  const sortedLedger = [...companyLedger].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
  const filteredLedger = sortedLedger.filter(e => {
    if (!ledgerSearch) return true;
    const q = ledgerSearch.toLowerCase();
    const desc = e.type === 'Purchase'
      ? (e.items ?? []).map(i => i.name).join(' ')
      : `${e.method ?? ''} ${e.reference ?? ''}`;
    return e.type.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q);
  });
  const ledgerSummary = getLedgerSummary(companyLedger);
  const detailEntry = detailEntryId ? companyLedger.find(e => e.id === detailEntryId) ?? null : null;

  const closeLedger = () => {
    setLedgerCompanyId(null);
    setLedgerSearch('');
    setEntryFormType(null);
    setEditingEntry(null);
    setDetailEntryId(null);
    setDeleteEntryId(null);
  };
  const openLedger = (companyId: string) => { setLedgerCompanyId(companyId); setLedgerSearch(''); };
  const closeEntryForm = () => { setEntryFormType(null); setEditingEntry(null); };

  const openPurchaseForm = (entry?: LedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setPurchaseItems((entry.items ?? []).map(it => ({
        id: it.id || generateId('li'),
        // Items already linked to a real stock batch stay "existing"; items saved
        // before this link existed (or that failed to link) fall back to "new" so
        // they're still editable and will create a fresh stock batch on save.
        mode: it.stockItemId ? 'existing' as const : 'new' as const,
        stockItemId: it.stockItemId || '',
        name: it.name,
        qty: String(it.qty),
        rate: String(it.rate),
        category: (it.category as 'Steel' | 'Cement') || 'Steel',
        grade: it.grade || '',
        unit: (it.unit as 'kg' | 'ton' | 'piece' | 'pack') || 'piece',
        quantity: String(it.quantityUnits ?? 0),
        batchNumber: it.batchNumber || '',
        location: it.location || '',
        notes: it.notes || '',
      })));
      setPurchaseDate(entry.date);
      setPurchaseNote(entry.note ?? '');
    } else {
      setEditingEntry(null);
      setPurchaseItems([newLedgerItem()]);
      setPurchaseDate(todayISO());
      setPurchaseNote('');
    }
    setEntryFormType('Purchase');
  };

  const openPaymentForm = (entry?: LedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setPaymentAmount(String(entry.amount));
      setPaymentMethod(entry.method ?? 'Cash');
      setPaymentReference(entry.reference ?? '');
      setPaymentDate(entry.date);
      setPaymentNote(entry.note ?? '');
    } else {
      setEditingEntry(null);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentReference('');
      setPaymentDate(todayISO());
      setPaymentNote('');
    }
    setEntryFormType('Payment');
  };

  const updatePurchaseItem = (idx: number, field: keyof LedgerItemForm, value: string) => {
    setPurchaseItems(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const setItemMode = (idx: number, mode: 'existing' | 'new') => {
    setPurchaseItems(items => items.map((it, i) => i === idx ? { ...newLedgerItem(), id: it.id, mode } : it));
  };
  const selectExistingStock = (idx: number, stockItemId: string) => {
    const stock = ledgerCompanyStock.find(s => s.id === stockItemId);
    setPurchaseItems(items => items.map((it, i) => i === idx ? {
      ...it,
      stockItemId,
      name: stock ? `${stock.steelType}${stock.grade ? ` ${stock.grade}` : ''}` : '',
      category: (stock?.category as 'Steel' | 'Cement') ?? it.category,
      grade: stock?.grade ?? '',
      unit: (stock?.unit as 'kg' | 'ton' | 'piece' | 'pack') ?? it.unit,
      rate: stock ? String(stock.pricePerKg) : it.rate,
    } : it));
  };
  const purchaseItemAmount = (it: { qty: string; rate: string }) => (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
  const purchaseTotal = purchaseItems.reduce((s, it) => s + purchaseItemAmount(it), 0);
  const purchaseValid = purchaseItems.some(it =>
    (it.mode === 'existing' ? !!it.stockItemId : it.name.trim()) && parseFloat(it.qty) > 0
  );

  const handleSavePurchase = async () => {
    if (!ledgerCompanyId || !purchaseValid || ledgerSaving) return;
    const items = purchaseItems
      .filter(it => (it.mode === 'existing' ? it.stockItemId : it.name.trim()) && parseFloat(it.qty) > 0)
      .map(it => ({
        name: it.name.trim(),
        qty: parseFloat(it.qty) || 0,
        rate: parseFloat(it.rate) || 0,
        stockItemId: it.mode === 'existing' ? it.stockItemId : undefined,
        category: it.category,
        grade: it.grade.trim(),
        unit: it.unit,
        quantityUnits: parseFloat(it.quantity) || 0,
        batchNumber: it.batchNumber.trim(),
        location: it.location.trim(),
        notes: it.notes.trim(),
      }));
    setLedgerSaving(true);
    try {
      const data = { companyId: ledgerCompanyId, type: 'Purchase' as const, date: purchaseDate, items, note: purchaseNote };
      if (editingEntry) await updateLedgerEntry(editingEntry.id, data);
      else await addLedgerEntry(data);
      closeEntryForm();
    } finally {
      setLedgerSaving(false);
    }
  };

  const handleSavePayment = async () => {
    const amt = parseFloat(paymentAmount) || 0;
    if (!ledgerCompanyId || amt <= 0 || ledgerSaving) return;
    setLedgerSaving(true);
    try {
      const data = {
        companyId: ledgerCompanyId, type: 'Payment' as const, date: paymentDate,
        amount: amt, method: paymentMethod, reference: paymentReference, note: paymentNote,
      };
      if (editingEntry) await updateLedgerEntry(editingEntry.id, data);
      else await addLedgerEntry(data);
      closeEntryForm();
    } finally {
      setLedgerSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId || !ledgerCompanyId) return;
    await deleteLedgerEntry(deleteEntryId, ledgerCompanyId);
    setDeleteEntryId(null);
  };

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
                        <button onClick={() => setViewId(c.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View Stock"><BarChart2 size={14} /></button>
                        <button onClick={() => openLedger(c.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Payment Ledger"><Wallet size={14} /></button>
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

      {/* ─── Payment Ledger ─── */}
      {ledgerCompany && (
        <Modal
          open={ledgerModalVisible}
          onClose={closeLedger}
          title={ledgerCompany.name}
          subtitle="Payment Ledger — purchases increase what you owe, payments reduce it"
          size="xl"
          footer={
            <>
              <button onClick={() => openPaymentForm()} className="btn-secondary">
                <Banknote size={15} /> Payment ₨
              </button>
              <button onClick={() => openPurchaseForm()} className="btn-primary">
                <ShoppingCart size={15} /> Purchase ₨
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Balance card */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
              <p className={`text-3xl font-bold ${
                ledgerSummary.label === 'Payable' ? 'text-red-600 dark:text-red-400'
                  : ledgerSummary.label === 'Advance' ? 'text-blue-600 dark:text-blue-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {formatCurrency(ledgerSummary.balance)}
              </p>
              <div className="mt-2 flex justify-center"><Badge label={ledgerSummary.label} /></div>
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-400">
                <span>Total Purchases: <b className="text-gray-600 dark:text-gray-300">{formatCurrency(ledgerSummary.totalPurchases)}</b></span>
                <span>Total Payments: <b className="text-gray-600 dark:text-gray-300">{formatCurrency(ledgerSummary.totalPayments)}</b></span>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                placeholder="Search entries..."
                className="input pl-8 py-1.5"
              />
            </div>

            {/* Entry list */}
            {filteredLedger.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No ledger entries yet"
                description="Add a purchase or payment using the buttons below."
              />
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {filteredLedger.map(e => {
                  const isPurchase = e.type === 'Purchase';
                  const desc = isPurchase
                    ? `${(e.items ?? []).length} item${(e.items ?? []).length === 1 ? '' : 's'}`
                    : (e.method ?? '');
                  const afterLabel = getBalanceLabel(e.balanceAfter);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setDetailEntryId(e.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPurchase ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {isPurchase
                            ? <ShoppingCart size={14} className="text-green-600 dark:text-green-400" />
                            : <Banknote size={14} className="text-red-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{e.type} · {desc}</p>
                          <p className="text-xs text-gray-400">{formatDate(e.date)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${isPurchase ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {isPurchase ? '+' : '−'} {formatCurrency(e.amount)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Bal: {formatCurrency(Math.abs(e.balanceAfter))} {afterLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── New / Edit Purchase ─── */}
      <Modal
        open={entryFormType === 'Purchase'}
        onClose={closeEntryForm}
        title={editingEntry ? 'Edit Purchase' : 'New Purchase'}
        subtitle={ledgerCompany?.name}
        size="lg"
        footer={
          <>
            <button onClick={closeEntryForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSavePurchase} className="btn-primary" disabled={!purchaseValid || ledgerSaving}>
              {ledgerSaving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Purchase'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items *</label>
              <button
                onClick={() => setPurchaseItems(items => [...items, newLedgerItem()])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <PlusCircle size={13} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {purchaseItems.map((it, idx) => (
                <div key={it.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <button
                        type="button"
                        onClick={() => setItemMode(idx, 'existing')}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${it.mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        Existing Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemMode(idx, 'new')}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${it.mode === 'new' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        New Item
                      </button>
                    </div>
                    {purchaseItems.length > 1 && (
                      <button
                        onClick={() => setPurchaseItems(items => items.filter((_, i) => i !== idx))}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <MinusCircle size={16} />
                      </button>
                    )}
                  </div>

                  {it.mode === 'existing' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3">
                        <label className="label text-[10px]">Stock Item</label>
                        <select
                          value={it.stockItemId}
                          onChange={e => selectExistingStock(idx, e.target.value)}
                          className="input py-1.5 text-xs"
                        >
                          <option value="">Select stock item</option>
                          {ledgerCompanyStock.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.steelType}{s.grade ? ` ${s.grade}` : ''} — {formatWeight(s.weightKg)} in stock
                            </option>
                          ))}
                        </select>
                        {ledgerCompanyStock.length === 0 && (
                          <p className="text-[10px] text-gray-400 mt-1">No stock yet for this company — switch to &ldquo;New Item&rdquo;.</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-[10px]">Qty to Add ({it.category === 'Cement' ? 'packs' : 'kg'})</label>
                        <input value={it.qty} onChange={e => updatePurchaseItem(idx, 'qty', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Rate (PKR)</label>
                        <input value={it.rate} onChange={e => updatePurchaseItem(idx, 'rate', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Amount</label>
                        <div className="input py-1.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                          {formatCurrency(purchaseItemAmount(it))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-[10px]">Category</label>
                        <select value={it.category} onChange={e => updatePurchaseItem(idx, 'category', e.target.value)} className="input py-1.5 text-xs">
                          <option value="Steel">Steel</option>
                          <option value="Cement">Cement</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px]">Type *</label>
                        <select value={it.name} onChange={e => updatePurchaseItem(idx, 'name', e.target.value)} className="input py-1.5 text-xs">
                          <option value="">Select type</option>
                          {(it.category === 'Cement' ? CEMENT_TYPES : STEEL_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px]">Grade / Spec</label>
                        <input value={it.grade} onChange={e => updatePurchaseItem(idx, 'grade', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">{it.category === 'Cement' ? 'Packs *' : 'Weight (kg) *'}</label>
                        <input value={it.qty} onChange={e => updatePurchaseItem(idx, 'qty', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Quantity</label>
                        <div className="flex gap-1">
                          <input value={it.quantity} onChange={e => updatePurchaseItem(idx, 'quantity', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs flex-1" />
                          <select value={it.unit} onChange={e => updatePurchaseItem(idx, 'unit', e.target.value)} className="input py-1.5 text-xs w-16">
                            <option value="piece">pc</option>
                            <option value="kg">kg</option>
                            <option value="ton">ton</option>
                            <option value="pack">pack</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label text-[10px]">Rate (PKR) *</label>
                        <input value={it.rate} onChange={e => updatePurchaseItem(idx, 'rate', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Batch Number</label>
                        <input value={it.batchNumber} onChange={e => updatePurchaseItem(idx, 'batchNumber', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Location</label>
                        <input value={it.location} onChange={e => updatePurchaseItem(idx, 'location', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Amount</label>
                        <div className="input py-1.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                          {formatCurrency(purchaseItemAmount(it))}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <label className="label text-[10px]">Notes</label>
                        <input value={it.notes} onChange={e => updatePurchaseItem(idx, 'notes', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} type="date" className="input" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">Total</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-300">{formatCurrencyFull(purchaseTotal)}</span>
            </div>
          </div>
          <div>
            <label className="label">Note</label>
            <input value={purchaseNote} onChange={e => setPurchaseNote(e.target.value)} placeholder="Optional note" className="input" />
          </div>
        </div>
      </Modal>

      {/* ─── New / Edit Payment ─── */}
      <Modal
        open={entryFormType === 'Payment'}
        onClose={closeEntryForm}
        title={editingEntry ? 'Edit Payment' : 'New Payment'}
        subtitle={ledgerCompany?.name}
        size="sm"
        footer={
          <>
            <button onClick={closeEntryForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSavePayment} className="btn-primary" disabled={!(parseFloat(paymentAmount) > 0) || ledgerSaving}>
              {ledgerSaving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Payment'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Amount (PKR) *</label>
            <input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} type="number" min="0" placeholder="0" className="input" />
          </div>
          <div>
            <label className="label">Method *</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="input">
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference No. (optional)</label>
            <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="e.g. Cheque #, transaction ID" className="input" />
          </div>
          <div>
            <label className="label">Date</label>
            <input value={paymentDate} onChange={e => setPaymentDate(e.target.value)} type="date" className="input" />
          </div>
          <div>
            <label className="label">Note</label>
            <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Optional note" className="input" />
          </div>
        </div>
      </Modal>

      {/* ─── Entry Detail ─── */}
      {detailEntry && (
        <Modal
          open={!!detailEntryId}
          onClose={() => setDetailEntryId(null)}
          title={detailEntry.type === 'Purchase' ? 'Purchase Details' : 'Payment Details'}
          subtitle={`${formatDate(detailEntry.date)} · ${ledgerCompany?.name ?? ''}`}
          size="md"
          footer={
            <>
              <button
                onClick={() => { setDetailEntryId(null); setDeleteEntryId(detailEntry.id); }}
                className="btn-danger"
              >
                <Trash2 size={15} /> Delete
              </button>
              <button
                onClick={() => {
                  const entry = detailEntry;
                  setDetailEntryId(null);
                  if (entry.type === 'Purchase') openPurchaseForm(entry); else openPaymentForm(entry);
                }}
                className="btn-secondary"
              >
                <Edit2 size={15} /> Edit
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {detailEntry.type === 'Purchase' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Rate</th>
                    <th className="table-header text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailEntry.items ?? []).map((it, i) => (
                    <tr key={i} className="table-row">
                      <td className="table-cell font-medium">{it.name}</td>
                      <td className="table-cell text-right">{it.qty}</td>
                      <td className="table-cell text-right">{formatCurrencyFull(it.rate)}</td>
                      <td className="table-cell text-right font-semibold">{formatCurrencyFull(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Method</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.method}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Reference</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.reference || '—'}</p>
                </div>
              </div>
            )}
            {detailEntry.note && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">&ldquo;{detailEntry.note}&rdquo;</p>
            )}
            <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Amount</span>
              <span className={`text-lg font-bold ${detailEntry.type === 'Purchase' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {formatCurrencyFull(detailEntry.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">Balance After This Entry</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {formatCurrencyFull(Math.abs(detailEntry.balanceAfter))}
                <Badge label={getBalanceLabel(detailEntry.balanceAfter)} />
              </span>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Ledger Entry"
        message="This will permanently remove this entry and recalculate the balance. Continue?"
      />
    </div>
  );
}
