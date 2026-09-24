'use client';
import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/admin/kpi-card';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { AdminPagination } from '@/components/admin/pagination';

export default function ChessPage() {
  const [data, setData] = useState<{ matches: any[], stats: any; total: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('All');
  const [lbPeriod, setLbPeriod] = useState('Weekly');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetch(`/api/admin/chess?page=${page}&status=${tab.toLowerCase()}`).then(r => r.json<any>()),
      fetch(`/api/admin/chess/leaderboard?period=${lbPeriod.toLowerCase()}`).then(r => r.json<any>())
    ])
    .then(([chessRes, lbRes]) => {
      if (chessRes.error) setError(chessRes.error.message);
      else setData(chessRes.data);
      if (lbRes.error) setError(lbRes.error.message); else setLeaderboard(lbRes.data || []);
    })
    .catch(() => setError('Failed to load.'))
    .finally(() => setLoading(false));
  }, [lbPeriod, page, tab]);

  const filteredMatches = data?.matches.filter(m => {
    if (tab === 'All') return true;
    return m.status.toLowerCase() === tab.toLowerCase();
  }) || [];

  return (
    <div className="p-6 space-y-6 text-[#A3A3A3]">
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div>
        <h1 className="text-2xl font-bold text-white">Chess Management</h1>
        <p className="text-sm">Monitor validated multiplayer games and casual leaderboards.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Total Matches" value={data?.stats?.totalMatches || 0} />
        <KpiCard title="Active" value={data?.stats?.activeMatches || 0} />
        <KpiCard title="Completed" value={data?.stats?.completedMatches || 0} />
        <KpiCard title="Waiting for opponent" value={data?.stats?.waitingMatches || 0} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[60%] bg-[#111111] p-4 rounded-lg border border-[#2A2A2A] flex flex-col min-h-[400px]">
          <div className="flex space-x-4 border-b border-[#2A2A2A] pb-2 mb-4">
            {['All', 'Active', 'Completed', 'Waiting'].map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`pb-2 px-1 border-b-2 transition ${tab === t ? 'border-[#E50914] text-white' : 'border-transparent hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
          {loading ? (
             <div className="flex-1 flex items-center justify-center">Loading...</div>
          ) : (
            <DataTable
              data={filteredMatches}
              columns={[
                { key: 'players', label: 'Players', render: (row: any) => <span>⚪ {row.white} vs ⚫ {row.black}</span> },
                { key: 'status', label: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
                { key: 'result', label: 'Result', render: (row: any) => row.result || '-' },
                { key: 'date', label: 'Date', render: (row: any) => new Date(row.createdAt).toLocaleDateString() }
              ]}
            />
          )}
          <AdminPagination page={page} total={data?.total ?? 0} loading={loading} onChange={setPage} />
        </div>

        <div className="w-full lg:w-[40%] bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Global Leaderboard</h2>
            <select className="bg-[#181818] border border-[#2A2A2A] rounded p-1 text-sm text-white" value={lbPeriod} onChange={e => setLbPeriod(e.target.value)}>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>All-time</option>
            </select>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : leaderboard.length > 0 ? (
              leaderboard.map((user, idx) => (
                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-[#181818] rounded border border-transparent hover:border-[#2A2A2A]">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-[#E50914] w-4">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-[#202020] flex items-center justify-center text-white text-xs">{user.handle.substring(0,2).toUpperCase()}</div>
                    <span className="text-white font-medium">{user.handle}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{user.points} points</div>
                    <div className="text-xs">{user.winRate}% WR</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-sm">No leaderboard data for this period</div>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-center p-4 bg-[#111111] border border-[#2A2A2A] rounded-lg">
        Rankings use eligible completed games. No manual score editing is available. Review suspicious play before using rankings for prizes.
      </div>
    </div>
  );
}
