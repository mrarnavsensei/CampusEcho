'use client';
import { useEffect, useState } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { adminRequest } from '@/lib/admin-client';

export default function AdministratorsPage() {
  const [data, setData] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', displayName: '', role: 'moderator' });
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = () => {
    adminRequest<any[]>('/api/admin/administrators').then(setData).catch(err => setError(err.message));
  };

  useEffect(() => {
    fetch('/api/admin/auth/me').then(r => r.json<any>()).then(res => setCurrentUser(res.data));
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
    await adminRequest('/api/admin/administrators', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAdmin)
    });
    setShowAdd(false);
    setNewAdmin({ email: '', password: '', displayName: '', role: 'moderator' });
    loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add administrator.'); }
    finally { setBusy(false); }
  };

  const handleRoleChange = async (id: string, role: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
    await adminRequest(`/api/admin/administrators/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
    });
    loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update role.'); }
    finally { setBusy(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    await adminRequest(`/api/admin/administrators/${deactivateId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'inactive' })
    });
    setDeactivateId(null);
    loadData();
  };

  return (
    <div className="p-6 space-y-6 text-[#A3A3A3]">
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Administrators</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#E50914] text-white rounded-lg hover:bg-red-700 transition">Add Admin</button>
      </div>

      <div className="p-3 bg-red-900/10 border border-[#E50914]/50 text-[#E50914] rounded-lg text-sm flex items-center gap-2">
        <span>🔒</span> This section is only accessible to Super Admins. All actions are audit logged.
      </div>

      <div className="bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
        <DataTable
          data={data}
          columns={[
            { key: 'admin', label: 'Admin', render: (r: any) => (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-[#202020] flex items-center justify-center text-white text-xs">{r.displayName?.[0]?.toUpperCase() || 'A'}</div>
                <div>
                  <div className="text-white font-medium">{r.displayName}</div>
                  <div className="text-xs">{r.email}</div>
                </div>
              </div>
            )},
            { key: 'role', label: 'Role', render: (r: any) => <StatusBadge status={r.role} /> },
            { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'lastLogin', label: 'Last Login', render: (r: any) => r.lastLogin ? new Date(r.lastLogin).toLocaleString() : 'Never' },
            { key: 'created', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
            { key: 'actions', label: 'Actions', render: (r: any) => (
              <div className="flex items-center space-x-3">
                <select aria-label={`Role for ${r.displayName}`} disabled={busy || r.id === currentUser?.id} className="bg-[#181818] border border-[#2A2A2A] rounded p-1 text-sm text-white" value={r.role} onChange={(e) => handleRoleChange(r.id, e.target.value)}>
                  <option value="moderator">Moderator</option>
                  <option value="event_manager">Event Manager</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                {currentUser?.id !== r.id && r.status === 'active' && (
                  <button onClick={() => setDeactivateId(r.id)} className="text-[#E50914] hover:underline text-sm">Deactivate</button>
                )}
              </div>
            )}
          ]}
        />
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">Add Administrator</h2>
            {error && <p role="alert" className="admin-error mb-3">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-sm mb-1">Email</label><input type="email" required className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} /></div>
              <div><label className="block text-sm mb-1">Password (at least 12 characters)</label><input type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} /></div>
              <div><label className="block text-sm mb-1">Display Name</label><input type="text" required className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={newAdmin.displayName} onChange={e => setNewAdmin({...newAdmin, displayName: e.target.value})} /></div>
              <div>
                <label className="block text-sm mb-1">Role</label>
                <select className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})}>
                  <option value="moderator">Moderator</option>
                  <option value="event_manager">Event Manager</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-[#2A2A2A]">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-[#2A2A2A] rounded text-white hover:bg-[#181818]">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-[#E50914] text-white rounded hover:bg-red-700 disabled:opacity-50">{busy ? 'Creating…' : 'Add Admin'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deactivateId && (
        <ConfirmDialog title="Deactivate Admin" message="Are you sure you want to deactivate this administrator? They will no longer be able to log in." onConfirm={handleDeactivate} onCancel={() => setDeactivateId(null)} />
      )}
    </div>
  );
}
