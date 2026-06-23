import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label?: string };
  className?: string;
  onClick?: () => void;
}

export default function StatCard({
  title, value, sub, icon: Icon,
  iconColor = 'text-blue-600', iconBg = 'bg-blue-50 dark:bg-blue-900/20',
  trend, className, onClick,
}: StatCardProps) {
  return (
    <div
      className={cn('card p-4 flex items-start gap-4', onClick && 'cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all', className)}
      onClick={onClick}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        {trend !== undefined && (
          <p className={cn(
            'text-xs font-medium mt-1',
            trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
          )}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            {trend.label && <span className="text-gray-400 font-normal ml-1">{trend.label}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
