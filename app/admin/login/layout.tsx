import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminFromCookies } from '@/lib/admin-auth';
import '../globals-admin.css';

export const metadata: Metadata = {
  title: 'Admin Login — CampusCrate Echo',
};

export default async function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  if (await getAdminFromCookies()) redirect('/admin/dashboard');
  return children;
}
