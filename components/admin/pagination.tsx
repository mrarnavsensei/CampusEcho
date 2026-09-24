'use client';
export function AdminPagination({ page, total, pageSize = 25, loading, onChange }: { page: number; total: number; pageSize?: number; loading?: boolean; onChange: (page: number) => void }) {
  return <nav aria-label="Results pages" className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-[#A3A3A3]">
    <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "No results"}</span>
    <div className="flex gap-2"><button className="admin-button" disabled={loading || page <= 1} onClick={() => onChange(page - 1)}>Previous</button><button className="admin-button" disabled={loading || page * pageSize >= total} onClick={() => onChange(page + 1)}>Next</button></div>
  </nav>;
}
