'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, Moon, Sun, Bell, X, LogOut, Check, CloudOff, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { matchPhone } from '@/lib/utils';

export default function TopBar() {
  const { state, dispatch, syncStatus, pendingCount, syncNow } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; label: string; sub: string; href: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const lq = q.toLowerCase();
    const found: typeof results = [];

    state.customers.forEach(c => {
      if (c.name.toLowerCase().includes(lq) || matchPhone(c.phone, q)) {
        found.push({ type: 'Customer', label: c.name, sub: c.phone, href: `/customers?phone=${encodeURIComponent(c.phone)}` });
      }
    });
    state.companies.forEach(c => {
      if (c.name.toLowerCase().includes(lq)) {
        found.push({ type: 'Company', label: c.name, sub: c.contactPerson, href: `/companies?id=${c.id}` });
      }
    });
    state.invoices.forEach(i => {
      if (i.invoiceNumber.toLowerCase().includes(lq) || i.customerName.toLowerCase().includes(lq)) {
        found.push({ type: 'Invoice', label: i.invoiceNumber, sub: i.customerName, href: `/invoices?id=${i.id}` });
      }
    });

    setResults(found.slice(0, 8));
    setOpen(found.length > 0);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleSelect = (href: string) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    router.push(href);
  };

  const typeColors: Record<string, string> = {
    Customer: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    Company:  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    Invoice:  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <header className="sticky top-0 z-10 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/50 flex items-center gap-3 px-4">
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div ref={ref} className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search customers, companies, invoices..."
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}

        {open && results.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColors[r.type] ?? ''}`}>
                  {r.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.label}</div>
                  <div className="text-xs text-gray-400 truncate">{r.sub}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Notifications (placeholder) */}
        <button className="relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Bell size={17} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_DARK' })}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Toggle dark mode"
        >
          {state.darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* User + Logout */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-none">Majid</p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Admin</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            M
          </div>
          <button
            onClick={() => syncNow()}
            disabled={syncStatus === 'syncing'}
            title={
              syncStatus === 'saved' ? 'All changes saved'
                : syncStatus === 'syncing' ? 'Syncing…'
                : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync — click to retry now`
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-default ${
              syncStatus === 'pending'
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                : syncStatus === 'syncing'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {syncStatus === 'syncing' ? <RefreshCw size={14} className="animate-spin" />
              : syncStatus === 'pending' ? <CloudOff size={14} />
              : <Check size={14} />}
            <span className="hidden sm:inline">
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'pending' ? `Pending (${pendingCount})` : 'Saved'}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
