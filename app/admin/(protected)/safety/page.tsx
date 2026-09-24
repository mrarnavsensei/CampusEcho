"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/admin-skeleton";

export default function SafetyPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/moderation?targetType=message')
      .then(r => r.json<any>())
      .then(res => {
        if (res.error) setError(res.error.message);
        else setData(res.data?.items || []);
      })
      .catch(() => setError('Failed to load safety reports.'))
      .finally(() => setLoading(false));
  }, []);

  const openCount = data.filter(r => r.status === 'open').length;
  const resolvedCount = data.filter(r => r.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {loading && !data.length ? (
        <PageHeaderSkeleton />
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-white">Safety & Messaging</h1>
          <p className="text-[#A3A3A3] text-sm mt-1">Privacy-preserving safety management</p>
        </div>
      )}

      <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-lg flex items-start gap-4">
        <Lock className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-blue-300 font-semibold mb-1">Privacy Notice</h3>
          <p className="text-blue-200/70 text-sm">
            CampusCrate Echo protects private message content. This interface shows only safety reports and metadata — not message contents. To review full context for severe violations, follow the legal escalation workflow.
          </p>
        </div>
      </div>

      {error ? (
        <Card className="bg-red-950/20 border-red-900/50 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Error Loading Safety Data</h2>
            <p className="text-red-400">{error}</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#111111] border-[#2A2A2A] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#2A2A2A] flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Message Reports
                </h3>
              </div>
              
              {loading ? (
                <div className="p-6"><TableSkeleton /></div>
              ) : (
                <DataTable
                  columns={[
                    { header: "Report ID", accessor: (row: any) => <span className="font-mono text-xs">{row.id.substring(0, 8)}</span> },
                    { header: "Reason", accessor: "reason" },
                    { header: "Status", accessor: (row: any) => <StatusBadge status={row.status} /> },
                    { header: "Reported At", accessor: (row: any) => new Date(row.createdAt).toLocaleDateString() },
                    { 
                      header: "Action", 
                      accessor: (row: any) => (
                        <Link href={`/admin/moderation/${row.id}`}>
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 p-0">View</Button>
                        </Link>
                      )
                    }
                  ]}
                  data={data}
                  emptyState={
                    <div className="p-8 text-center text-[#A3A3A3]">
                      No message reports found.
                    </div>
                  }
                />
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">Latest 25 message reports</h3>
              <div className="space-y-4">
                <div className="bg-[#181818] border border-[#2A2A2A] p-4 rounded flex justify-between items-center">
                  <span className="text-[#A3A3A3]">Total Reports</span>
                  <span className="text-xl font-bold text-white">{data.length}</span>
                </div>
                <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded flex justify-between items-center">
                  <span className="text-amber-500">Open Cases</span>
                  <span className="text-xl font-bold text-amber-500">{openCount}</span>
                </div>
                <div className="bg-green-950/20 border border-green-900/50 p-4 rounded flex justify-between items-center">
                  <span className="text-green-500">Resolved Cases</span>
                  <span className="text-xl font-bold text-green-500">{resolvedCount}</span>
                </div>
              </div>
            </Card>

            <Card className="bg-[#111111] border-[#2A2A2A] p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Escalation Workflow</h3>
              <p className="text-sm text-[#A3A3A3] mb-4">
                For severe safety cases (e.g. threats, illegal content), escalate to Legal/Trust & Safety for account suspension and data preservation.
              </p>
              <p className="text-xs text-[#A3A3A3]">An operational escalation policy and named safety contact must be configured by the platform owner before launch.</p>
            </Card>

            <div className="flex gap-4">
              <Link href="/admin/moderation" className="flex-1">
                <Button variant="outline" className="w-full border-[#2A2A2A] text-[#A3A3A3] hover:text-white hover:bg-[#202020]">
                  Full Queue
                </Button>
              </Link>
              <Link href="/admin/audit-logs" className="flex-1">
                <Button variant="outline" className="w-full border-[#2A2A2A] text-[#A3A3A3] hover:text-white hover:bg-[#202020]">
                  Audit Logs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
