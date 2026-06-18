// TopBar — top navigation bar displaying firm name, user info, and logout button
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirm } from '@/contexts/FirmContext';
import { LogOut, Bell, User } from 'lucide-react';

export default function TopBar() {
  const { user, logout } = useAuth();
  const { firm } = useFirm();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between bg-[#090d14] px-8">
      {/* Left: Firm Name (Hidden to give more space to PageHeader, or kept minimal) */}
      <div className="flex items-center gap-3">
        {/* We keep this empty or very minimal since the Sidebar handles branding now */}
      </div>

      {/* Right: Notifications, User Info, Logout */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#121826] text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0088ff] shadow-[0_0_8px_rgba(0,136,255,0.8)]" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 rounded-full bg-[#121826] py-1.5 pl-1.5 pr-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0088ff]/20 text-[#0088ff]">
            <User size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">
              {user?.fullName ?? 'User'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#121826] text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="Logout"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
