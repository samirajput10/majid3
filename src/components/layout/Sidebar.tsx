'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Package, Boxes, Users, FileText,
  HardHat, ChevronRight, X, Zap, Briefcase,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/companies',  label: 'Companies',  icon: Building2 },
  { href: '/inventory',  label: 'Steel Stock', icon: Package },
  { href: '/cement',     label: 'Cement Stock', icon: Boxes },
  { href: '/customers',  label: 'Customers',  icon: Users },
  { href: '/invoices',   label: 'Invoices',   icon: FileText },
  { href: '/workers',    label: 'Workers',    icon: HardHat },
  { href: '/worker-b',   label: 'Worker B',   icon: Briefcase },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { state, dispatch } = useApp();

  return (
    <>
      {/* Mobile overlay */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-30 flex flex-col',
          'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700/50',
          'transition-transform duration-300 ease-in-out',
          'w-[260px]',
          state.sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white leading-none">Majid Steel</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Warehouse System</div>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Main Menu
          </p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn('sidebar-link group', active && 'active')}
                onClick={() => {
                  // Close sidebar on mobile after nav
                  if (window.innerWidth < 1024) dispatch({ type: 'TOGGLE_SIDEBAR' });
                }}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">Admin</p>
              <p className="text-[10px] text-gray-400 truncate">Warehouse Manager</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
