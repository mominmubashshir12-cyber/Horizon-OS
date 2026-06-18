'use client';

import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Users, Briefcase, IndianRupee, Bell, AlertTriangle, Package, FileText, Wrench, X } from 'lucide-react';

interface DashboardLive {
  presentCount: number;
  activeJobsCount: number;
  revenue: number;
  unreadAlertsCount: number;
  attendance: { id: string; name: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }[];
  activeJobs: { id: string; title: string; status: string }[];
  lowStock: { id: string; name: string; currentStock: number; minStock: number }[];
  pendingQuotations: { id: string; number: string; validUntil: string; amount: number }[];
  overdueTools: { id: string; name: string; assignedTo: string; dueDate: string }[];
}

interface Alert {
  id: string;
  message: string;
  createdAt: string;
}

const MOCK_DASHBOARD: DashboardLive = {
  presentCount: 12,
  activeJobsCount: 5,
  revenue: 145000,
  unreadAlertsCount: 3,
  attendance: [
    { id: '1', name: 'Rahul Sharma', status: 'PRESENT' },
    { id: '2', name: 'Amit Kumar', status: 'LATE' },
    { id: '3', name: 'Priya Singh', status: 'PRESENT' },
    { id: '4', name: 'Vikram Das', status: 'ABSENT' },
  ],
  activeJobs: [
    { id: '1', title: 'Network Install - TechCorp', status: 'IN_PROGRESS' },
    { id: '2', title: 'Server Maintenance - InfoSys', status: 'PENDING' },
    { id: '3', title: 'Cabling - StartupX', status: 'IN_PROGRESS' },
  ],
  lowStock: [
    { id: '1', name: 'CAT6 Cable Box', currentStock: 2, minStock: 5 },
    { id: '2', name: 'RJ45 Connectors', currentStock: 50, minStock: 200 },
  ],
  pendingQuotations: [
    { id: '1', number: 'QT-2026-001', validUntil: new Date(Date.now() + 3 * 86400000).toISOString(), amount: 45000 },
    { id: '2', number: 'QT-2026-002', validUntil: new Date(Date.now() + 10 * 86400000).toISOString(), amount: 125000 },
  ],
  overdueTools: [
    { id: '1', name: 'Crimping Tool #4', assignedTo: 'Amit Kumar', dueDate: new Date(Date.now() - 2 * 86400000).toISOString() },
  ],
};

