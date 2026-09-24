'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '@/lib/admin-client';
import { TableSkeleton } from '@/components/admin/admin-skeleton';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
const options = [
  { key: 'maintenance_mode', label: 'Maintenance mode', description: 'Pause student access while administrators can continue working.', initial: 'false' },
  { key: 'user_registration_enabled', label: 'Student registration', description: 'Allow new students to create an account.', initial: 'true' },
  { key: 'manual_verification_required', label: 'Require enrollment review', description: 'Require administrator approval after email verification. Existing students without approval will also lose access until reviewed.', initial: 'false' },
  { key: 'voice_spaces_enabled', label: 'Voice spaces', description: 'Allow voice access when an audio provider has been configured.', initial: 'true' },
  { key: 'chess_enabled', label: 'Chess', description: 'Allow students to start and play chess games.', initial: 'true' },
  { key: 'events_enabled', label: 'Events', description: 'Allow students to view and register for events.', initial: 'true' },
  { key: 'direct_messages_enabled', label: 'Direct messages', description: 'Allow access to student conversations and messaging.', initial: 'true' },
];
export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({}), [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  useEffect(() => { adminRequest<Record<string, string>>('/api/admin/settings').then(data => setSettings({ ...Object.fromEntries(options.map(o => [o.key, o.initial])), ...data })).catch(err => setError(err.message)).finally(() => setLoading(false)); }, []);
  async function save(key: string, value: string) {
    setBusy(key); setError(''); setSuccess('');
    try { await adminRequest('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value }) }); setSettings(prev => ({ ...prev, [key]: value })); setSuccess('Setting saved.'); }
    catch (err) { const message = err instanceof Error ? err.message : 'Could not save setting.'; setError(message); throw new Error(message); }
    finally { setBusy(''); }
  }
  return <div className="max-w-4xl space-y-5"><h1 className="text-2xl font-bold">Platform settings</h1><p className="text-[#A3A3A3]">Access controls are checked by the server on student requests. Changing these settings affects current users.</p>{error && <p role="alert" className="admin-error">{error}</p>}{success && <p role="status" className="text-green-400">{success}</p>}
    {loading ? <TableSkeleton /> : <section className="admin-panel divide-y divide-[#2A2A2A]">{options.map(option => <div className="py-4 flex items-start justify-between gap-5" key={option.key}><div><h2 className="font-medium">{option.label}</h2><p className="text-sm text-[#A3A3A3] mt-1">{option.description}</p></div><ConfirmDialog title={`Change ${option.label.toLowerCase()}?`} description={option.description} trigger={<button className="admin-button shrink-0" disabled={!!busy || !(option.key in settings)} aria-label={`${option.label}: ${settings[option.key] === 'true' ? 'enabled' : 'disabled'}`}>{busy === option.key ? 'Saving…' : settings[option.key] === 'true' ? 'Enabled' : 'Disabled'}</button>} onConfirm={() => save(option.key, settings[option.key] === 'true' ? 'false' : 'true')} /></div>)}</section>}
    <section className="admin-panel"><h2 className="font-semibold">Integrations</h2><p className="text-sm text-[#A3A3A3] mt-2">Email delivery and audio provider credentials are configured through deployment secrets. General email notifications are not implemented. Content safety checks remain enabled.</p></section>
  </div>;
}
