'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminRequest, type AdminPage } from '@/lib/admin-client';
import { AdminPagination } from '@/components/admin/pagination';
import { StatusBadge } from '@/components/admin/status-badge';
import { TableSkeleton } from '@/components/admin/admin-skeleton';

type Report = { id: string; type: string; targetId: string; reason: string; details: string; status: string; createdAt: string };
export default function ModerationPage() {
  const [data, setData] = useState<AdminPage<Report> | null>(null);
  const [page, setPage] = useState(1), [query, setQuery] = useState(''), [status, setStatus] = useState('open'), [type, setType] = useState('all');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const params = new URLSearchParams({ page: String(page), q: query, status, targetType: type });
      adminRequest<AdminPage<Report>>(`/api/admin/moderation?${params}`, { signal: controller.signal }).then(setData).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, query, status, type, refresh]);
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Content moderation</h1><p className="text-[#A3A3A3] mt-1">Review reported content, record decisions, and assign follow-up.</p></div>
    <div className="flex flex-wrap gap-3">
      <input className="admin-input flex-1" aria-label="Search reports" placeholder="Search report ID or reason" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <select className="admin-input" aria-label="Report status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{['all', 'open', 'resolved', 'dismissed'].map(s => <option key={s} value={s}>{s}</option>)}</select>
      <select className="admin-input" aria-label="Content type" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>{['all', 'post', 'comment', 'user', 'message', 'voice_room'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
    </div>
    {error && <div role="alert" className="admin-error">{error} <button className="underline" onClick={() => setRefresh(x => x + 1)}>Retry</button></div>}
    {loading ? <TableSkeleton /> : <div className="space-y-3">{data?.items.map(report => <article key={report.id} className="admin-panel flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><div className="flex gap-3 items-center text-sm"><span className="capitalize">{report.type.replace('_', ' ')}</span><StatusBadge status={report.status} /><time className="text-[#A3A3A3]">{new Date(report.createdAt).toLocaleDateString()}</time></div><h2 className="font-semibold mt-3">{report.reason}</h2><p className="text-sm text-[#A3A3A3] mt-1 break-words">{report.details || 'No additional details.'}</p></div>
      <Link className="admin-button" href={`/admin/moderation/${report.id}`}>Review report</Link>
    </article>)}{!data?.items.length && <div className="admin-panel text-center text-[#A3A3A3]">No reports match these filters.</div>}</div>}
    <AdminPagination page={page} total={data?.total ?? 0} loading={loading} onChange={setPage} />
  </div>;
}
