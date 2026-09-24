'use client';
import { useEffect, useState } from 'react';
import { AdminChart } from '@/components/admin/admin-chart';
import { KpiCard } from '@/components/admin/kpi-card';
import { adminRequest } from '@/lib/admin-client';

export default function AnalyticsPage() {
  const [category, setCategory] = useState('Users');
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    adminRequest(`/api/admin/analytics?category=${category}&period=${period}`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [category, period]);

  const categories = ['Users', 'Posts', 'Voice', 'Events', 'Chess', 'Safety', 'Messages'];

  return (
    <div className="p-6 space-y-6 text-[#A3A3A3]">
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <select className="bg-[#181818] border border-[#2A2A2A] rounded p-2 text-white" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
        <div className="flex space-x-4 border-b border-[#2A2A2A] pb-2 mb-6 overflow-x-auto">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`pb-2 px-2 whitespace-nowrap border-b-2 transition ${category === c ? 'border-[#E50914] text-white' : 'border-transparent hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="h-[300px] bg-[#181818] rounded-lg border border-[#2A2A2A] flex items-center justify-center p-4">
          {loading ? <span>Loading chart...</span> : <AdminChart data={data?.chartData} type="bar" />}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {data?.summary?.map((stat: any, i: number) => (
            <KpiCard key={i} title={stat.label} value={stat.value} />
          )) || Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-[#181818] p-4 rounded border border-[#2A2A2A] animate-pulse h-24"></div>
          ))}
        </div>
      </div>

      <div className="text-center text-sm p-4 bg-[#111111] border border-[#2A2A2A] rounded-lg">
        Analytics are aggregated from platform activity. For detailed export, contact your data team.
      </div>
    </div>
  );
}
