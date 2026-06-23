'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, HardHat, Phone, Edit2, Trash2, Calendar, CheckSquare, Square, DollarSign } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, todayISO, calculateMonthlySalary } from '@/lib/utils';
import type { Worker, WorkerRole, SalaryType } from '@/lib/types';

const ROLES: WorkerRole[] = ['Loader', 'Supervisor', 'Driver', 'Welder', 'Guard', 'Accountant', 'Other'];
const SALARY_TYPES: SalaryType[] = ['Daily', 'Weekly', 'Monthly'];
const EMPTY_FORM = { name: '', phone: '', role: 'Loader' as WorkerRole, salaryType: 'Daily' as SalaryType, salaryRate: '', joiningDate: todayISO(), address: '', cnic: '', isActive: true };

export default function WorkersPage() {
  const { state, addWorker, updateWorker, deleteWorker, setAttendance } = useApp();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'workers' | 'attendance'>('workers');
  const [filterRole, setFilterRole] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Worker | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [attendDate, setAttendDate] = useState(todayISO());

  const filtered = state.workers.filter(w => {
    const q = search.toLowerCase();
    if (search && !w.name.toLowerCase().includes(q) && !w.phone.includes(q)) return false;
    if (filterRole && w.role !== filterRole) return false;
    return true;
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setModalOpen(true); };
  const openEdit = (w: Worker) => {
    setEditTarget(w);
    setForm({ name: w.name, phone: w.phone, role: w.role, salaryType: w.salaryType, salaryRate: String(w.salaryRate), joiningDate: w.joiningDate ?? todayISO(), address: w.address ?? '', cnic: w.cnic ?? '', isActive: w.isActive });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    const base = { ...form, salaryRate: parseFloat(form.salaryRate || '0') };
    if (editTarget) {
      await updateWorker({ ...editTarget, ...base });
    } else {
      await addWorker(base);
    }
    setModalOpen(false);
  };

  // Attendance for selected date
  const todayAttendance = useMemo(() => {
    return state.attendance.filter(a => a.date === attendDate);
  }, [state.attendance, attendDate]);

  const getAttendRecord = (workerId: string) =>
    todayAttendance.find(a => a.workerId === workerId);

  const toggleAttend = async (workerId: string) => {
    const existing = getAttendRecord(workerId);
    await setAttendance({
      workerId,
      date: attendDate,
      present: existing ? !existing.present : true,
    });
  };

  // Salary summary (this month)
  const salarySummary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthAttend = state.attendance.filter(a => a.date.startsWith(thisMonth));

    return state.workers.filter(w => w.isActive).map(w => {
      const daysPresent = monthAttend.filter(a => a.workerId === w.id && a.present).length;
      const salary = calculateMonthlySalary(w.salaryType, w.salaryRate, daysPresent);
      return { worker: w, daysPresent, salary };
    });
  }, [state.workers, state.attendance]);

  const totalMonthlySalary = salarySummary.reduce((s, r) => s + r.salary, 0);
  const activeCount = state.workers.filter(w => w.isActive).length;
  const presentToday = todayAttendance.filter(a => a.present).length;

  const roleColors: Record<WorkerRole, string> = {
    Supervisor: 'bg-blue-100 text-blue-700',
    Loader:     'bg-gray-100 text-gray-700',
    Driver:     'bg-teal-100 text-teal-700',
    Welder:     'bg-orange-100 text-orange-700',
    Guard:      'bg-purple-100 text-purple-700',
    Accountant: 'bg-green-100 text-green-700',
    Other:      'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage staff, attendance, and payroll</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Worker</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Workers" value={state.workers.length} icon={HardHat}
          iconColor="text-yellow-600" iconBg="bg-yellow-50 dark:bg-yellow-900/20" />
        <StatCard title="Active" value={activeCount} icon={HardHat}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Present Today" value={presentToday} sub={`of ${activeCount} active`} icon={Calendar}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Monthly Payroll" value={formatCurrency(totalMonthlySalary)} icon={DollarSign}
          iconColor="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['workers', 'attendance'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'attendance' ? 'Attendance & Payroll' : 'Workers'}
          </button>
        ))}
      </div>

      {tab === 'workers' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." className="input pl-8 py-1.5" />
            </div>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input w-auto py-1.5">
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={HardHat} title="No workers found" description="Add warehouse staff to track attendance and payroll."
              action={<button onClick={openAdd} className="btn-primary text-sm">Add Worker</button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Worker</th>
                    <th className="table-header">Phone</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Salary Type</th>
                    <th className="table-header">Rate</th>
                    <th className="table-header">CNIC</th>
                    <th className="table-header">Joined</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(w => (
                    <tr key={w.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">{w.name[0]}</span>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{w.name}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <a href={`tel:${w.phone}`} className="text-blue-600 hover:underline">{w.phone}</a>
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[w.role] ?? 'bg-gray-100 text-gray-700'}`}>{w.role}</span>
                      </td>
                      <td className="table-cell text-gray-500">{w.salaryType}</td>
                      <td className="table-cell font-medium">
                        {formatCurrency(w.salaryRate)}/{w.salaryType === 'Daily' ? 'day' : w.salaryType === 'Weekly' ? 'week' : 'mo'}
                      </td>
                      <td className="table-cell text-xs text-gray-400">{w.cnic || '—'}</td>
                      <td className="table-cell text-xs text-gray-400">{formatDate(w.joiningDate)}</td>
                      <td className="table-cell">
                        <Badge label={w.isActive ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(w)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(w.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date:</label>
            <input value={attendDate} onChange={e => setAttendDate(e.target.value)} type="date" className="input w-auto" />
            <span className="text-xs text-gray-400">{presentToday} / {activeCount} present</span>
          </div>

          {/* Attendance checkboxes */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Attendance — {attendDate}</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Worker</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Present</th>
                </tr>
              </thead>
              <tbody>
                {state.workers.filter(w => w.isActive).map(w => {
                  const rec = getAttendRecord(w.id);
                  const present = rec?.present ?? false;
                  return (
                    <tr key={w.id} className="table-row">
                      <td className="table-cell font-medium">{w.name}</td>
                      <td className="table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[w.role] ?? ''}`}>{w.role}</span>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => toggleAttend(w.id)} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${present ? 'text-green-600' : 'text-gray-400'}`}>
                          {present ? <CheckSquare size={18} /> : <Square size={18} />}
                          {present ? 'Present' : 'Absent'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Salary Summary */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Monthly Salary Summary</h2>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(totalMonthlySalary)} total</span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Worker</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Salary Type</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header">Days Present</th>
                  <th className="table-header">Earned</th>
                </tr>
              </thead>
              <tbody>
                {salarySummary.map(({ worker: w, daysPresent, salary }) => (
                  <tr key={w.id} className="table-row">
                    <td className="table-cell font-medium">{w.name}</td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[w.role] ?? ''}`}>{w.role}</span>
                    </td>
                    <td className="table-cell text-gray-400">{w.salaryType}</td>
                    <td className="table-cell">{formatCurrency(w.salaryRate)}/{w.salaryType === 'Daily' ? 'd' : w.salaryType === 'Weekly' ? 'wk' : 'mo'}</td>
                    <td className="table-cell">{w.salaryType === 'Monthly' ? '—' : `${daysPresent} days`}</td>
                    <td className="table-cell font-bold text-green-600 dark:text-green-400">{formatCurrency(salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Worker' : 'Add New Worker'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.name || !form.phone}>
              {editTarget ? 'Save Changes' : 'Add Worker'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Worker name" className="input" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-0000000" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as WorkerRole }))} className="input">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Salary Type</label>
              <select value={form.salaryType} onChange={e => setForm(f => ({ ...f, salaryType: e.target.value as SalaryType }))} className="input">
                {SALARY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Salary Rate (PKR per {form.salaryType === 'Daily' ? 'day' : form.salaryType === 'Weekly' ? 'week' : 'month'})</label>
              <input value={form.salaryRate} onChange={e => setForm(f => ({ ...f, salaryRate: e.target.value }))} type="number" min="0" placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">CNIC</label>
              <input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} placeholder="XXXXX-XXXXXXX-X" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Worker address" className="input" />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Active employee</label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteWorker(deleteId); }}
        title="Remove Worker"
        message="This will permanently remove the worker and their records."
      />
    </div>
  );
}
