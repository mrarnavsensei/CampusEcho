'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminRequest } from '@/lib/admin-client';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { TableSkeleton } from '@/components/admin/admin-skeleton';

type Report = { id: string; type: string; targetId: string; reason: string; details: string; status: string; assignedAdminId: string | null; canModerate: boolean; content: { body?: string; title?: string; displayName?: string; bio?: string; status?: string; visibility?: string } | null; history: Array<{ id: string; action: string; createdAt: string; metadata: { note?: string } }>; assignees: Array<{ id: string; displayName: string }> };
export default function ReportDetailPage() {
  const { reportId } = useParams();
  const [data, setData] = useState<Report | null>(null), [note, setNote] = useState(''), [assignedAdminId, setAssignedAdminId] = useState('');
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try { const result = await adminRequest<Report>(`/api/admin/moderation/${reportId}`); setData(result); setAssignedAdminId(result.assignedAdminId ?? ''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load report.'); }
    finally { setLoading(false); }
  }, [reportId]);
  useEffect(() => { void load(); }, [load]);
  async function act(action: string) {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await adminRequest(`/api/admin/moderation/${reportId}`, { method: 'PATCH', body: JSON.stringify({ action, note, assignedAdminId: assignedAdminId || null }) }); setNote(''); setSuccess('Review saved to the audit trail.'); await load(); }
    catch (err) { const message = err instanceof Error ? err.message : 'Could not save review.'; setError(message); throw new Error(message); }
    finally { setBusy(false); }
  }
  const ready = !busy && note.trim().length >= 3;
  return <div className="max-w-4xl space-y-5">
    <Link className="text-[#A3A3A3] hover:text-white" href="/admin/moderation">← Moderation queue</Link>
    <h1 className="text-2xl font-bold">Report review</h1>
    {error && <p role="alert" className="admin-error">{error} {!data && <button onClick={load} className="underline">Retry</button>}</p>}
    {success && <p role="status" className="text-green-400">{success}</p>}
    {loading ? <TableSkeleton /> : data && <>
      <section className="admin-panel space-y-3"><div className="flex gap-3 items-center"><StatusBadge status={data.status} /><span className="capitalize">{data.type.replace('_', ' ')}</span></div><h2 className="text-lg font-semibold">{data.reason}</h2><p className="text-[#A3A3A3] whitespace-pre-wrap">{data.details || 'No additional details provided.'}</p><p className="text-xs text-[#A3A3A3] break-all">Report {data.id}</p></section>
      <section className="admin-panel space-y-3"><h2 className="font-semibold">Reported content</h2>{data.type === 'message' ? <p className="text-[#A3A3A3]">Private messages are not exposed here. Record the report outcome and follow your organization’s documented safety escalation process.</p> : data.content ? <><p className="whitespace-pre-wrap break-words">{data.content.body || data.content.title || data.content.displayName}</p>{data.content.bio && <p>{data.content.bio}</p>}<p className="text-xs text-[#A3A3A3]">{data.content.status}{data.content.visibility === 'anonymous' ? ' · Anonymous author identity protected' : ''}</p></> : <p className="text-[#A3A3A3]">Content is unavailable or has been deleted.</p>}{data.type === 'user' && <Link className="admin-button inline-block" href={`/admin/users/${data.targetId}`}>Review account</Link>}</section>
      <section className="admin-panel space-y-4"><h2 className="font-semibold">Review decision</h2><label className="block">Review note (required)<textarea className="admin-input block w-full mt-2" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Explain the decision, policy applied, or follow-up needed." /></label>
        <div className="flex flex-wrap gap-2">{['note', ...(data.status === 'open' ? ['resolve', 'dismiss'] : ['reopen'])].map(action => <button key={action} className="admin-button capitalize" disabled={!ready} onClick={() => { void act(action).catch(() => {}); }}>{action === 'note' ? 'Save note' : action}</button>)}
          {data.canModerate && ['post', 'comment'].includes(data.type) && data.content && <ConfirmDialog title={data.content.status === 'removed' ? 'Restore content?' : 'Remove content?'} description="This updates visibility in the student feed and records your review note." destructive={data.content.status !== 'removed'} trigger={<button className="admin-button" disabled={!ready}>{data.content.status === 'removed' ? 'Restore content' : 'Remove content'}</button>} onConfirm={() => act(data.content?.status === 'removed' ? 'restore' : 'remove')} />}
        </div>
        <div className="flex flex-wrap gap-2"><select aria-label="Assigned administrator" className="admin-input" value={assignedAdminId} onChange={e => setAssignedAdminId(e.target.value)}><option value="">Unassigned</option>{data.assignees.map(a => <option key={a.id} value={a.id}>{a.displayName}</option>)}</select><button className="admin-button" disabled={!ready} onClick={() => { void act('assign').catch(() => {}); }}>Save assignment</button></div>
      </section>
      <section className="admin-panel space-y-3"><h2 className="font-semibold">Recent review history</h2>{data.history.map(item => <div key={item.id} className="border-b border-[#2A2A2A] pb-3"><p className="text-sm">{item.action} · {new Date(item.createdAt).toLocaleString()}</p>{item.metadata.note && <p className="text-[#A3A3A3] whitespace-pre-wrap mt-1">{item.metadata.note}</p>}</div>)}{!data.history.length && <p className="text-[#A3A3A3]">No earlier review actions.</p>}</section>
    </>}
  </div>;
}
