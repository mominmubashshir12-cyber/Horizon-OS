// Settings page — application and firm configuration options
'use client';

import React from 'react';
import PageHeader from '@/components/PageHeader';
import { Settings, Building2, Palette, Shield, Bell } from 'lucide-react';

interface SettingsSection {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    label: 'Company Profile',
    description: 'Update firm name, address, GST, and logo',
    icon: <Building2 size={22} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    label: 'Appearance',
    description: 'Theme, layout, and display preferences',
    icon: <Palette size={22} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    label: 'Security',
    description: 'Password, two-factor, and session settings',
    icon: <Shield size={22} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    label: 'Notifications',
    description: 'Alert preferences and notification channels',
    icon: <Bell size={22} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
];

export default function SettingsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Configure your workspace and preferences"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.label}
            type="button"
            className="group flex items-start gap-4 rounded-xl border border-[#334155] bg-[#1e293b] p-5 text-left transition-all duration-200 hover:border-[#2563eb]/30 hover:shadow-lg hover:shadow-[#2563eb]/5"
          >
            <div
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${section.bgColor} ${section.color}`}
            >
              {section.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#f8fafc]">{section.label}</h3>
              <p className="mt-0.5 text-xs text-[#94a3b8]">{section.description}</p>
            </div>
            <Settings
              size={16}
              className="mt-1 flex-shrink-0 text-[#94a3b8] opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ))}
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-8 rounded-xl border border-[#334155] bg-[#1e293b] p-6 text-center">
        <p className="text-sm text-[#94a3b8]">
          Settings configuration is under development. These panels will become
          interactive once connected to the backend.
        </p>
        <span className="mt-3 inline-block rounded-full bg-[#2563eb]/10 px-4 py-1.5 text-xs font-medium text-[#2563eb]">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
