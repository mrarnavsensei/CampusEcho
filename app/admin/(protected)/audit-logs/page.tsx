'use client';
import { useEffect, useState } from 'react';
import { adminRequest, type AdminPage } from '@/lib/admin-client';
import { AdminPagination } from '@/components/admin/pagination';
import { TableSkeleton } from '@/components/admin/admin-skeleton';
type Audit = { id: string; action: string; targetType: string; targetId: string | null; createdAt: string; metadata: { admin_actor_id?: string; note?: string; reason?: string } };
export default function AuditLogsPage() {
  const [data, setData] = useState<AdminPage<Audit> | null>(null), [query, setQuery] = useState(''), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { setLoading(true); setError(''); adminRequest<AdminPage<Audit>>(`/api/admin/audit-logs?${new URLSearchParams({ q: query, page: String(page) })}`, { signal: controller.signal }).then(setData).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 200); return () => { clearTimeout(timer); controller.abort(); }; }, [query, page, refresh]);
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Audit logs</h1><p className="text-[#A3A3A3] mt-1">Administrative actions and the reasons recorded for them.</p></div><input aria-label="Search audit logs" className="admin-input w-full" value={query} placeholder="Search action, target type, or target ID" onChange={e => { setQuery(e.target.value); setPage(1); }} />
    {error && <p role="alert" className="admin-error">{error} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    {loading ? <TableSkeleton /> : <div className="space-y-3">{data?.items.map(row => <article className="admin-panel" key={row.id}><p className="font-mono text-sm">{row.action}</p><p className="text-sm text-[#A3A3A3] mt-1 break-all">{row.targetType} {row.targetId} · {new Date(row.createdAt).toLocaleString()}</p><p className="text-xs text-[#A3A3A3] mt-1">Actor: {row.metadata.admin_actor_id || 'System / user'}</p>{(row.metadata.note || row.metadata.reason) && <p className="mt-3 whitespace-pre-wrap">{row.metadata.note || row.metadata.reason}</p>}</article>)}{!data?.items.length && <p className="admin-panel text-[#A3A3A3]">No matching audit records.</p>}</div>}
    <AdminPagination page={page} total={data?.total ?? 0} onChange={setPage} loading={loading} /><p className="text-xs text-[#A3A3A3]">Audit records cannot be changed through the application. Retention and backups must follow your organization’s documented policy.</p>
  </div>;
}
