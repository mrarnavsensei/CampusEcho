'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { canVisitAdminPath } from '@/lib/admin-navigation';
import {
  LayoutDashboard, Users, Shield, Mic2, AlertTriangle, Calendar, Trophy,
  Building2, BarChart3, UserCog, ClipboardList, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export function AdminSidebar({ admin }: { admin: AdminAccount }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' }
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Users', icon: Users, href: '/admin/users' },
        { label: 'Content', icon: Shield, href: '/admin/moderation' },
        { label: 'Voice Spaces', icon: Mic2, href: '/admin/voice-spaces' },
        { label: 'Safety', icon: AlertTriangle, href: '/admin/safety' },
        { label: 'Events', icon: Calendar, href: '/admin/events' },
        { label: 'Chess', icon: Trophy, href: '/admin/chess' },
        { label: 'Colleges', icon: Building2, href: '/admin/colleges' }
      ]
    },
    {
      title: 'Analytics',
      items: [
        { label: 'Analytics', icon: BarChart3, href: '/admin/analytics' }
      ]
    },
    {
      title: 'Administration',
      items: [
        ...(admin.role === 'super_admin' ? [{ label: 'Admins', icon: UserCog, href: '/admin/administrators' }] : []),
        { label: 'Audit Logs', icon: ClipboardList, href: '/admin/audit-logs' },
        { label: 'Settings', icon: Settings, href: '/admin/settings' }
      ]
    }
  ];

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-[#111111] border-r border-[#2A2A2A] transition-all duration-300 hidden md:flex relative",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      <div className="flex h-[56px] items-center justify-between px-4 border-b border-[#2A2A2A]">
        {!collapsed && (
          <div className="flex items-center space-x-2 overflow-hidden whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-[#E50914]" />
            <span className="font-bold text-white text-sm">campuscrate echo</span>
            <Badge variant="destructive" className="bg-[#E50914] hover:bg-[#E50914] text-[10px] h-4 px-1 rounded-sm border-none ml-2">
              ADMIN
            </Badge>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-3 h-3 rounded-full bg-[#E50914]" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-hide">
        <TooltipProvider delayDuration={0}>
          {navGroups.map((group, i) => (
            <div key={i} className="px-3">
              {!collapsed && (
                <h3 className="text-[#A3A3A3] text-xs font-semibold mb-2 px-3 uppercase tracking-wider">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.filter(item => canVisitAdminPath(admin.role, item.href)).map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const content = (
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        "flex items-center space-x-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-[#181818] text-[#E50914] font-medium relative"
                          : "text-[#A3A3A3] hover:bg-[#181818] hover:text-white"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-full bg-[#E50914] rounded-r-sm" />
                      )}
                      <item.icon size={18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );

                  return collapsed ? (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right" className="bg-[#202020] text-white border-[#2A2A2A]">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={item.label}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </TooltipProvider>
      </div>

      <div className="p-3 border-t border-[#2A2A2A]">
        <div className="flex items-center space-x-3 p-2 bg-[#181818] rounded-md">
          <Avatar className="h-8 w-8 bg-[#2A2A2A] border-[#2A2A2A]">
            <AvatarFallback className="text-white text-xs bg-[#2A2A2A]">
              {admin.displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{admin.displayName}</p>
              <p className="text-[10px] text-[#A3A3A3] uppercase truncate">{admin.role.replace('_', ' ')}</p>
            </div>
          )}
        </div>
      </div>
      
      <button
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 bg-[#202020] border border-[#2A2A2A] rounded-full p-1 text-[#A3A3A3] hover:text-white z-10 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}
