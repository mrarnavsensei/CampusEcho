'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KpiCard } from '@/components/admin/kpi-card';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { KpiCardSkeleton, TableSkeleton } from '@/components/admin/admin-skeleton';
import { useRouter } from 'next/navigation';
import { AdminPagination } from '@/components/admin/pagination';

export default function EventsPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('All');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ published: 0, upcoming: 0 });

  useEffect(() => {
    setLoading(true); setError(null);
    const controller = new AbortController();
    fetch(`/api/admin/events?page=${page}&status=${tab.toLowerCase()}`, { signal: controller.signal })
      .then(r => r.json<any>())
      .then(res => { if (res.error) setError(res.error.message); else { setData(res.data?.items || []); setTotal(res.data?.total || 0); setStats(res.data?.stats || { published: 0, upcoming: 0 }); } })
      .catch(() => { if (!controller.signal.aborted) setError('Failed to load.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, tab]);

  const filteredData = data.filter(item => {
    if (tab === 'All') return true;
    return item.status.toLowerCase() === tab.toLowerCase();
  });

  return (
    <div className="p-6 space-y-6 text-[#A3A3A3]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Events & Competitions</h1>
          <p className="text-sm">Manage campus events and game tournaments.</p>
        </div>
        <Link href="/admin/events/new" className="px-4 py-2 bg-[#E50914] text-white rounded-lg hover:bg-red-700 transition">
          Create Event
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard title="Matching Events" value={total} />
            <KpiCard title="Published" value={stats.published} />
            <KpiCard title="Upcoming" value={stats.upcoming} />
          </>
        )}
      </div>

      <div className="bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
        <div className="flex space-x-4 border-b border-[#2A2A2A] pb-2 mb-4 overflow-x-auto">
          {['All', 'Draft', 'Published', 'Ongoing', 'Completed', 'Archived'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`pb-2 px-1 border-b-2 transition ${tab === t ? 'border-[#E50914] text-white' : 'border-transparent hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <div className="p-4 mb-4 border border-[#E50914] rounded-lg text-[#E50914]">{error}</div>}
        
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            data={filteredData}
            columns={[
              { key: 'name', label: 'Event Name', render: (row: any) => <div><span className="text-white">{row.title}</span> <span className="text-xs bg-[#202020] px-2 py-1 rounded ml-2">{row.game || 'None'}</span></div> },
              { key: 'status', label: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
              { key: 'startsAt', label: 'Date', render: (row: any) => new Date(row.startsAt).toLocaleString() },
              { key: 'capacity', label: 'Capacity', render: (row: any) => row.capacity || 'Unlimited' },
              { key: 'registrations', label: 'Registrations', render: (row: any) => row.registrationsCount || 0 },
              { key: 'actions', label: 'Actions', render: (row: any) => (
                <div className="flex space-x-3">
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/admin/events/${row.id}`); }} className="text-blue-400 hover:underline">View</button>
                </div>
              )}
            ]}
            onRowClick={(row) => router.push(`/admin/events/${row.id}`)}
          />
        )}
      </div>
      <AdminPagination page={page} total={total} loading={loading} onChange={setPage} />
    </div>
  );
}
