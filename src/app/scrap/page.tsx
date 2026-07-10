'use client';

import { useState } from 'react';
import { Search, Recycle, Trash2, Package, Boxes, DollarSign } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency, formatWeight, formatDate } from '@/lib/utils';

const fmtPacks = (n: number) => `${n.toLocaleString('en-PK')} pack${n === 1 ? '' : 's'}`;

export default function ScrapPage() {
  const { state, deleteScrap } = useApp();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = state.scrapItems.filter(s => {
    const q = search.toLowerCase();
    if (search && !s.steelType.toLowerCase().includes(q) && !(s.grade ?? '').toLowerCase().includes(q)
      && !s.batchNumber.toLowerCase().includes(q) && !s.companyName.toLowerCase().includes(q)) return false;
    if (filterCategory && (s.category ?? 'Steel') !== filterCategory) return false;
    return true;
  });

  const steelKg = state.scrapItems.filter(s => (s.category ?? 'Steel') === 'Steel').reduce((t, s) => t + s.weightKg, 0);
  const cementPacks = state.scrapItems.filter(s => s.category === 'Cement').reduce((t, s) => t + s.weightKg, 0);
  const totalValue = state.scrapItems.reduce((t, s) => t + s.weightKg * s.pricePerKg, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Scrap</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Stock moved out as scrap — send items here from Steel Stock or Cement Stock
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Steel Scrapped" value={formatWeight(steelKg)} icon={Package}
          iconColor="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
        <StatCard title="Cement Scrapped" value={fmtPacks(cementPacks)} icon={Boxes}
          iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard title="Scrap Records" value={state.scrapItems.length} icon={Recycle}
          iconColor="text-teal-600" iconBg="bg-teal-50 dark:bg-teal-900/20" />
        <StatCard title="Original Value" value={formatCurrency(totalValue)} sub="at purchase price" icon={DollarSign}
          iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search type, batch, company..." className="input pl-8 py-1.5" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input w-auto py-1.5">
            <option value="">All Categories</option>
            <option>Steel</option>
            <option>Cement</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Recycle}
            title="No scrap yet"
            description="Use the scrap button on a batch in Steel Stock or Cement Stock to move remaining quantity here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Category</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Grade</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Original Value</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Batch</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Notes</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isCement = s.category === 'Cement';
                  return (
                    <tr key={s.id} className="table-row">
                      <td className="table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isCement ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {s.category ?? 'Steel'}
                        </span>
                      </td>
                      <td className="table-cell font-semibold text-gray-900 dark:text-white">{s.steelType}</td>
                      <td className="table-cell text-gray-400 text-xs">{s.grade || '—'}</td>
                      <td className="table-cell font-medium text-orange-600 dark:text-orange-400">
                        {isCement ? fmtPacks(s.weightKg) : formatWeight(s.weightKg)}
                      </td>
                      <td className="table-cell text-gray-500">{formatCurrency(s.weightKg * s.pricePerKg)}</td>
                      <td className="table-cell text-xs text-gray-500">{s.companyName || '—'}</td>
                      <td className="table-cell text-xs font-mono text-gray-400">{s.batchNumber || '—'}</td>
                      <td className="table-cell text-xs text-gray-400">{formatDate(s.date)}</td>
                      <td className="table-cell text-xs text-gray-400 max-w-[160px] truncate">{s.notes || '—'}</td>
                      <td className="table-cell">
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Undo — put quantity back into stock"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteScrap(deleteId); }}
        title="Undo Scrap"
        message="This removes the scrap record and puts the quantity back into the stock batch. Continue?"
      />
    </div>
  );
}
