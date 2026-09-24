'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import type { AdminAccount } from '@/lib/admin-auth';
import { adminLinks, canVisitAdminPath } from '@/lib/admin-navigation';
import Link from 'next/link';

export function AdminGate({ admin, children }: { admin: AdminAccount | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  useEffect(() => {
    if (!admin && !isLogin) router.replace('/admin/login');
    if (admin && isLogin) router.replace('/admin/dashboard');
  }, [admin, isLogin, router]);
  if (isLogin) return admin ? null : children;
  if (!admin) return <div className="min-h-screen bg-[#080808]" />;
  return <><AdminSidebar admin={admin} /><div className="admin-main"><AdminTopbar admin={admin} /><nav aria-label="Admin navigation" className="md:hidden flex gap-2 overflow-x-auto p-3 border-b border-[#2A2A2A] shrink-0">{adminLinks.filter(([, href]) => canVisitAdminPath(admin.role, href)).map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`whitespace-nowrap rounded px-3 py-2 text-sm ${pathname.startsWith(href) ? 'bg-[#E50914] text-white' : 'bg-[#181818] text-[#A3A3A3]'}`}>{label}</Link>)}</nav><main className="admin-content">{canVisitAdminPath(admin.role, pathname) ? children : <div className="admin-panel"><h1 className="font-semibold">Access restricted</h1><p className="text-[#A3A3A3] mt-2">Your administrator role cannot access this section.</p></div>}</main></div></>;
}
