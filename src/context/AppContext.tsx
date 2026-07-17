'use client';

import React, {
  createContext, useContext, useReducer, useEffect, useCallback, useState, useRef,
} from 'react';
import type {
  AppState, Company, StockItem, ScrapItem, LedgerEntry, Expense, Customer, Invoice, Worker, WorkerB, AttendanceRecord,
} from '@/lib/types';
import { getStockStatus, generateObjectId } from '@/lib/utils';
import { invoiceProfit } from '@/lib/profit';
import { computeRunningBalances } from '@/lib/ledger';
import { getQueue, enqueue, flushQueue } from '@/lib/syncQueue';

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
  | { type: 'SET_LEDGER_FOR_COMPANY'; payload: { companyId: string; entries: LedgerEntry[] } }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
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
  companies: [], stockItems: [], scrapItems: [], ledgerEntries: [], expenses: [], customers: [],
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

    case 'SET_LEDGER_FOR_COMPANY':
      return {
        ...state,
        ledgerEntries: [
          ...state.ledgerEntries.filter(e => e.companyId !== action.payload.companyId),
          ...action.payload.entries,
        ],
      };

    case 'ADD_EXPENSE':    return { ...state, expenses: [action.payload, ...state.expenses] };
    case 'UPDATE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

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

// ─── Ledger entry input (shared shape for add/update) ─────────────────────────
interface LedgerEntryInput {
  companyId: string;
  type: 'Purchase' | 'Payment';
  date: string;
  note?: string;
  items?: {
    name: string; qty: number; rate: number;
    stockItemId?: string; category?: string; grade?: string; unit?: string;
    quantityUnits?: number; batchNumber?: string; location?: string; notes?: string;
  }[];
  amount?: number;
  method?: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Other';
  reference?: string;
}

