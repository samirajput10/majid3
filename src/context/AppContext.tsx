'use client';

import React, {
  createContext, useContext, useReducer, useEffect, useCallback, useState,
} from 'react';
import type {
  AppState, Company, StockItem, ScrapItem, Customer, Invoice, Worker, WorkerB, AttendanceRecord,
} from '@/lib/types';
import { getStockStatus } from '@/lib/utils';
import { invoiceProfit } from '@/lib/profit';

// ─── Action types ─────────────────────────────────────────────────────────────
type Action =
  | { type: 'TOGGLE_DARK' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_DATA'; payload: Partial<AppState> }
  | { type: 'ADD_COMPANY'; payload: Company }
  | { type: 'UPDATE_COMPANY'; payload: Company }
  | { type: 'DELETE_COMPANY'; payload: string }
  | { type: 'ADD_STOCK'; payload: StockItem }
  | { type: 'UPDATE_STOCK'; payload: StockItem }
  | { type: 'DELETE_STOCK'; payload: string }
  | { type: 'ADD_SCRAP'; payload: ScrapItem }
  | { type: 'DELETE_SCRAP'; payload: string }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'DELETE_CUSTOMER'; payload: string }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'DELETE_INVOICE'; payload: string }
  | { type: 'ADD_WORKER'; payload: Worker }
  | { type: 'UPDATE_WORKER'; payload: Worker }
  | { type: 'DELETE_WORKER'; payload: string }
  | { type: 'ADD_WORKER_B'; payload: WorkerB }
  | { type: 'UPDATE_WORKER_B'; payload: WorkerB }
  | { type: 'DELETE_WORKER_B'; payload: string }
  | { type: 'SET_ATTENDANCE'; payload: AttendanceRecord };

const initialState: AppState = {
  companies: [], stockItems: [], scrapItems: [], customers: [],
  invoices: [], workers: [], workerBs: [], attendance: [],
  darkMode: false, sidebarOpen: true,
};

