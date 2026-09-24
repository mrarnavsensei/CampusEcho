import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { color: string, bg: string, pulse?: boolean }> = {
  active: { color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  suspended: { color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  banned: { color: 'text-[#E50914]', bg: 'bg-[#E50914]/10' },
  pending: { color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  open: { color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  resolved: { color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  dismissed: { color: 'text-[#A3A3A3]', bg: 'bg-[#A3A3A3]/10' },
  live: { color: 'text-[#E50914]', bg: 'bg-[#E50914]/10', pulse: true },
  ended: { color: 'text-[#A3A3A3]', bg: 'bg-[#A3A3A3]/10' },
  published: { color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  draft: { color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10' },
  archived: { color: 'text-[#A3A3A3]', bg: 'bg-[#A3A3A3]/10' },
  super_admin: { color: 'text-[#a855f7]', bg: 'bg-[#a855f7]/10' },
  moderator: { color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10' },
  event_manager: { color: 'text-[#f97316]', bg: 'bg-[#f97316]/10' },
  support_admin: { color: 'text-[#14b8a6]', bg: 'bg-[#14b8a6]/10' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || { color: 'text-[#A3A3A3]', bg: 'bg-[#A3A3A3]/10' };
  
  // Extract dot color from the text class (e.g., text-[#10b981] -> bg-[#10b981])
  const dotColorClass = config.color.replace('text-', 'bg-');

  return (
    <div className={cn(
      "inline-flex items-center rounded-full font-medium border border-transparent",
      config.bg,
      config.color,
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
    )}>
      <div className={cn(
        "rounded-full shrink-0",
        size === 'sm' ? "w-1.5 h-1.5 mr-1.5" : "w-2 h-2 mr-2",
        dotColorClass,
        config.pulse && "animate-pulse"
      )} />
      <span className="capitalize">{status.replace('_', ' ')}</span>
    </div>
  );
}