const MOCK_ALERTS: Alert[] = [
  { id: '1', message: 'Low stock warning for CAT6 Cable Box', createdAt: new Date().toISOString() },
  { id: '2', message: 'Quotation QT-2026-001 is expiring soon', createdAt: new Date(Date.now() - 3600000).toISOString() },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardLive | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchData = async () => {
    try {
      const [liveRes, alertsRes] = await Promise.all([
        axios.get<DashboardLive>('/api/dashboard/live').catch(() => ({ data: MOCK_DASHBOARD })),
        axios.get<Alert[]>('/api/dashboard/alerts').catch(() => ({ data: MOCK_ALERTS }))
      ]);
      if (liveRes.data) setData(liveRes.data);
      if (alertsRes.data) setAlerts(alertsRes.data);
    } catch (e) {
      console.error(e);
      setData(MOCK_DASHBOARD);
      setAlerts(MOCK_ALERTS);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const getDaysDiff = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  if (!data) return <div className="p-8 text-center text-white animate-pulse">Loading dashboard...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Owner Dashboard" subtitle="Live updates every 60s" />

      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Present', value: data.presentCount.toString(), icon: <Users />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Active Jobs', value: data.activeJobsCount.toString(), icon: <Briefcase />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Revenue', value: formatCurrency(data.revenue), icon: <IndianRupee />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Unread Alerts', value: data.unreadAlertsCount.toString(), icon: <Bell />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        ].map((card, i) => (
          <div key={i} className="flex items-center p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg} ${card.color} mr-4`}>
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-[#f8fafc]">{card.value}</p>
              <p className="text-sm text-[#94a3b8]">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Today's Attendance</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.attendance.map(emp => (
              <div key={emp.id} className="min-w-[100px] p-3 rounded-lg border border-[#334155] bg-[#0f172a] text-center flex-shrink-0">
                <div className="text-sm text-white font-medium truncate">{emp.name}</div>
                <div className={`text-xs mt-1 ${emp.status === 'PRESENT' ? 'text-emerald-400' : emp.status === 'ABSENT' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {emp.status}
                </div>
              </div>
            ))}
            {data.attendance.length === 0 && <span className="text-sm text-[#94a3b8]">No records</span>}
          </div>
        </div>
        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Active Jobs</h3>
          <div className="space-y-3">
            {data.activeJobs.slice(0, 5).map(job => (
              <div key={job.id} className="flex justify-between items-center p-3 rounded-lg bg-[#0f172a]">
                <span className="text-sm text-white font-medium truncate mr-2">{job.title}</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 whitespace-nowrap">{job.status}</span>
              </div>
            ))}
            {data.activeJobs.length === 0 && <span className="text-sm text-[#94a3b8]">No active jobs</span>}
          </div>
        </div>
      </div>

      {/* Third row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <div className="flex items-center gap-2 mb-4 text-rose-400">
            <AlertTriangle size={20} />
            <h3 className="text-lg font-semibold text-white">Low Stock Alerts</h3>
          </div>
          <div className="space-y-3">
            {data.lowStock.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="text-white truncate pr-2">{item.name}</span>
                <span className="text-rose-400 font-medium whitespace-nowrap">{item.currentStock} / {item.minStock}</span>
              </div>
            ))}
            {data.lowStock.length === 0 && <span className="text-sm text-[#94a3b8]">All stocks healthy</span>}
          </div>
        </div>

        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <div className="flex items-center gap-2 mb-4 text-amber-400">
            <FileText size={20} />
            <h3 className="text-lg font-semibold text-white">Pending Quotations</h3>
          </div>
          <div className="space-y-3">
            {data.pendingQuotations.map(q => {
              const days = getDaysDiff(q.validUntil);
              const isExpiring = days < 5;
              return (
                <div key={q.id} className="flex flex-col p-3 rounded-lg bg-[#0f172a] text-sm">
                  <div className="flex justify-between text-white font-medium">
                    <span>{q.number}</span>
                    <span>{formatCurrency(q.amount)}</span>
                  </div>
                  <div className={`mt-1 text-xs ${isExpiring ? 'text-amber-500' : 'text-[#94a3b8]'}`}>
                    Expires in {days} days
                  </div>
                </div>
              );
            })}
            {data.pendingQuotations.length === 0 && <span className="text-sm text-[#94a3b8]">No pending quotes</span>}
          </div>
        </div>

        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <div className="flex items-center gap-2 mb-4 text-purple-400">
            <Wrench size={20} />
            <h3 className="text-lg font-semibold text-white">Overdue Tools</h3>
          </div>
          <div className="space-y-3">
            {data.overdueTools.map(t => (
              <div key={t.id} className="flex flex-col text-sm border-b border-[#334155] pb-2 last:border-0 last:pb-0">
                <span className="text-white font-medium truncate">{t.name}</span>
                <span className="text-[#94a3b8] text-xs mt-1">Assigned to: {t.assignedTo} | Due: {new Date(t.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
              </div>
            ))}
            {data.overdueTools.length === 0 && <span className="text-sm text-[#94a3b8]">No overdue tools</span>}
          </div>
        </div>
      </div>

      {/* Fourth row: Alerts Panel */}
      <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Alerts</h3>
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className="flex justify-between items-start p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div>
                <p className="text-sm text-white">{alert.message}</p>
                <p className="text-xs text-[#94a3b8] mt-1">{new Date(alert.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="text-[#94a3b8] hover:text-white p-1 ml-4 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-[#94a3b8]">No recent alerts.</p>}
        </div>
      </div>
    </div>
  );
}
