"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from '@/lib/admin-client';
import { AdminPagination } from '@/components/admin/pagination';
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { KpiCard } from "@/components/admin/kpi-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic2, Radio, Users, AlertCircle } from "lucide-react";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/admin-skeleton";

export default function VoiceSpacesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("live");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/voice-spaces?page=${page}&status=${activeTab}`)
      .then(r => r.json<any>())
      .then(res => {
        if (res.error) setError(res.error.message);
        else setData(res.data);
      })
      .catch(() => setError('Failed to load voice spaces.'))
      .finally(() => setLoading(false));
  }, [page, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEndRoom = async (roomId: string) => {
      await adminRequest(`/api/admin/voice-spaces/${roomId}`, {
        method: 'DELETE'
      });
        fetchData();
  };

  if (error) {
    return (
      <Card className="bg-red-950/20 border-red-900/50 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Voice Spaces</h2>
          <p className="text-red-400">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()} className="bg-[#E50914] hover:bg-red-600">
          Retry
        </Button>
      </Card>
    );
  }

  const rooms = data?.rooms || [];
  const filteredRooms = activeTab === 'live' 
    ? rooms.filter((r: any) => r.status === 'live')
    : rooms;

  const columns = [
    { 
      header: "Room", 
      accessor: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-white">{row.title}</span>
          <span className="text-xs text-[#A3A3A3] mt-0.5">Topic: {row.topic || 'General'}</span>
        </div>
      )
    },
    { header: "Campus", accessor: "campus" },
    { header: "Status", accessor: (row: any) => <StatusBadge status={row.status} /> },
    { header: "Participants", accessor: (row: any) => <span className="text-white">{row.participantsCount || 0}</span> },
    { header: "Started", accessor: (row: any) => new Date(row.createdAt).toLocaleString() },
    { 
      header: "Actions", 
      accessor: (row: any) => row.status === 'live' ? (
        <ConfirmDialog
          title="End Voice Room"
          description={`Close the stored room "${row.title}" and mark its participants as departed? Audio provider termination requires a configured integration.`}
          onConfirm={() => handleEndRoom(row.id)}
          trigger={
            <Button variant="outline" size="sm" className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400">
              End Room
            </Button>
          }
        />
      ) : (
        <span className="text-xs text-[#A3A3A3]">Ended</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <p className="admin-panel text-sm text-[#A3A3A3]">Audio infrastructure is not connected. These are stored room records; participant counts do not prove live audio connectivity.</p>
      {loading && !data ? (
        <PageHeaderSkeleton />
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-white">Voice Spaces</h1>
          <p className="text-[#A3A3A3] text-sm mt-1">Monitor and manage live audio rooms</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard 
          title="Active Rooms" 
          value={data?.stats?.activeRooms || 0} 
          icon={<Radio className="w-5 h-5" />} 
          accent="red" 
        />
        <KpiCard 
          title="Total Rooms (24h)" 
          value={data?.stats?.totalRooms || 0} 
          icon={<Mic2 className="w-5 h-5" />} 
          accent="purple" 
        />
        <KpiCard 
          title="Total Participants" 
          value={data?.stats?.totalParticipants || 0} 
          icon={<Users className="w-5 h-5" />} 
          accent="blue" 
        />
      </div>

      <Card className="bg-[#111111] border-[#2A2A2A] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#2A2A2A]">
          <Tabs value={activeTab} onValueChange={value => { setActiveTab(value); setPage(1); }}>
            <TabsList className="bg-[#181818] border border-[#2A2A2A]">
              <TabsTrigger value="live" className="data-[state=active]:bg-[#202020] data-[state=active]:text-white">Live Rooms</TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-[#202020] data-[state=active]:text-white">All Rooms</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRooms}
            emptyState={
              <div className="p-12 text-center flex flex-col items-center text-[#A3A3A3]">
                <Mic2 className="w-12 h-12 mb-4 opacity-50" />
                <p>No voice rooms found.</p>
              </div>
            }
          />
        )}
      </Card>
      <AdminPagination page={page} total={data?.total ?? 0} loading={loading} onChange={setPage} />
    </div>
  );
}
