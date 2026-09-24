'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminRequest } from '@/lib/admin-client';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { TableSkeleton } from '@/components/admin/admin-skeleton';
type User = { id: string; displayName: string; email: string; handle: string; campus: string; status: string; emailVerifiedAt: string | null; verificationStatus: string | null; reviewNote: string; createdAt: string; canRestrict: boolean; canBan: boolean; canVerify: boolean; stats: { postsCount: number; reportsReceived: number; modHistoryCount: number }; history: Array<{ id: string; outcome: string; reason: string; createdAt: string }> };
export default function UserDetailPage() {
  const { userId } = useParams();
  const [data, setData] = useState<User | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const load = useCallback(async () => { try { setError(''); setData(await adminRequest<User>(`/api/admin/users/${userId}`)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not load user.'); } finally { setLoading(false); } }, [userId]);
  useEffect(() => { void load(); }, [load]);
  async function act(action: string) {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await adminRequest(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ action, reason }) }); setReason(''); setSuccess('Account updated and review recorded.'); await load(); }
    catch (err) { const message = err instanceof Error ? err.message : 'Could not update user.'; setError(message); throw new Error(message); }
    finally { setBusy(false); }
  }
  const ready = !busy && reason.trim().length >= 3;
  return <div className="max-w-4xl space-y-5"><Link className="text-[#A3A3A3]" href="/admin/users">← Users</Link>{error && <p role="alert" className="admin-error">{error} {!data && <button onClick={load} className="underline">Retry</button>}</p>}{success && <p role="status" className="text-green-400">{success}</p>}
    {loading ? <TableSkeleton /> : data && <><h1 className="text-2xl font-bold">{data.displayName || data.handle} <StatusBadge status={data.status} /></h1>
      <section className="admin-panel grid sm:grid-cols-2 gap-4"><div><p className="text-[#A3A3A3] text-sm">Email</p><p className="break-all">{data.email}</p></div><div><p className="text-[#A3A3A3] text-sm">College</p><p>{data.campus}</p></div><div><p className="text-[#A3A3A3] text-sm">Student verification</p><p>{data.verificationStatus?.replaceAll('_', ' ') || 'Not reviewed'} · Email {data.emailVerifiedAt ? 'verified' : 'unverified'}</p></div><div><p className="text-[#A3A3A3] text-sm">Account activity</p><p>{data.stats.postsCount} posts · {data.stats.reportsReceived} profile reports</p></div></section>
      <section className="admin-panel space-y-4"><h2 className="font-semibold">Account review</h2><p className="text-sm text-[#A3A3A3]">Email ownership does not prove current enrollment. Approve only after your institution’s verification process has been completed; record the decision without storing identity documents here.</p><label className="block">Reason for action<textarea className="admin-input block w-full mt-2" rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label>
        <div className="flex flex-wrap gap-2">{data.canRestrict && (data.status !== 'banned' || data.canBan) && <ConfirmDialog title={data.status === 'active' ? 'Suspend account?' : 'Reinstate account?'} description="The decision is recorded and existing sessions are revoked." trigger={<button className="admin-button" disabled={!ready}>{data.status === 'active' ? 'Suspend' : 'Reinstate'}</button>} onConfirm={() => act(data.status === 'active' ? 'suspend' : 'unsuspend')} />}
        {data.canBan && data.status !== 'banned' && <ConfirmDialog title="Ban account?" description="The account will be blocked until a Super Admin reinstates it." destructive trigger={<button className="admin-button" disabled={!ready}>Ban account</button>} onConfirm={() => act('ban')} />}
        {data.canVerify && <><ConfirmDialog title="Approve student verification?" description="Confirm that enrollment has been checked using the institution’s approved process." trigger={<button className="admin-button" disabled={!ready || !data.emailVerifiedAt}>Approve student</button>} onConfirm={() => act('verify')} /><ConfirmDialog title="Reject student verification?" description="The student will lose access until verification is approved." destructive trigger={<button className="admin-button" disabled={!ready}>Reject verification</button>} onConfirm={() => act('reject_verification')} /></>}</div>
      </section>
      <section className="admin-panel space-y-3"><h2 className="font-semibold">Recent moderation history</h2>{data.history.map(item => <div key={item.id} className="border-b border-[#2A2A2A] pb-3"><p className="text-sm">{item.outcome.replaceAll('_', ' ')} · {new Date(item.createdAt).toLocaleString()}</p><p className="text-[#A3A3A3] mt-1 whitespace-pre-wrap">{item.reason}</p></div>)}{!data.history.length && <p className="text-[#A3A3A3]">No moderation decisions recorded.</p>}</section>
    </>}
  </div>;
}
