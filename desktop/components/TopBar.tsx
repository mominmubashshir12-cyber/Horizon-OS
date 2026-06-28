// TopBar — top navigation bar displaying user info, and logout button
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Bell, User } from 'lucide-react';

export default function TopBar() {
  const { user, logout } = useAuth();

  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase().replace('_', ' ')
    : '';

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-end border-b border-[#2a2a2a] bg-[#0a0a0a] px-8">
      {/* Right: Notifications, User Info, Logout */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-sm bg-[#0070f3]" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 rounded-lg py-1">
          <div className="flex flex-col text-right">
            <span className="text-sm font-medium text-white">
              {user?.fullName ?? 'User'}
            </span>
            {roleLabel && (
              <span className="text-xs text-[#52525b] uppercase tracking-wide">
                {roleLabel}
              </span>
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a1a1a] text-[#a1a1aa]">
            <User size={14} />
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a1a1aa] transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Logout"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
