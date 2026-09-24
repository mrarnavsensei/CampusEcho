import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function KpiCardSkeleton() {
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

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-[#2A2A2A] overflow-hidden bg-[#111111]">
      <div className="bg-[#080808] border-b border-[#2A2A2A] p-4 flex gap-4">
        <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
        <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
        <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
        <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
      </div>
      <div className="divide-y divide-[#2A2A2A]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("p-4 flex gap-4", i % 2 === 0 ? "bg-[#111111]" : "bg-[#141414]")}>
            <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
            <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
            <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
            <Skeleton className="h-4 w-1/4 bg-[#2A2A2A]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-8 w-64 bg-[#2A2A2A]" />
      <Skeleton className="h-4 w-96 bg-[#2A2A2A]" />
    </div>
  );
}
