import './globals-admin.css';

export const metadata = {
  title: 'Admin Dashboard — CampusCrate Echo',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-shell">{children}</div>;
}
