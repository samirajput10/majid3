'use client';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useApp } from '@/context/AppContext';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const pathname = usePathname();

  // Login page renders standalone — no chrome
  if (pathname.startsWith('/login')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          state.sidebarOpen ? 'lg:pl-[260px]' : 'lg:pl-0'
        )}
      >
        <TopBar />
        <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
