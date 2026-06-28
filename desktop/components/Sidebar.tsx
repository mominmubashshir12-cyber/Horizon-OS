// Sidebar — main navigation sidebar with premium command center aesthetic
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
  AlertTriangle,
  TrendingUp,
  LogOut,
  ChevronDown,
  Building2,
  Monitor
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
      { label: 'Tools', href: '/tools', icon: <Wrench size={18} /> },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Cashflow', href: '/cashflow', icon: <TrendingUp size={18} />, restricted: true },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { label: 'Products', href: '/products', icon: <Package size={18} /> },
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
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isPrivileged = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [fraudCount, setFraudCount] = useState(0);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    const handleUpdateBadge = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setFraudCount(customEvent.detail);
    };
    window.addEventListener('update-fraud-badge', handleUpdateBadge);
    return () => window.removeEventListener('update-fraud-badge', handleUpdateBadge);
  }, []);

  return (
    <aside className="flex flex-col h-full w-[260px] backdrop-blur-xl flex-shrink-0" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border-base)' }}>
      {/* Workspace Switcher */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-base)' }}>
        <button 
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 border border-transparent hover:border-white/10"
          style={{ '--tw-hover-bg': 'var(--color-surface-hover)' } as any}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-sm" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Building2 size={20} style={{ color: 'var(--color-brand-primary)' }} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Horizon OS</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>HQ Workspace</span>
            </div>
          </div>
          <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(item => !item.restricted || isPrivileged);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-8">
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-tertiary)' }}>
                {section.title}
              </p>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <li key={item.label + item.href}>
                      <Link
                        href={item.href}
                        className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
                        style={{ 
                          background: isActive ? 'var(--color-surface-hover)' : 'transparent',
                          color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          borderLeft: isActive ? '2px solid var(--color-brand-primary)' : '2px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }
                        }}
                      >
                        <span
                          className="flex-shrink-0 transition-colors duration-200"
                          style={{ color: isActive ? 'var(--color-brand-primary)' : 'inherit' }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 tracking-wide">{item.label}</span>
                        {item.href === '/flags' && fraudCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-md bg-red-500/20 text-xs font-bold text-red-400 border border-red-500/30">
                            {fraudCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Settings & Bottom Controls */}
      <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--color-border-base)' }}>
        <ul className="space-y-1 mb-4">
          <li>
            <Link
              href="/settings"
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
              style={{ 
                background: pathname === '/settings' ? 'var(--color-surface-hover)' : 'transparent',
                color: pathname === '/settings' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderLeft: pathname === '/settings' ? '2px solid var(--color-brand-primary)' : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (pathname !== '/settings') {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== '/settings') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <Settings size={18} style={{ color: pathname === '/settings' ? 'var(--color-brand-primary)' : 'inherit' }} />
              <span className="tracking-wide">System Settings</span>
            </Link>
          </li>
        </ul>
      </div>

      {/* User Profile */}
      <div className="p-4" style={{ background: 'var(--color-surface-highlight)' }}>
        <div className="flex items-center justify-between rounded-xl p-3 border hover:border-[#374151] transition-colors duration-200 shadow-lg" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-base)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-inner">
              <span className="text-sm font-bold text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>{user?.username || 'User'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-brand-primary)' }}>
                {user?.role || 'USER'}
              </span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand-rose)'; e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
            title="Log out"
          >
             <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
