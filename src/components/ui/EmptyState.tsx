import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
        <Icon size={28} className="text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  );
}