// ─── API helper (offline-aware) ────────────────────────────────────────────
// Mutations (non-GET) that supply an `offlineFallback` are queued to
// localStorage instead of failing when there's no connection — the caller
// gets back an optimistic value to apply locally right away, and the real
// request replays (in order) once syncNow()/reconnect flushes the queue.
// GET requests are untouched: they fail normally, same as before.
async function api<T>(url: string, opts?: RequestInit, offlineFallback?: () => T): Promise<T> {
  const method = (opts?.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET';

  const queueAndFallback = (): T => {
    enqueue({ url, method, body: opts?.body as string | undefined });
    return offlineFallback!();
  };

  if (isMutation && offlineFallback) {
    const knownOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    // Once anything is queued, keep queuing new mutations behind it so
    // requests replay in the order they were made.
    if (knownOffline || getQueue().length > 0) {
      return queueAndFallback();
    }
  }

  try {
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
  } catch (err) {
    // A real fetch/network failure surfaces as a TypeError — anything else
    // (UNAUTHORIZED, a parsed API error) is a genuine response and should
    // reject normally rather than being queued forever.
    if (isMutation && offlineFallback && err instanceof TypeError) {
      return queueAndFallback();
    }
    throw err;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  dispatch: React.Dispatch<Action>;
  pendingCount: number;
  syncStatus: 'saved' | 'pending' | 'syncing';
  syncNow: () => Promise<void>;
  addCompany: (data: Omit<Company, 'id' | 'createdAt' | 'totalPurchased' | 'totalCost'>) => Promise<Company>;
  updateCompany: (c: Company) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addStock: (data: Omit<StockItem, 'id' | 'status'>) => Promise<void>;
  updateStock: (s: StockItem) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  addScrap: (data: { stockItemId: string; weightKg: number; notes?: string; date?: string }) => Promise<void>;
  deleteScrap: (id: string) => Promise<void>;
  restoreScrap: (id: string) => Promise<void>;
  addLedgerEntry: (data: LedgerEntryInput) => Promise<void>;
  updateLedgerEntry: (id: string, data: LedgerEntryInput) => Promise<void>;
  deleteLedgerEntry: (id: string, companyId: string) => Promise<void>;
  addExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
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
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'pending' | 'syncing'>('saved');
  const syncingRef = useRef(false);

  // ── Full reload: fetch every collection and replace local state ───────────
  // Used on mount, and again after a successful sync so anything only
  // approximated locally while offline (ledger balances, company/customer
  // totals, stock status, real invoice numbers) gets the true server values.
  const reloadAll = useCallback(async () => {
    const [companies, stockItems, scrapItems, ledgerEntries, expenses, customers, invoices, workers, workerBs, attendance] =
      await Promise.all([
        api<Company[]>('/api/companies').then(normAll),
        api<StockItem[]>('/api/stock').then(normAll),
        api<ScrapItem[]>('/api/scrap').then(normAll),
        api<LedgerEntry[]>('/api/ledger').then(normAll),
        api<Expense[]>('/api/expenses').then(normAll),
        api<Customer[]>('/api/customers').then(normAll),
        api<Invoice[]>('/api/invoices').then(normAll),
        api<Worker[]>('/api/workers').then(normAll),
        api<WorkerB[]>('/api/worker-b').then(normAll),
        api<AttendanceRecord[]>('/api/attendance').then(normAll),
      ]);
    dispatch({
      type: 'SET_DATA',
      payload: { companies, stockItems, scrapItems, ledgerEntries, expenses, customers, invoices, workers, workerBs, attendance },
    });
  }, []);

  // ── Load all data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    // Skip loading on the login page — no session exists there
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        await reloadAll();
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
    })();
  }, [reloadAll]);

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

  // ── Offline sync ────────────────────────────────────────────────────────
  const refreshPendingCount = useCallback(() => {
    const n = getQueue().length;
    setPendingCount(n);
    setSyncStatus(n > 0 ? 'pending' : 'saved');
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (getQueue().length === 0) { refreshPendingCount(); return; }
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const { success } = await flushQueue();
      if (success) {
        try { await reloadAll(); } catch { /* will retry on the next successful sync */ }
      }
    } finally {
      syncingRef.current = false;
      refreshPendingCount();
    }
  }, [reloadAll, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    const handleOnline = () => { syncNow(); };
    const handleOffline = () => { refreshPendingCount(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) syncNow(); // catch up on a queue left over from a previous session
    // Safety net in case the browser's `online` event doesn't fire reliably
    const retryTimer = setInterval(() => {
      if (navigator.onLine && getQueue().length > 0) syncNow();
    }, 30000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(retryTimer);
    };
  }, [syncNow, refreshPendingCount]);

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const addCompany = useCallback(async (
    data: Omit<Company, 'id' | 'createdAt' | 'totalPurchased' | 'totalCost'>
  ) => {
    const payload = { ...data, _id: generateObjectId() };
    const c = norm(await api<Company>('/api/companies', { method: 'POST', body: JSON.stringify(payload) },
      () => ({ ...payload, createdAt: new Date().toISOString(), totalPurchased: 0, totalCost: 0 } as unknown as Company)));
    dispatch({ type: 'ADD_COMPANY', payload: c });
    return c;
  }, []);

  const updateCompany = useCallback(async (c: Company) => {
    const updated = norm(await api<Company>(`/api/companies/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }, () => c));
    dispatch({ type: 'UPDATE_COMPANY', payload: updated });
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    await api(`/api/companies/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_COMPANY', payload: id });
  }, []);

  const addStock = useCallback(async (data: Omit<StockItem, 'id' | 'status'>) => {
    const payload = { ...data, _id: generateObjectId(), status: getStockStatus(data.weightKg, data.category) };
    const s = norm(await api<StockItem>('/api/stock', { method: 'POST', body: JSON.stringify(payload) }, () => payload as unknown as StockItem));
    dispatch({ type: 'ADD_STOCK', payload: s });
  }, []);

  const updateStock = useCallback(async (s: StockItem) => {
    const payload = { ...s, status: getStockStatus(s.weightKg, s.category) };
    const updated = norm(await api<StockItem>(`/api/stock/${s.id}`, { method: 'PUT', body: JSON.stringify(payload) }, () => payload));
    dispatch({ type: 'UPDATE_STOCK', payload: updated });
  }, []);

  const deleteStock = useCallback(async (id: string) => {
    await api(`/api/stock/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_STOCK', payload: id });
  }, []);

  const addScrap = useCallback(async (
    data: { stockItemId: string; weightKg: number; notes?: string; date?: string }
  ) => {
    const payload = { ...data, _id: generateObjectId() };
    const source = state.stockItems.find(si => si.id === data.stockItemId);
    const s = norm(await api<ScrapItem>('/api/scrap', { method: 'POST', body: JSON.stringify(payload) }, () => ({
      ...payload,
      category: source?.category ?? 'Steel',
      steelType: source?.steelType ?? '',
      grade: source?.grade ?? '',
      unit: source?.unit ?? 'piece',
      pricePerKg: source?.pricePerKg ?? 0,
      companyName: source?.companyName ?? '',
      batchNumber: source?.batchNumber ?? '',
      date: data.date ?? new Date().toISOString().split('T')[0],
    } as unknown as ScrapItem)));
    dispatch({ type: 'ADD_SCRAP', payload: s });
    // Refresh stock so the deducted batch shows its new remaining quantity
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, [state.stockItems]);

  // Permanent delete — the scrap record is removed, stock is untouched
  const deleteScrap = useCallback(async (id: string) => {
    await api(`/api/scrap/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_SCRAP', payload: id });
  }, []);

  // Restore — puts the quantity back into its stock batch, then removes the scrap record
  const restoreScrap = useCallback(async (id: string) => {
    await api(`/api/scrap/${id}/restore`, { method: 'POST' }, () => undefined);
    dispatch({ type: 'DELETE_SCRAP', payload: id });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  // ── Company payment ledger ──────────────────────────────────────────────
  // Running balances depend on a company's whole entry history, so after any
  // mutation we refetch that company's slice rather than patch one entry.
  const refreshLedgerForCompany = useCallback(async (companyId: string) => {
    const fresh = normAll(await api<LedgerEntry[]>(`/api/ledger?companyId=${companyId}`));
    dispatch({ type: 'SET_LEDGER_FOR_COMPANY', payload: { companyId, entries: fresh } });
  }, []);

  // Offline fallback for the ledger: approximates running balances locally
  // (using the same math the server uses) so the entry list stays usable
  // until the queued write syncs and refreshLedgerForCompany gets the real thing.
  const applyLedgerOptimistically = useCallback((companyId: string, entries: LedgerEntry[]) => {
    const withBalances = computeRunningBalances(entries);
    dispatch({ type: 'SET_LEDGER_FOR_COMPANY', payload: { companyId, entries: withBalances } });
  }, []);

  const addLedgerEntry = useCallback(async (data: LedgerEntryInput) => {
    const payload = { ...data, _id: generateObjectId() };
    const amount = data.type === 'Purchase'
      ? (data.items ?? []).reduce((s, it) => s + it.qty * it.rate, 0)
      : (data.amount ?? 0);
    const optimisticEntry = norm({ ...payload, amount, createdAt: new Date().toISOString() }) as unknown as LedgerEntry;
    await api('/api/ledger', { method: 'POST', body: JSON.stringify(payload) }, () => optimisticEntry);
    try {
      await refreshLedgerForCompany(data.companyId);
    } catch {
      const others = state.ledgerEntries.filter(e => e.companyId === data.companyId);
      applyLedgerOptimistically(data.companyId, [...others, optimisticEntry]);
    }
    if (data.type === 'Purchase') {
      // A matching stock item may have been bumped server-side
      try {
        const freshStock = await api<StockItem[]>('/api/stock');
        dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
      } catch { /* non-critical */ }
    }
  }, [refreshLedgerForCompany, applyLedgerOptimistically, state.ledgerEntries]);

  const updateLedgerEntry = useCallback(async (id: string, data: LedgerEntryInput) => {
    const amount = data.type === 'Purchase'
      ? (data.items ?? []).reduce((s, it) => s + it.qty * it.rate, 0)
      : (data.amount ?? 0);
    const existing = state.ledgerEntries.find(e => e.id === id);
    const optimisticEntry = { ...(existing ?? {} as LedgerEntry), ...data, id, amount } as LedgerEntry;
    await api(`/api/ledger/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => optimisticEntry);
    try {
      await refreshLedgerForCompany(data.companyId);
    } catch {
      const others = state.ledgerEntries.filter(e => e.companyId === data.companyId && e.id !== id);
      applyLedgerOptimistically(data.companyId, [...others, optimisticEntry]);
    }
    // Purchase edits may have adjusted stock (old effect reversed, new effect applied)
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, [refreshLedgerForCompany, applyLedgerOptimistically, state.ledgerEntries]);

  const deleteLedgerEntry = useCallback(async (id: string, companyId: string) => {
    await api(`/api/ledger/${id}`, { method: 'DELETE' }, () => undefined);
    try {
      await refreshLedgerForCompany(companyId);
    } catch {
      const remaining = state.ledgerEntries.filter(e => e.companyId === companyId && e.id !== id);
      applyLedgerOptimistically(companyId, remaining);
    }
    // Deleting a Purchase reverses its stock effect server-side
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, [refreshLedgerForCompany, applyLedgerOptimistically, state.ledgerEntries]);

  // ── Expenses ────────────────────────────────────────────────────────────
  const addExpense = useCallback(async (data: Omit<Expense, 'id' | 'createdAt'>) => {
    const payload = { ...data, _id: generateObjectId() };
    const e = norm(await api<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(payload) },
      () => ({ ...payload, createdAt: new Date().toISOString() } as unknown as Expense)));
    dispatch({ type: 'ADD_EXPENSE', payload: e });
  }, []);

  const updateExpense = useCallback(async (e: Expense) => {
    const updated = norm(await api<Expense>(`/api/expenses/${e.id}`, { method: 'PUT', body: JSON.stringify(e) }, () => e));
    dispatch({ type: 'UPDATE_EXPENSE', payload: updated });
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    await api(`/api/expenses/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
  }, []);

  const addCustomer = useCallback(async (
    data: Omit<Customer, 'id' | 'createdAt' | 'totalPurchases' | 'totalSpent' | 'pendingBalance'>
  ) => {
    const payload = { ...data, _id: generateObjectId() };
    const c = norm(await api<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(payload) },
      () => ({ ...payload, createdAt: new Date().toISOString(), totalPurchases: 0, totalSpent: 0, pendingBalance: 0 } as unknown as Customer)));
    dispatch({ type: 'ADD_CUSTOMER', payload: c });
    return c;
  }, []);

  const updateCustomer = useCallback(async (c: Customer) => {
    const updated = norm(await api<Customer>(`/api/customers/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }, () => c));
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await api(`/api/customers/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_CUSTOMER', payload: id });
  }, []);

  const addInvoice = useCallback(async (data: Omit<Invoice, 'id' | 'invoiceNumber'>) => {
    const payload = { ...data, _id: generateObjectId() };
    const i = norm(await api<Invoice>('/api/invoices', { method: 'POST', body: JSON.stringify(payload) },
      // Real invoice numbers are assigned sequentially server-side — this
      // placeholder is replaced once the queued write syncs and reloadAll() runs.
      () => ({ ...payload, invoiceNumber: 'Pending…', createdAt: new Date().toISOString().split('T')[0] } as unknown as Invoice)));
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
    const updated = norm(await api<Invoice>(`/api/invoices/${i.id}`, { method: 'PUT', body: JSON.stringify(i) }, () => i));
    dispatch({ type: 'UPDATE_INVOICE', payload: updated });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    await api(`/api/invoices/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_INVOICE', payload: id });
    try {
      const freshStock = await api<StockItem[]>('/api/stock');
      dispatch({ type: 'SET_DATA', payload: { stockItems: normAll(freshStock) } });
    } catch { /* non-critical */ }
  }, []);

  const addWorker = useCallback(async (data: Omit<Worker, 'id'>) => {
    const payload = { ...data, _id: generateObjectId() };
    const w = norm(await api<Worker>('/api/workers', { method: 'POST', body: JSON.stringify(payload) }, () => payload as unknown as Worker));
    dispatch({ type: 'ADD_WORKER', payload: w });
  }, []);

  const updateWorker = useCallback(async (w: Worker) => {
    const updated = norm(await api<Worker>(`/api/workers/${w.id}`, { method: 'PUT', body: JSON.stringify(w) }, () => w));
    dispatch({ type: 'UPDATE_WORKER', payload: updated });
  }, []);

  const deleteWorker = useCallback(async (id: string) => {
    await api(`/api/workers/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_WORKER', payload: id });
  }, []);

  const addWorkerB = useCallback(async (
    data: Omit<WorkerB, 'id' | 'createdAt' | 'totalEarnings' | 'totalPaid' | 'totalDeals'>
  ) => {
    const payload = { ...data, _id: generateObjectId() };
    const w = norm(await api<WorkerB>('/api/worker-b', { method: 'POST', body: JSON.stringify(payload) },
      () => ({ ...payload, createdAt: new Date().toISOString(), totalEarnings: 0, totalPaid: 0, totalDeals: 0 } as unknown as WorkerB)));
    dispatch({ type: 'ADD_WORKER_B', payload: w });
  }, []);

  const updateWorkerB = useCallback(async (w: WorkerB) => {
    const updated = norm(await api<WorkerB>(`/api/worker-b/${w.id}`, { method: 'PUT', body: JSON.stringify(w) }, () => w));
    dispatch({ type: 'UPDATE_WORKER_B', payload: updated });
  }, []);

  const deleteWorkerB = useCallback(async (id: string) => {
    await api(`/api/worker-b/${id}`, { method: 'DELETE' }, () => undefined);
    dispatch({ type: 'DELETE_WORKER_B', payload: id });
  }, []);

  const refreshWorkerBs = useCallback(async () => {
    const fresh = normAll(await api<WorkerB[]>('/api/worker-b'));
    dispatch({ type: 'SET_DATA', payload: { workerBs: fresh } });
  }, []);

  const setAttendance = useCallback(async (record: Omit<AttendanceRecord, 'id'>) => {
    const payload = { ...record, _id: generateObjectId() };
    const saved = norm(await api<AttendanceRecord>('/api/attendance', { method: 'POST', body: JSON.stringify(payload) }, () => payload as unknown as AttendanceRecord));
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
    let grossProfit = 0, grossMonthlyProfit = 0;
    state.invoices.forEach(i => {
      const p = invoiceProfit(i, state.stockItems).profit;
      grossProfit += p;
      const d = new Date(i.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) grossMonthlyProfit += p;
    });
    let totalExpenses = 0, monthlyExpenses = 0;
    state.expenses.forEach(e => {
      totalExpenses += e.amount;
      const d = new Date(e.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) monthlyExpenses += e.amount;
    });
    return {
      totalStockKg,
      totalStockValue,
      totalCompanies: state.companies.length,
      totalCustomers: state.customers.length,
      totalInvoices: state.invoices.length,
      monthlyRevenue,
      monthlyProfit: grossMonthlyProfit - monthlyExpenses,
      totalProfit: grossProfit - totalExpenses,
      monthlyExpenses,
      totalExpenses,
      pendingPayments,
      activeWorkers: state.workers.filter(w => w.isActive).length,
      lowStockItems: state.stockItems.filter(s => s.status !== 'In Stock').length,
    };
  }, [state]);

  return (
    <AppContext.Provider value={{
      state, loading, error, dispatch,
      pendingCount, syncStatus, syncNow,
      addCompany, updateCompany, deleteCompany,
      addStock, updateStock, deleteStock,
      addScrap, deleteScrap, restoreScrap,
      addLedgerEntry, updateLedgerEntry, deleteLedgerEntry,
      addExpense, updateExpense, deleteExpense,
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