// ─── Normalise MongoDB _id → id ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function norm<T extends Record<string, any>>(doc: T): T {
  if (doc._id && !doc.id) {
    const { _id, ...rest } = doc;
    return { id: String(_id), ...rest } as unknown as T;
  }
  return doc;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normAll<T extends Record<string, any>>(arr: T[]): T[] {
  return arr.map(norm);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TOGGLE_DARK':    return { ...state, darkMode: !state.darkMode };
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_DATA':       return { ...state, ...action.payload };

    case 'ADD_COMPANY':    return { ...state, companies: [...state.companies, action.payload] };
    case 'UPDATE_COMPANY': return { ...state, companies: state.companies.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_COMPANY': return { ...state, companies: state.companies.filter(c => c.id !== action.payload) };

    case 'ADD_STOCK':    return { ...state, stockItems: [...state.stockItems, action.payload] };
    case 'UPDATE_STOCK': return { ...state, stockItems: state.stockItems.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_STOCK': return { ...state, stockItems: state.stockItems.filter(s => s.id !== action.payload) };

    case 'ADD_SCRAP':    return { ...state, scrapItems: [action.payload, ...state.scrapItems] };
    case 'DELETE_SCRAP': return { ...state, scrapItems: state.scrapItems.filter(s => s.id !== action.payload) };

    case 'ADD_CUSTOMER':    return { ...state, customers: [...state.customers, action.payload] };
    case 'UPDATE_CUSTOMER': return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CUSTOMER': return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };

    case 'ADD_INVOICE':    return { ...state, invoices: [...state.invoices, action.payload] };
    case 'UPDATE_INVOICE': return { ...state, invoices: state.invoices.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INVOICE': return { ...state, invoices: state.invoices.filter(i => i.id !== action.payload) };

    case 'ADD_WORKER':    return { ...state, workers: [...state.workers, action.payload] };
    case 'UPDATE_WORKER': return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'DELETE_WORKER': return { ...state, workers: state.workers.filter(w => w.id !== action.payload) };

    case 'ADD_WORKER_B':    return { ...state, workerBs: [...state.workerBs, action.payload] };
    case 'UPDATE_WORKER_B': return { ...state, workerBs: state.workerBs.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'DELETE_WORKER_B': return { ...state, workerBs: state.workerBs.filter(w => w.id !== action.payload) };

    case 'SET_ATTENDANCE': {
      const exists = state.attendance.find(
        a => a.workerId === action.payload.workerId && a.date === action.payload.date
      );
      if (exists) {
        return {
          ...state,
          attendance: state.attendance.map(a =>
            a.workerId === action.payload.workerId && a.date === action.payload.date
              ? action.payload : a
          ),
        };
      }
      return { ...state, attendance: [...state.attendance, action.payload] };
    }

    default: return state;
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error ?? ''; } catch { /* ignore */ }
    throw new Error(`API error ${res.status}: ${url}${detail ? ` — ${detail}` : ''}`);
  }
  return res.json();
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  dispatch: React.Dispatch<Action>;
  addCompany: (data: Omit<Company, 'id' | 'createdAt' | 'totalPurchased' | 'totalCost'>) => Promise<Company>;
  updateCompany: (c: Company) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addStock: (data: Omit<StockItem, 'id' | 'status'>) => Promise<void>;
  updateStock: (s: StockItem) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  addScrap: (data: { stockItemId: string; weightKg: number; notes?: string; date?: string }) => Promise<void>;
  deleteScrap: (id: string) => Promise<void>;
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent' | 'pendingBalance'>) => Promise<Customer>;
  updateCustomer: (c: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addInvoice: (data: Omit<Invoice, 'id' | 'invoiceNumber'>) => Promise<void>;
  updateInvoice: (i: Invoice) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addWorker: (data: Omit<Worker, 'id'>) => Promise<void>;
  updateWorker: (w: Worker) => Promise<void>;
  deleteWorker: (id: string) => Promise<void>;
  addWorkerB: (data: Omit<WorkerB, 'id' | 'createdAt' | 'totalEarnings' | 'totalPaid' | 'totalDeals'>) => Promise<void>;
  updateWorkerB: (w: WorkerB) => Promise<void>;
  deleteWorkerB: (id: string) => Promise<void>;
  refreshWorkerBs: () => Promise<void>;
  setAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  getDashboardStats: () => import('@/lib/types').DashboardStats;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Start as false on the login page so the form is immediately visible
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
  const [loading, setLoading] = useState(!isLoginPage);
  const [error, setError] = useState<string | null>(null);

  // ── Load all data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    // Skip loading on the login page — no session exists there
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        setLoading(true);
        const [companies, stockItems, scrapItems, customers, invoices, workers, workerBs, attendance] =
          await Promise.all([
            api<Company[]>('/api/companies').then(normAll),
            api<StockItem[]>('/api/stock').then(normAll),
            api<ScrapItem[]>('/api/scrap').then(normAll),
            api<Customer[]>('/api/customers').then(normAll),
            api<Invoice[]>('/api/invoices').then(normAll),
            api<Worker[]>('/api/workers').then(normAll),
            api<WorkerB[]>('/api/worker-b').then(normAll),
            api<AttendanceRecord[]>('/api/attendance').then(normAll),
          ]);
        dispatch({
          type: 'SET_DATA',
          payload: { companies, stockItems, scrapItems, customers, invoices, workers, workerBs, attendance },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load data from database';
        if (msg === 'UNAUTHORIZED') {
          // Session missing or expired — redirect to login without showing error UI
          window.location.href = '/login';
          return;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Persist dark mode ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') dispatch({ type: 'SET_DATA', payload: { darkMode: true } });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('darkMode', String(state.darkMode));
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const addCompany = useCallback(async (
    data: Omit<Company, 'id' | 'createdAt' | 'totalPurchased' | 'totalCost'>
  ) => {
    const c = norm(await api<Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_COMPANY', payload: c });
    return c;
  }, []);

  const updateCompany = useCallback(async (c: Company) => {
    const updated = norm(await api<Company>(`/api/companies/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }));
    dispatch({ type: 'UPDATE_COMPANY', payload: updated });
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    await api(`/api/companies/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_COMPANY', payload: id });
  }, []);

  const addStock = useCallback(async (data: Omit<StockItem, 'id' | 'status'>) => {
    const payload = { ...data, status: getStockStatus(data.weightKg, data.category) };
    const s = norm(await api<StockItem>('/api/stock', { method: 'POST', body: JSON.stringify(payload) }));
    dispatch({ type: 'ADD_STOCK', payload: s });
  }, []);

  const updateStock = useCallback(async (s: StockItem) => {
    const payload = { ...s, status: getStockStatus(s.weightKg, s.category) };
    const updated = norm(await api<StockItem>(`/api/stock/${s.id}`, { method: 'PUT', body: JSON.stringify(payload) }));
    dispatch({ type: 'UPDATE_STOCK', payload: updated });
  }, []);

  const deleteStock = useCallback(async (id: string) => {
    await api(`/api/stock/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_STOCK', payload: id });
  }, []);

  const addScrap = useCallback(async (
    data: { stockItemId: string; weightKg: number; notes?: string; date?: string }
  ) => {
    const s = norm(await api<ScrapItem>('/api/scrap', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_SCRAP', payload: s });
    // Refresh stock so the deducted batch shows its new remaining quantity
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const deleteScrap = useCallback(async (id: string) => {
    await api(`/api/scrap/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_SCRAP', payload: id });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const addCustomer = useCallback(async (
    data: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent' | 'pendingBalance'>
  ) => {
    const c = norm(await api<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_CUSTOMER', payload: c });
    return c;
  }, []);

  const updateCustomer = useCallback(async (c: Customer) => {
    const updated = norm(await api<Customer>(`/api/customers/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }));
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_CUSTOMER', payload: id });
  }, []);

  const addInvoice = useCallback(async (data: Omit<Invoice, 'id' | 'invoiceNumber'>) => {
    const i = norm(await api<Invoice>('/api/invoices', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_INVOICE', payload: i });
    // Refresh customer totals, stock, and workerB earnings after invoice
    try {
      const [updatedCustomer, freshStock, freshWBs] = await Promise.all([
        api<Customer>(`/api/customers/${data.customerId}`),
        api<StockItem[]>('/api/stock'),
        api<WorkerB[]>('/api/worker-b'),
      ]);
      dispatch({ type: 'UPDATE_CUSTOMER', payload: norm(updatedCustomer) });
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock), workerBs: normAll(freshWBs) } });
    } catch { /* non-critical */ }
  }, []);

  const updateInvoice = useCallback(async (i: Invoice) => {
    const updated = norm(await api<Invoice>(`/api/invoices/${i.id}`, { method: 'PUT', body: JSON.stringify(i) }));
    dispatch({ type: 'UPDATE_INVOICE', payload: updated });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    await api(`/api/invoices/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_INVOICE', payload: id });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const addWorker = useCallback(async (data: Omit<Worker, 'id'>) => {
    const w = norm(await api<Worker>('/api/workers', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_WORKER', payload: w });
  }, []);

  const updateWorker = useCallback(async (w: Worker) => {
    const updated = norm(await api<Worker>(`/api/workers/${w.id}`, { method: 'PUT', body: JSON.stringify(w) }));
    dispatch({ type: 'UPDATE_WORKER', payload: updated });
  }, []);

  const deleteWorker = useCallback(async (id: string) => {
    await api(`/api/workers/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_WORKER', payload: id });
  }, []);

  const addWorkerB = useCallback(async (
    data: Omit<WorkerB, 'id' | 'createdAt' | 'totalEarnings' | 'totalPaid' | 'totalDeals'>
  ) => {
    const w = norm(await api<WorkerB>('/api/worker-b', { method: 'POST', body: JSON.stringify(data) }));
    dispatch({ type: 'ADD_WORKER_B', payload: w });
  }, []);

  const updateWorkerB = useCallback(async (w: WorkerB) => {
    const updated = norm(await api<WorkerB>(`/api/worker-b/${w.id}`, { method: 'PUT', body: JSON.stringify(w) }));
    dispatch({ type: 'UPDATE_WORKER_B', payload: updated });
  }, []);

  const deleteWorkerB = useCallback(async (id: string) => {
    await api(`/api/worker-b/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_WORKER_B', payload: id });
  }, []);

  const refreshWorkerBs = useCallback(async () => {
    const fresh = normAll(await api<WorkerB[]>('/api/worker-b'));
    dispatch({ type: 'SET_DATA', payload: { workerBs: fresh } });
  }, []);

  const setAttendance = useCallback(async (record: Omit<AttendanceRecord, 'id'>) => {
    const saved = norm(await api<AttendanceRecord>('/api/attendance', { method: 'POST', body: JSON.stringify(record) }));
    dispatch({ type: 'SET_ATTENDANCE', payload: saved });
  }, []);

  // ── Dashboard stats ────────────────────────────────────────────────────────
  const getDashboardStats = useCallback(() => {
    const totalStockKg = state.stockItems.reduce((s, i) => s + i.weightKg, 0);
    const totalStockValue = state.stockItems.reduce((s, i) => s + i.weightKg * i.pricePerKg, 0);
    const now = new Date();
    const monthlyRevenue = state.invoices
      .filter(i => {
        const d = new Date(i.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, i) => s + i.amountPaid, 0);
    const pendingPayments = state.invoices.reduce((s, i) => s + i.balance, 0);
    let totalProfit = 0, monthlyProfit = 0;
    state.invoices.forEach(i => {
      const p = invoiceProfit(i, state.stockItems).profit;
      totalProfit += p;
      const d = new Date(i.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) monthlyProfit += p;
    });
    return {
      totalStockKg,
      totalStockValue,
      totalCompanies: state.companies.length,
      totalCustomers: state.customers.length,
      totalInvoices: state.invoices.length,
      monthlyRevenue,
      monthlyProfit,
      totalProfit,
      pendingPayments,
      activeWorkers: state.workers.filter(w => w.isActive).length,
      lowStockItems: state.stockItems.filter(s => s.status !== 'In Stock').length,
    };
  }, [state]);

  return (
    <AppContext.Provider value={{
      state, loading, error, dispatch,
      addCompany, updateCompany, deleteCompany,
      addStock, updateStock, deleteStock,
      addScrap, deleteScrap,
      addCustomer, updateCustomer, deleteCustomer,
      addInvoice, updateInvoice, deleteInvoice,
      addWorker, updateWorker, deleteWorker,
      addWorkerB, updateWorkerB, deleteWorkerB, refreshWorkerBs,
      setAttendance, getDashboardStats,
    }}>
      {loading ? (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950 z-50">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Connecting to database…</p>
          </div>
        </div>
      ) : error ? (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950 z-50">
          <div className="card p-6 max-w-sm text-center space-y-3">
            <div className="text-3xl">⚠️</div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Database Error</h2>
            <p className="text-sm text-gray-500">{error}</p>
            <p className="text-xs text-gray-400">
              Check your <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.local</code> and ensure MongoDB is reachable.
            </p>
            <button onClick={() => window.location.reload()} className="btn-primary w-full justify-center">
              Retry
            </button>
          </div>
        </div>
      ) : children}
    </AppContext.Provider>
  );
}


export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
