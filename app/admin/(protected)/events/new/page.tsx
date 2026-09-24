'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '@/lib/admin-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewEventPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    game: 'None',
    capacity: '',
    startsAt: '',
    status: 'draft'
    , campusId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; status: string }>>([]);
  useEffect(() => { adminRequest<Array<{ id: string; name: string; status: string }>>('/api/admin/colleges').then(rows => setColleges(rows.filter(row => row.status === 'active'))).catch(err => setError(err.message)); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startsAt: new Date(formData.startsAt).toISOString(),
          capacity: formData.capacity ? parseInt(formData.capacity) : null
        })
      });
      const data = await res.json<any>();
      if (data.error) setError(data.error.message);
      else router.push('/admin/events');
    } catch {
      setError('Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-[#A3A3A3]">
      <div className="flex items-center space-x-4">
        <Link href="/admin/events" className="hover:text-white">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-white">Create Event</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111111] p-6 rounded-lg border border-[#2A2A2A] space-y-4">
        {error && <div className="p-3 bg-red-900/20 border border-[#E50914] text-[#E50914] rounded">{error}</div>}
        <label className="block">College *<select className="admin-input block w-full mt-1" required value={formData.campusId} onChange={e => setFormData({ ...formData, campusId: e.target.value })}><option value="">Select a college</option>{colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        
        <div>
          <label className="block text-sm mb-1">Title *</label>
          <input required type="text" className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
        </div>

        <div>
          <label className="block text-sm mb-1">Description *</label>
          <textarea required rows={4} className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Game</label>
            <select className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.game} onChange={e => setFormData({...formData, game: e.target.value})}>
              <option value="None">None</option>
              <option value="Chess">Chess</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Capacity</label>
            <input type="number" min={1} max={100000} step={1} placeholder="Unlimited" className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Start Date & Time *</label>
            <input required type="datetime-local" className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.startsAt} onChange={e => setFormData({...formData, startsAt: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select className="w-full bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-[#2A2A2A]">
          <Link href="/admin/events" className="px-4 py-2 border border-[#2A2A2A] rounded text-white hover:bg-[#181818]">Cancel</Link>
          <button disabled={loading} type="submit" className="px-4 py-2 bg-[#E50914] text-white rounded hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
