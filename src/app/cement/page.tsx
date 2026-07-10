'use client';

import { useState } from 'react';
import { Plus, Search, Boxes, Edit2, Trash2, AlertTriangle, Building2, Recycle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, todayISO } from '@/lib/utils';
import type { StockItem, CementType } from '@/lib/types';

const CEMENT_TYPES: CementType[] = ['OPC', 'SRC', 'White Cement', 'Block Cement', 'Other'];
const EMPTY_FORM = {
  cementType: 'OPC' as CementType, grade: '', packs: '', pricePerPack: '',
  companyId: '', batchNumber: '', dateAdded: todayISO(), location: '', notes: '',
};

const fmtPacks = (n: number) => `${n.toLocaleString('en-PK')} pack${n === 1 ? '' : 's'}`;

const EMPTY_NEW_COMPANY = { name: '', phone: '', contactPerson: '' };

export default function CementPage() {
  const { state, addStock, updateStock, deleteStock, addCompany, addScrap } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('existing');
  const [newCompany, setNewCompany] = useState(EMPTY_NEW_COMPANY);
  const [saving, setSaving] = useState(false);
  // Move-to-scrap dialog
  const [scrapTarget, setScrapTarget] = useState<StockItem | null>(null);
  const [scrapQty, setScrapQty] = useState('');
  const [scrapNotes, setScrapNotes] = useState('');
  const [scrapSaving, setScrapSaving] = useState(false);

  // Only Cement stock on this page
  const cementItems = state.stockItems.filter(s => s.category === 'Cement');

  const filtered = cementItems.filter(s => {
    const q = search.toLowerCase();
    if (search && !s.steelType.toLowerCase().includes(q) && !s.batchNumber.toLowerCase().includes(q) && !s.companyName.toLowerCase().includes(q)) return false;
    if (filterType && s.steelType !== filterType) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  // Build a map: stockItemId → total packs sold (from all invoices)
  const soldMap: Record<string, number> = {};
  state.invoices.forEach(inv =>
    inv.items.forEach(item => {
      if (item.stockItemId) soldMap[item.stockItemId] = (soldMap[item.stockItemId] ?? 0) + item.weightKg;
    })
  );

  const remainingPacks = cementItems.reduce((s, i) => s + i.weightKg, 0);
  const soldPacks = cementItems.reduce((s, i) => s + (soldMap[i.id] ?? 0), 0);
  const originalPacks = remainingPacks + soldPacks;
  const totalValue = cementItems.reduce((s, i) => s + i.weightKg * i.pricePerKg, 0);
  const lowStock = cementItems.filter(s => s.status === 'Low Stock').length;
  const outOfStock = cementItems.filter(s => s.status === 'Out of Stock').length;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setCompanyMode(state.companies.length === 0 ? 'new' : 'existing');
    setNewCompany(EMPTY_NEW_COMPANY);
    setModalOpen(true);
  };
  const openEdit = (s: StockItem) => {
    setEditTarget(s);
    setForm({
      cementType: (s.steelType as CementType) ?? 'OPC', grade: s.grade ?? '',
      packs: String(s.weightKg), pricePerPack: String(s.pricePerKg),
      companyId: s.companyId, batchNumber: s.batchNumber, dateAdded: s.dateAdded,
      location: s.location ?? '', notes: s.notes ?? '',
    });
    setCompanyMode('existing');
    setNewCompany(EMPTY_NEW_COMPANY);
    setModalOpen(true);
  };

  const openScrap = (s: StockItem) => {
    setScrapTarget(s);
    setScrapQty(String(s.weightKg));   // default: scrap everything that's left
    setScrapNotes('');
  };

  const scrapQtyNum = parseFloat(scrapQty) || 0;
  const scrapValid = scrapTarget ? scrapQtyNum > 0 && scrapQtyNum <= scrapTarget.weightKg : false;

  const handleScrap = async () => {
    if (!scrapTarget || !scrapValid || scrapSaving) return;
    setScrapSaving(true);
    try {
      await addScrap({ stockItemId: scrapTarget.id, weightKg: scrapQtyNum, notes: scrapNotes, date: todayISO() });
      setScrapTarget(null);
    } finally {
      setScrapSaving(false);
    }
  };

  // If the typed name matches a registered company, reuse it instead of duplicating
  const companyNameMatch = newCompany.name.trim()
    ? state.companies.find(c => c.name.trim().toLowerCase() === newCompany.name.trim().toLowerCase())
    : undefined;

  const companyReady = companyMode === 'new'
    ? Boolean(newCompany.name.trim() && newCompany.phone.trim())
    : Boolean(form.companyId);

  const handleSave = async () => {
    if (!form.cementType || !form.packs || !companyReady || saving) return;
    setSaving(true);
    try {
      // Company first: register the new supplier (or reuse the matching one), then save the stock.
      let company;
      if (companyMode === 'new') {
        company = companyNameMatch ?? await addCompany({
          name: newCompany.name.trim(),
          phone: newCompany.phone.trim(),
          contactPerson: newCompany.contactPerson.trim(),
          address: '',
          email: '',
        });
      } else {
        company = state.companies.find(c => c.id === form.companyId);
        if (!company) return;
      }
      const packs = parseFloat(form.packs);
      const base = {
        category: 'Cement' as const,
        steelType: form.cementType,
        grade: form.grade,
        weightKg: packs,                       // packs stored here so deduction/value logic is shared
        quantity: Math.round(packs),
        unit: 'pack' as const,
        pricePerKg: parseFloat(form.pricePerPack || '0'),  // price per pack
        companyId: company.id,
        companyName: company.name,
        batchNumber: form.batchNumber,
        dateAdded: form.dateAdded,
        location: form.location,
        notes: form.notes,
      };
      if (editTarget) {
        await updateStock({ ...editTarget, ...base });
      } else {
        await addStock(base);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cement Stock</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage all cement stock (in packs)</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Cement</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Original Stock" value={fmtPacks(originalPacks)} sub={`${cementItems.length} batches · ${formatCurrency(totalValue)}`} icon={Boxes}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Remaining Stock" value={fmtPacks(remainingPacks)} sub={originalPacks > 0 ? `${Math.round((remainingPacks / originalPacks) * 100)}% of original` : 'No stock yet'} icon={Boxes}
          iconColor="text-teal-600" iconBg="bg-teal-50 dark:bg-teal-900/20" />
        <StatCard title="Total Sold" value={fmtPacks(soldPacks)} sub={originalPacks > 0 ? `${Math.round((soldPacks / originalPacks) * 100)}% dispatched` : '0% dispatched'} icon={Boxes}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Low / Out of Stock" value={`${lowStock} / ${outOfStock}`} sub="Batches need attention" icon={AlertTriangle}
          iconColor="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
      </div>

      {/* Filters + Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search type, batch, company..." className="input pl-8 py-1.5" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input w-auto py-1.5">
            <option value="">All Types</option>
            {CEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto py-1.5">
            <option value="">All Status</option>
            <option>In Stock</option><option>Low Stock</option><option>Out of Stock</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} items</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="No cement stock" description="Add your first cement batch to get started." action={<button onClick={openAdd} className="btn-primary text-sm">Add Cement</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Type</th>
                  <th className="table-header">Brand / Grade</th>
                  <th className="table-header">Remaining / Original</th>
                  <th className="table-header">Sold</th>
                  <th className="table-header">Price/Pack</th>
                  <th className="table-header">Value</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Batch</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Added</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const sold = soldMap[s.id] ?? 0;
                  const original = s.weightKg + sold;
                  const pct = original > 0 ? Math.round((s.weightKg / original) * 100) : 100;
                  const barColor = pct > 50 ? 'bg-teal-500' : pct > 20 ? 'bg-orange-400' : 'bg-red-500';
                  return (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">{s.steelType}</td>
                    <td className="table-cell text-gray-400 text-xs">{s.grade || '—'}</td>
                    <td className="table-cell min-w-[160px]">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">{fmtPacks(s.weightKg)}</span>
                          <span className="text-gray-400">of {fmtPacks(original)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{pct}% remaining</div>
                      </div>
                    </td>
                    <td className="table-cell text-xs text-orange-500 font-medium">
                      {sold > 0 ? fmtPacks(sold) : '—'}
                    </td>
                    <td className="table-cell">PKR {s.pricePerKg}/pack</td>
                    <td className="table-cell font-medium text-green-600 dark:text-green-400">{formatCurrency(s.weightKg * s.pricePerKg)}</td>
                    <td className="table-cell text-xs text-gray-500">{s.companyName}</td>
                    <td className="table-cell text-xs font-mono text-gray-400">{s.batchNumber}</td>
                    <td className="table-cell text-xs text-gray-400">{s.location || '—'}</td>
                    <td className="table-cell text-xs text-gray-400">{formatDate(s.dateAdded)}</td>
                    <td className="table-cell"><Badge label={s.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {s.weightKg > 0 && (
                          <button onClick={() => openScrap(s)} title="Move to scrap" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"><Recycle size={14} /></button>
                        )}
                        <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Cement Entry' : 'Add Cement Entry'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.cementType || !form.packs || !companyReady || saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Cement'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Cement Type *</label>
            <select value={form.cementType} onChange={e => setForm(f => ({ ...f, cementType: e.target.value as CementType }))} className="input">
              {CEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Brand / Grade</label>
            <input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="e.g. DG Khan, Maple Leaf" className="input" />
          </div>
          <div>
            <label className="label">Number of Packs *</label>
            <input value={form.packs} onChange={e => setForm(f => ({ ...f, packs: e.target.value }))} type="number" min="0" placeholder="0" className="input" />
          </div>
          <div>
            <label className="label">Price per Pack (PKR)</label>
            <input value={form.pricePerPack} onChange={e => setForm(f => ({ ...f, pricePerPack: e.target.value }))} type="number" min="0" placeholder="0" className="input" />
          </div>
          <div className={companyMode === 'new' ? 'col-span-2' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Supplier Company *</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setCompanyMode('existing')}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${companyMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Existing
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyMode('new')}
                  className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${companyMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <Building2 size={11} /> New
                </button>
              </div>
            </div>
            {companyMode === 'existing' ? (
              <>
                <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} className="input">
                  <option value="">Select company</option>
                  {state.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {state.companies.length === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    No companies yet — switch to &ldquo;New&rdquo; to register one right here.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={newCompany.name}
                    onChange={e => setNewCompany(f => ({ ...f, name: e.target.value }))}
                    placeholder="Company name *"
                    className="input py-2 text-sm"
                  />
                  <input
                    value={newCompany.phone}
                    onChange={e => setNewCompany(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone *"
                    className="input py-2 text-sm"
                  />
                  <input
                    value={newCompany.contactPerson}
                    onChange={e => setNewCompany(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="Contact person"
                    className="input py-2 text-sm"
                  />
                </div>
                {companyNameMatch ? (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 flex-1">
                      <b>{companyNameMatch.name}</b> is already registered — this stock will use it.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setCompanyMode('existing'); setForm(f => ({ ...f, companyId: companyNameMatch.id })); setNewCompany(EMPTY_NEW_COMPANY); }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline flex-shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400">
                    Saved to Companies automatically when the cement is added.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label">Batch Number</label>
            <input value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. CEM-2024-001" className="input" />
          </div>
          <div>
            <label className="label">Date Added</label>
            <input value={form.dateAdded} onChange={e => setForm(f => ({ ...f, dateAdded: e.target.value }))} type="date" className="input" />
          </div>
          <div>
            <label className="label">Storage Location</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Bay C" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className="input" />
          </div>

          {form.packs && form.pricePerPack && (
            <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">Estimated Stock Value</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(parseFloat(form.packs || '0') * parseFloat(form.pricePerPack || '0'))}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Move to Scrap Modal */}
      <Modal
        open={!!scrapTarget}
        onClose={() => setScrapTarget(null)}
        title="Move to Scrap"
        subtitle={scrapTarget ? `${scrapTarget.steelType}${scrapTarget.grade ? ` (${scrapTarget.grade})` : ''} — batch ${scrapTarget.batchNumber || '—'}` : ''}
        size="sm"
        footer={
          <>
            <button onClick={() => setScrapTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleScrap} className="btn-primary" disabled={!scrapValid || scrapSaving}>
              <Recycle size={15} />
              {scrapSaving ? 'Moving…' : 'Move to Scrap'}
            </button>
          </>
        }
      >
        {scrapTarget && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-300">
              Remaining in this batch: <b>{fmtPacks(scrapTarget.weightKg)}</b>
            </div>
            <div>
              <label className="label">How many packs to scrap? *</label>
              <input
                value={scrapQty}
                onChange={e => setScrapQty(e.target.value)}
                type="number" min="0" max={scrapTarget.weightKg} step="1"
                className="input"
              />
              {scrapQtyNum > scrapTarget.weightKg && (
                <p className="text-xs text-red-500 font-medium mt-1">
                  Only {fmtPacks(scrapTarget.weightKg)} remaining — cannot scrap more.
                </p>
              )}
              {scrapQtyNum > 0 && scrapQtyNum < scrapTarget.weightKg && (
                <p className="text-[11px] text-gray-400 mt-1">
                  {fmtPacks(scrapTarget.weightKg - scrapQtyNum)} will stay in stock.
                </p>
              )}
            </div>
            <div>
              <label className="label">Reason / Notes</label>
              <input
                value={scrapNotes}
                onChange={e => setScrapNotes(e.target.value)}
                placeholder="e.g. torn bags, hardened packs"
                className="input"
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteStock(deleteId); }}
        title="Remove Cement Entry"
        message="This will permanently remove this cement batch. Are you sure?"
      />
    </div>
  );
}
