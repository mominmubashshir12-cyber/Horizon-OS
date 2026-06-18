// Sidebar — main navigation sidebar with role-based access controls and active route highlighting
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Clock,
  Wrench,
  Package,
  Boxes,
  IndianRupee,
  FileText,
  Users,
  BarChart3,
  Settings,
  Lock,
  Hexagon,
  Tag,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  restricted?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Job Cards', href: '/jobs', icon: <ClipboardList size={18} /> },
      { label: 'Attendance', href: '/attendance', icon: <Clock size={18} /> },
      { label: 'Tools & Materials', href: '/tools', icon: <Wrench size={18} /> },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { label: 'Products', href: '/products', icon: <Tag size={18} /> },
      { label: 'Inventory', href: '/inventory', icon: <Boxes size={18} /> },
      { label: 'Sales', href: '/sales', icon: <IndianRupee size={18} /> },
      { label: 'Quotations', href: '/quotations', icon: <FileText size={18} /> },
    ],
  },
  {
    title: 'TEAM',
    items: [
      { label: 'Team Management', href: '/team', icon: <Users size={18} />, restricted: true },
      { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} />, restricted: true },
      { label: 'Anti-Fraud Flags', href: '/flags', icon: <AlertTriangle size={18} />, restricted: true },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isPrivileged = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [fraudCount, setFraudCount] = useState(0);

  useEffect(() => {
    const handleUpdateBadge = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setFraudCount(customEvent.detail);
    };
    window.addEventListener('update-fraud-badge', handleUpdateBadge);
    return () => window.removeEventListener('update-fraud-badge', handleUpdateBadge);
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-white/5 bg-[#090d14]">
      {/* Brand Header */}
      <div className="flex h-20 flex-col justify-center px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0088ff]">
            <span className="text-sm font-black text-white">H</span>
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            Horizon
          </span>
        </div>
      </div>

      {/* User Selector Dropdown (Visual only for now) */}
      <div className="px-4 mb-6">
        <div className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-[#121826] p-3 transition-colors hover:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0088ff]">
              <span className="text-xs font-bold text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{user?.username || 'User'}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#0088ff]">
                {user?.role || 'USER'}
              </span>
            </div>
          </div>
          <ChevronDown size={14} className="text-slate-500" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pb-8">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const showLock = item.restricted && !isPrivileged;

                return (
                  <li key={item.label + item.href}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-[#0088ff]/10 text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#0088ff]" />
                      )}
                      <span
                        className={`flex-shrink-0 transition-colors ${
                          isActive ? 'text-[#0088ff]' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {showLock && (
                        <Lock
                          size={12}
                          className="flex-shrink-0 text-slate-600"
                        />
                      )}
                      {item.href === '/flags' && fraudCount > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{fraudCount}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4">
        <div className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-[#121826] px-4 py-2 transition-colors hover:bg-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Quit</span>
        </div>
      </div>
    </aside>
  );
}
