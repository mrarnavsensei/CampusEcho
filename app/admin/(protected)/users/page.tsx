'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminRequest, type AdminPage } from '@/lib/admin-client';
import { AdminPagination } from '@/components/admin/pagination';
import { StatusBadge } from '@/components/admin/status-badge';
import { TableSkeleton } from '@/components/admin/admin-skeleton';
type User = { id: string; displayName: string; handle: string; email: string; campus: string; status: string; verificationStatus: string; emailVerifiedAt: string | null; createdAt: string };
type Result = AdminPage<User> & { colleges: Array<{ id: string; name: string }> };
export default function AdminUsersPage() {
  const [data, setData] = useState<Result | null>(null), [page, setPage] = useState(1), [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [campus, setCampus] = useState('all');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      adminRequest<Result>(`/api/admin/users?${new URLSearchParams({ page: String(page), q: query, status, campus })}`, { signal: controller.signal }).then(setData).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, query, status, campus, refresh]);
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Users</h1><p className="text-[#A3A3A3] mt-1">Account access, student verification, and moderation history.</p></div>
    <div className="flex flex-wrap gap-3"><input className="admin-input flex-1" aria-label="Search users" placeholder="Search email, name, or handle" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><select className="admin-input" aria-label="Account status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{['all', 'active', 'suspended', 'banned', 'pending', 'deleted'].map(s => <option key={s} value={s}>{s}</option>)}</select><select className="admin-input" aria-label="College" value={campus} onChange={e => { setCampus(e.target.value); setPage(1); }}><option value="all">All colleges</option>{data?.colleges.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
    {error && <p role="alert" className="admin-error">{error} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    {loading ? <TableSkeleton /> : <div className="admin-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="text-[#A3A3A3]"><th className="p-3">Student</th><th className="p-3">College</th><th className="p-3">Status</th><th className="p-3">Verification</th><th className="p-3">Action</th></tr></thead><tbody>{data?.items.map(user => <tr key={user.id} className="border-t border-[#2A2A2A]"><td className="p-3"><p className="font-medium">{user.displayName || user.handle}</p><p className="text-[#A3A3A3]">{user.email}</p></td><td className="p-3">{user.campus}</td><td className="p-3"><StatusBadge status={user.status} /></td><td className="p-3">{user.emailVerifiedAt ? user.verificationStatus.replaceAll('_', ' ') : 'Email unverified'}</td><td className="p-3"><Link className="admin-button" href={`/admin/users/${user.id}`}>Review</Link></td></tr>)}</tbody></table>{!data?.items.length && <p className="p-6 text-center text-[#A3A3A3]">No users match these filters.</p>}</div>}
    <AdminPagination page={page} total={data?.total ?? 0} onChange={setPage} loading={loading} />
  </div>;
}
