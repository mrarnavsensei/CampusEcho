'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminRequest } from '@/lib/admin-client';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export function AdminTopbar({ admin, title }: { admin: AdminAccount; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    try {
      setBusy(true); setError('');
      await adminRequest('/api/admin/auth/logout', { method: 'POST' });
      router.replace('/admin/login');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign out.');
    } finally { setBusy(false); }
  };

  // Derive page title from pathname if not provided
  const displayTitle = title || (() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return 'Dashboard';
    const last = segments[1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  })();

  return (
    <header className="h-[56px] flex items-center justify-between px-6 bg-[#111111] border-b border-[#2A2A2A] shrink-0">
      <div className="flex items-center">
        <h1 className="text-lg font-medium text-white">{displayTitle}</h1>
        {error && <p role="alert" className="text-xs text-red-400 ml-3">{error}</p>}
      </div>

      <div className="flex items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <div className="flex items-center space-x-3 hover:bg-[#181818] p-1.5 rounded-md transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white leading-none">{admin.displayName}</p>
                <p className="text-[10px] text-[#A3A3A3] uppercase mt-1 leading-none">{admin.role.replace('_', ' ')}</p>
              </div>
              <Avatar className="h-8 w-8 border border-[#2A2A2A]">
                <AvatarFallback className="bg-[#202020] text-white text-xs">
                  {admin.displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#181818] border-[#2A2A2A] text-white w-48">
            <DropdownMenuItem disabled className="focus:bg-[#202020] focus:text-white">
              <User className="mr-2 h-4 w-4" />
              <span>{admin.displayName}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2A2A2A]" />
            <DropdownMenuItem
              className="focus:bg-[#E50914] focus:text-white text-[#E50914] cursor-pointer"
              onClick={handleSignOut}
              disabled={busy}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
