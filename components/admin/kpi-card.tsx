import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType | React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  accent?: 'red' | 'green' | 'blue' | 'amber' | 'purple';
  loading?: boolean;
}

const accentConfig = {
  red: { bg: 'bg-[#E50914]/10', text: 'text-[#E50914]' },
  green: { bg: 'bg-[#10b981]/10', text: 'text-[#10b981]' },
  blue: { bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]' },
  amber: { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  accent = 'red',
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-lg p-5 w-full">
        <div className="flex justify-between items-start mb-4">
          <Skeleton className="h-4 w-24 bg-[#2A2A2A]" />
          <Skeleton className="h-10 w-10 rounded-md bg-[#2A2A2A]" />
        </div>
        <Skeleton className="h-8 w-16 bg-[#2A2A2A] mb-2" />
        <Skeleton className="h-3 w-32 bg-[#2A2A2A]" />
      </div>
    );
  }

  const { bg, text } = accentConfig[accent];
  const isPositive = delta && delta > 0;
  const isNegative = delta && delta < 0;

  return (
    <div className="bg-[#181818] border border-[#2A2A2A] rounded-lg p-5 w-full hover:border-[#3a3a3a] transition-colors duration-150">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[13px] font-medium text-[#A3A3A3]">{title}</h3>
        <div className={cn("flex items-center justify-center w-10 h-10 rounded-md", bg)}>
          {typeof Icon === 'function' ? <Icon className={cn("w-4 h-4", text)} /> : Icon ?? <span className={cn("w-2 h-2 rounded-full bg-current", text)} />}
        </div>
      </div>
      <div className="text-[28px] font-bold text-white mb-1">
        {value}
      </div>
      {delta !== undefined && (
        <div className="flex items-center text-xs">
          <span
            className={cn(
              "flex items-center font-medium mr-1.5",
              isPositive ? "text-[#10b981]" : isNegative ? "text-[#E50914]" : "text-[#A3A3A3]"
            )}
          >
            {isPositive ? <ArrowUp size={12} className="mr-0.5" /> : isNegative ? <ArrowDown size={12} className="mr-0.5" /> : null}
            {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className="text-[#A3A3A3]">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
