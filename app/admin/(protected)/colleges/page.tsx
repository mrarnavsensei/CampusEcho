'use client';
import { useEffect, useState } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { adminRequest } from '@/lib/admin-client';
import Link from 'next/link';

export default function CollegesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCollege, setNewCollege] = useState({ name: '', slug: '', domain: '' });
  const [statusConfirm, setStatusConfirm] = useState<{id: string, newStatus: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/colleges').then(r => r.json<any>()).then(res => {
      if (res.error) setError(res.error.message); else setData(res.data || []);
    }).catch(() => setError('Failed to load colleges.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/admin/auth/me').then(r => r.json<any>()).then(res => {
      if (res.data?.role === 'super_admin') setIsSuperAdmin(true);
    });
    loadData();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await adminRequest('/api/admin/colleges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollege)
      });
      setShowAddModal(false);
      setNewCollege({ name: '', slug: '', domain: '' });
      loadData();
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Failed to add college');
    } finally { setBusy(false); }
  };

  const handleStatusChange = async () => {
    if (!statusConfirm) return;
      await adminRequest(`/api/admin/colleges/${statusConfirm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusConfirm.newStatus })
      });
      setStatusConfirm(null);
      loadData();
  };

  return (
    <div className="p-6 space-y-6 text-[#A3A3A3]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">College Management</h1>
        {isSuperAdmin && (
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-[#E50914] text-white rounded-lg hover:bg-red-700 transition">
            Add College
          </button>
        )}
      </div>

      <div className="bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
        {error && <div className="p-4 mb-4 border border-[#E50914] text-[#E50914] rounded-lg bg-red-900/10">{error}</div>}
        
        {loading ? (
          <div className="py-8 text-center">Loading colleges...</div>
        ) : (
          <DataTable
            data={data}
            columns={[
              { key: 'name', label: 'College Name', render: (r: any) => <span className="text-white font-medium">{r.name}</span> },
              { key: 'slug', label: 'Slug', render: (r: any) => r.slug },
              { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
              { key: 'domains', label: 'Approved email domains', render: (r: any) => r.domains?.map((d: { domain: string }) => d.domain).join(', ') || 'None' },
              { key: 'users', label: 'Users', render: (r: any) => r.usersCount || 0 },
              { key: 'created', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
              { key: 'actions', label: 'Actions', render: (r: any) => (
                <div className="flex space-x-3 text-sm">
                  <Link href="/admin/users" className="text-blue-400 hover:underline">Browse students</Link>
                  {isSuperAdmin &&
                  <button 
                    onClick={() => setStatusConfirm({id: r.id, newStatus: r.status === 'active' ? 'inactive' : 'active'})}
                    className="hover:text-white"
                  >
                    Toggle Status
                  </button>
                  }
                </div>
              )}
            ]}
          />
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">Add College</h2>
            {error && <p role="alert" className="admin-error mb-3">{error}</p>}
            <p className="text-xs mb-3">Confirm this domain belongs to the institution before approving it. Domain ownership alone does not verify enrollment.</p>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">College Name</label>
                <input required className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white focus:border-[#E50914] outline-none" value={newCollege.name} onChange={e => setNewCollege({...newCollege, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Slug</label>
                <input required className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white focus:border-[#E50914] outline-none" value={newCollege.slug} onChange={e => setNewCollege({...newCollege, slug: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Email Domain</label>
                <input required placeholder="edu.campus.com" className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white focus:border-[#E50914] outline-none" value={newCollege.domain} onChange={e => setNewCollege({...newCollege, domain: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-[#2A2A2A]">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-[#2A2A2A] rounded text-white hover:bg-[#181818]">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-[#E50914] text-white rounded hover:bg-red-700 disabled:opacity-50">{busy ? 'Adding…' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusConfirm && (
        <ConfirmDialog
          title="Change College Status"
          message={`Are you sure you want to mark this college as ${statusConfirm.newStatus}?`}
          onConfirm={handleStatusChange}
          onCancel={() => setStatusConfirm(null)}
        />
      )}
    </div>
  );
}
