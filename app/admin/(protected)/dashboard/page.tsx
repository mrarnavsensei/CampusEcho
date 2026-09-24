"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, UserCheck, FileText, AlertTriangle, 
  Mic2, Calendar, Trophy, Building2, AlertCircle 
} from "lucide-react";
import { KpiCard } from "@/components/admin/kpi-card";
import { KpiCardSkeleton, TableSkeleton } from "@/components/admin/admin-skeleton";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminChart } from "@/components/admin/admin-chart";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTrend, setUserTrend] = useState<any[]>([]);
  const [postTrend, setPostTrend] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard/stats').then(r => r.json<any>()),
      fetch('/api/admin/analytics?category=Users&period=7d').then(r => r.json<any>()),
      fetch('/api/admin/analytics?category=Posts&period=7d').then(r => r.json<any>()),
    ])
      .then(([res, usersResult, postsResult]) => {
        if (res.error) setError(res.error.message);
        else {
          setData(res.data);
          setUserTrend(usersResult.data?.chartData ?? []);
          setPostTrend(postsResult.data?.chartData ?? []);
        }
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <Card className="bg-red-950/20 border-red-900/50 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-red-400">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()} className="bg-[#E50914] hover:bg-red-600">
          Retry
        </Button>
      </Card>
    );
  }

  const kpis = [
    { title: "Total Users", value: data?.totalUsers || 0, icon: <Users className="w-5 h-5" />, accent: "blue" },
    { title: "Active Accounts", value: data?.activeUsers || 0, icon: <UserCheck className="w-5 h-5" />, accent: "green" },
    { title: "Posts Today", value: data?.postsToday || 0, icon: <FileText className="w-5 h-5" />, accent: "amber" },
    { title: "Pending Reports", value: data?.pendingReports || 0, icon: <AlertTriangle className="w-5 h-5" />, accent: "red" },
    { title: "Active Voice Rooms", value: data?.activeVoiceRooms || 0, icon: <Mic2 className="w-5 h-5" />, accent: "purple" },
    { title: "Total Events", value: data?.totalEvents || 0, icon: <Calendar className="w-5 h-5" />, accent: "blue" },
    { title: "Chess Matches", value: data?.chessMatches || 0, icon: <Trophy className="w-5 h-5" />, accent: "amber" },
    { title: "Total Campuses", value: data?.totalCampuses || 0, icon: <Building2 className="w-5 h-5" />, accent: "green" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[#A3A3A3] text-sm mt-1">Platform Overview</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/moderation">
            <Button variant="secondary" className="bg-[#202020] text-white hover:bg-[#2A2A2A]">Review Reports</Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="secondary" className="bg-[#202020] text-white hover:bg-[#2A2A2A]">Manage Users</Button>
          </Link>
          <Link href="/admin/audit-logs">
            <Button variant="secondary" className="bg-[#202020] text-white hover:bg-[#2A2A2A]">View Audit Log</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.map((kpi, i) => (
              <KpiCard key={i} title={kpi.title} value={kpi.value} icon={kpi.icon} accent={kpi.accent as any} />
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">User Registrations</h3>
          <AdminChart data={userTrend} type="area" xKey="label" yKey="value" height={260} color="#3b82f6" />
        </Card>
        <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Content Activity</h3>
          <AdminChart data={postTrend} type="bar" xKey="label" yKey="value" height={260} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Reports</h3>
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              columns={[
                { header: "ID", accessor: (row: any) => row.id.substring(0, 8) + '...' },
                { header: "Reason", accessor: "reason" },
                { header: "Status", accessor: (row: any) => <StatusBadge status={row.status} /> },
                { header: "Date", accessor: (row: any) => new Date(row.createdAt).toLocaleDateString() },
              ]}
              data={data?.recentReports || []}
            />
          )}
        </Card>

        <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Users</h3>
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              columns={[
                { header: "Email", accessor: "email" },
                { header: "Status", accessor: (row: any) => <StatusBadge status={row.status} /> },
                { header: "Joined", accessor: (row: any) => new Date(row.createdAt).toLocaleDateString() },
              ]}
              data={data?.recentUsers || []}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
