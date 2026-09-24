import { redirect } from 'next/navigation';
import { getAdminFromCookies } from '@/lib/admin-auth';
import { AdminGate } from '@/components/admin/admin-gate';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminFromCookies();
  if (!admin) redirect('/admin/login');
  return <AdminGate admin={admin}>{children}</AdminGate>;
}
