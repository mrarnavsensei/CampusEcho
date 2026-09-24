'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminRequest } from '@/lib/admin-client';
import { AdminPagination } from '@/components/admin/pagination';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

export default function EventDetailPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '' });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/events/${eventId}?page=${page}`)
      .then(r => r.json<any>())
      .then(res => { 
        if (res.error) setError(res.error.message); 
        else {
          setData(res.data);
          setEditForm({ title: res.data.title, description: res.data.description, status: res.data.status });
        }
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [eventId, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleArchive = async () => {
      await adminRequest(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      router.push('/admin/events');
  };

  const handleSaveEdit = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await adminRequest(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
        setIsEditing(false);
        loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-white">Loading...</div>;
  if (!data) return <div role="alert" className="admin-error">{error || 'Event not found.'}<button onClick={loadData} className="underline ml-3">Retry</button></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-[#A3A3A3]">
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="flex items-center space-x-4">
        <Link href="/admin/events" className="hover:text-white">&larr; Back</Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start bg-[#111111] p-6 rounded-lg border border-[#2A2A2A] gap-4">
        <div className="flex-1">
          {isEditing ? (
            <input className="text-2xl font-bold bg-[#181818] border border-[#2A2A2A] p-2 text-white rounded mb-2 w-full" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
          ) : (
            <h1 className="text-2xl font-bold text-white mb-2">{data.title}</h1>
          )}
          
          <div className="flex items-center space-x-3 mb-4">
            {isEditing ? (
              <select className="bg-[#181818] border border-[#2A2A2A] p-1 text-white rounded" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            ) : (
              <StatusBadge status={data.status} />
            )}
            <span className="text-sm bg-[#202020] px-2 py-1 rounded">{data.game || 'No Game'}</span>
          </div>

          {isEditing ? (
            <textarea className="w-full bg-[#181818] border border-[#2A2A2A] p-2 text-white rounded" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
          ) : (
            <p className="whitespace-pre-wrap">{data.description}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><strong>Capacity:</strong> {data.capacity || 'Unlimited'}</div>
            <div><strong>Starts At:</strong> {new Date(data.startsAt).toLocaleString()}</div>
            <div><strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}</div>
            <div><strong>Updated:</strong> {new Date(data.updatedAt).toLocaleString()}</div>
          </div>
        </div>
        
        <div className="flex space-x-2 shrink-0">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="px-3 py-1 border border-[#2A2A2A] rounded hover:text-white">Cancel</button>
              <button disabled={busy} onClick={handleSaveEdit} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-3 py-1 border border-[#2A2A2A] rounded hover:text-white">Edit</button>
          )}
          <button onClick={() => setShowArchiveConfirm(true)} className="px-3 py-1 bg-[#E50914] text-white rounded hover:bg-red-700">Archive</button>
        </div>
      </div>

      <div className="bg-[#111111] p-6 rounded-lg border border-[#2A2A2A]">
        <h2 className="text-lg font-bold text-white mb-4">Registrations ({data.registrationsCount || 0})</h2>
        <ul className="divide-y divide-[#2A2A2A]">{data.registrations?.items.map((student: { id: string; displayName: string; handle: string; createdAt: string }) => <li key={student.id} className="py-3 flex justify-between gap-3"><span>{student.displayName || student.handle}</span><span className="text-xs">{new Date(student.createdAt).toLocaleDateString()}</span></li>)}</ul>
        {!data.registrationsCount && <p className="py-6 text-center">No students registered yet.</p>}
        <AdminPagination page={page} total={data.registrationsCount || 0} loading={loading} onChange={setPage} />
      </div>

      {showArchiveConfirm && (
        <ConfirmDialog
          title="Archive Event"
          message={`Are you sure you want to archive "${data.title}"?`}
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </div>
  );
}
