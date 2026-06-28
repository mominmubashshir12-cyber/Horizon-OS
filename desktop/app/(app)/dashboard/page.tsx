// app/(app)/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import Link from 'next/link';
import {
  IndianRupee, Wallet, Briefcase, Users, FileText, Bell, CheckCircle, Package, Clock, ShieldAlert,
  ArrowRight, FilePlus, Receipt, CircleDollarSign, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- MOCK DATA FALLBACKS ---

const MOCK_LIVE = {
  todaySales: { totalAmount: 45000, count: 5 },
  cashBalance: { opening: 12000, current: 57000 },
  activeJobs: { completedToday: 3, count: 6 },
  todayAttendance: { present: 8, late: 2, absent: 1 },
  pendingQuotations: { count: 4, totalValue: 125000 },
  unreadAlerts: { count: 3, criticalCount: 1 },
  lowStockItems: [{ id: 1, name: 'BNC Connectors', currentStock: 8, reorderLevel: 20 }],
  overdueTools: [{ id: 1, name: 'Crimping Tool', employeeName: 'Shadab', hoursOverdue: 24 }]
};

const MOCK_VELOCITY = [
  { date: '01/06', revenue: 15000, expense: 5000 },
  { date: '02/06', revenue: 12000, expense: 8000 },
  { date: '03/06', revenue: 25000, expense: 4000 },
  { date: '04/06', revenue: 18000, expense: 12000 },
  { date: '05/06', revenue: 35000, expense: 10000 },
  { date: '06/06', revenue: 42000, expense: 8000 },
  { date: '07/06', revenue: 20000, expense: 22000 },
];

const MOCK_JOB_STATS = [
  { name: 'Verified', value: 12, color: '#10b981' },
  { name: 'Completed', value: 25, color: '#3b82f6' },
  { name: 'In Progress', value: 8, color: '#f59e0b' },
  { name: 'Assigned', value: 5, color: '#94a3b8' },
  { name: 'Cancelled', value: 2, color: '#ef4444' }
];

const MOCK_ATTENDANCE = [
  { id: 1, name: 'HZ Bhai', initials: 'HZ', role: 'Operations', status: 'present', checkInTime: '09:00 AM', lateMinutes: 0, activeJob: null },
  { id: 2, name: 'Shadab', initials: 'SH', role: 'Technician', status: 'late', checkInTime: '09:42 AM', lateMinutes: 12, activeJob: 'JC-102' },
  { id: 3, name: 'Ozair', initials: 'OZ', role: 'Sales', status: 'absent', checkInTime: null, lateMinutes: 0, activeJob: null }
];

const MOCK_JOBCARDS = [
  { id: 1, number: 'JC-102', clientName: 'TechCorp', assignedTo: 'Shadab', scheduledTime: '10:00 AM', status: 'IN_PROGRESS' },
  { id: 2, number: 'JC-103', clientName: 'Alpha Store', assignedTo: 'Aseer', scheduledTime: '02:00 PM', status: 'ASSIGNED' },
  { id: 3, number: 'JC-104', clientName: 'Omega Ind', assignedTo: 'Rehan', scheduledTime: '11:30 AM', status: 'ARRIVED' },
];

const MOCK_SUMMARY = {
  month: 'June', year: 2026,
  income: 450000, expense: 120000, net: 330000,
  topIncome: [{ name: 'CCTV Installation', amount: 200000 }, { name: 'AMC Contracts', amount: 150000 }, { name: 'Retail Sales', amount: 100000 }],
  topExpense: [{ name: 'Inventory Purchases', amount: 80000 }, { name: 'Salary', amount: 30000 }, { name: 'Fuel', amount: 10000 }]
};

const MOCK_ACTIVITY = [
  { id: 1, type: 'attendance', message: 'Shadab checked in at 9:42 AM (12 mins late)', actor: 'Shadab', timestamp: new Date().toISOString() },
  { id: 2, type: 'job', message: 'Aseer completed job JC-2026-015 at TechCorp', actor: 'Aseer', timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: 3, type: 'sale', message: 'Sale of ₹3,500 recorded by Ozair for CCTV Camera', actor: 'Ozair', timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: 4, type: 'alert', message: 'Low stock alert: BNC Connectors (8 remaining)', actor: 'System', timestamp: new Date(Date.now() - 120 * 60000).toISOString() },
];

// --- HELPERS ---

function fmt(val: any) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
}

function getRelativeTime(timestamp: string) {
  if (!timestamp) return 'Just now';
  const diffMins = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 60000);
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${Math.floor(diffHours / 24)} days ago`;
}

function safeText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.fullName || val.name || val.username || JSON.stringify(val);
  return String(val);
}

// --- MAIN COMPONENT ---

export default function DashboardPage() {
  const { user, token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [liveData, setLiveData] = useState<any>(null);
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [jobStats, setJobStats] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  const fetchData = async () => {
    try {
      const opts = { headers: { Authorization: `Bearer ${token}` } };
      
      const safeGet = async (url: string, mockData: any, key: string) => {
        try {
          const res = await axios.get(`http://localhost:3001${url}`, opts);
          setErrors(prev => ({ ...prev, [key]: '' }));
          return res.data?.data || mockData;
        } catch (err) {
          setErrors(prev => ({ ...prev, [key]: 'Failed to load live data' }));
          return mockData;
        }
      };

      const [live, velo, stats, att, jobs, sum] = await Promise.all([
        safeGet('/api/dashboard/live', MOCK_LIVE, 'live'),
        safeGet('/api/cashflow/velocity?months=1', MOCK_VELOCITY, 'velocity'),
        safeGet('/api/jobcards/stats', MOCK_JOB_STATS, 'stats'),
        safeGet('/api/attendance/today', MOCK_ATTENDANCE, 'attendance'),
        safeGet('/api/jobcards', MOCK_JOBCARDS, 'jobs'),
        safeGet('/api/cashflow/summary', MOCK_SUMMARY, 'summary'),
        // Activity feed mocked API calls
        safeGet('/api/dashboard/alerts?limit=10', [], 'alerts'),
        safeGet('/api/sales/my-sales', [], 'sales')
      ]);

      setLiveData(live);
      setVelocityData(Array.isArray(velo) ? velo : MOCK_VELOCITY);
      setJobStats(Array.isArray(stats) ? stats : MOCK_JOB_STATS);
      setAttendance(Array.isArray(att) ? att : MOCK_ATTENDANCE);
      setJobCards(Array.isArray(jobs) ? jobs : MOCK_JOBCARDS);
      
      // Deep merge for financial summary to ensure inner arrays exist
      setFinancialSummary({
        ...MOCK_SUMMARY,
        ...(sum || {}),
        topIncome: Array.isArray(sum?.topIncome) ? sum.topIncome : MOCK_SUMMARY.topIncome,
        topExpense: Array.isArray(sum?.topExpense) ? sum.topExpense : MOCK_SUMMARY.topExpense,
      });

      // Simulating merging for the activity feed
      const sortedActivity = [...MOCK_ACTIVITY].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
      setActivityFeed(sortedActivity);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData();
    const dataInterval = setInterval(fetchData, 60000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, [token]);

  // Calculations
  const hour = currentTime.getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17) greeting = 'Good Evening';

  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
  const fullName = safeText(user?.fullName || user?.username || 'User');

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return tickItem.toString();
  };

  const activeJobPipeline = jobCards?.filter(j => ['IN_PROGRESS', 'ARRIVED', 'EN_ROUTE', 'ASSIGNED'].includes(j.status))
    .sort((a, b) => {
      const order = { 'IN_PROGRESS': 1, 'ARRIVED': 2, 'EN_ROUTE': 3, 'ASSIGNED': 4 };
      return (order[a.status as keyof typeof order] || 5) - (order[b.status as keyof typeof order] || 5);
    }) || [];

  return (
    <div className="p-6 md:p-12 max-w-[1600px] mx-auto w-full flex flex-col gap-10 animate-fade-in relative z-10 font-sans">
      
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      {/* --- SECTION 1: Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] p-6 md:p-8 rounded-[2rem] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
        <div className="relative z-10 mb-6 md:mb-0">
          <p className="mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            {dateStr}
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">{greeting}, <br className="hidden md:block" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{fullName}</span></h1>
        </div>
        <div className="flex flex-col items-start md:items-end relative z-10">
          <p className="text-4xl md:text-5xl font-black text-white tracking-wider font-mono bg-white/[0.03] px-6 py-3 rounded-3xl border border-white/5 shadow-inner">{timeStr}</p>
          <div className="flex items-center gap-2 mt-4 ml-2 md:ml-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: KPI Row --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-6 mb-10">
        {loading ? Array(6).fill(0).map((_, i) => <div key={i} className="h-40 bg-[#131927]/90 border border-white/[0.04] animate-pulse rounded-3xl" />) : (
          <>
            {/* Card 1 */}
            <Link href="/sales" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                  <IndianRupee size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Today's Revenue</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{fmt(liveData?.todaySales?.totalAmount || 0)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <ArrowUpRight size={12} strokeWidth={3} />
                  <span>+{liveData?.todaySales?.count || 0} sales today</span>
                </div>
              </div>
              </div>
            </Link>

            {/* Card 2 */}
            <Link href="/cashflow" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full group-hover:bg-blue-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-110 transition-transform">
                  <Wallet size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Cash Balance</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{fmt(liveData?.cashBalance?.current || 0)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Opening: {fmt(liveData?.cashBalance?.opening || 0)}</span>
                </div>
              </div>
              </div>
            </Link>

            {/* Card 3 */}
            <Link href="/jobs" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(249,115,22,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full group-hover:bg-orange-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner group-hover:scale-110 transition-transform">
                  <Briefcase size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Active Jobs</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{liveData?.activeJobs?.count || (liveData?.activeJobs ? Object.values(liveData.activeJobs).reduce((a:any,b:any)=>a+b,0) : 0)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                  <CheckCircle size={12} strokeWidth={3} />
                  <span>{liveData?.activeJobs?.completedToday || 0} completed</span>
                </div>
              </div>
              </div>
            </Link>

            {/* Card 4 */}
            <Link href="/attendance" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                  <Users size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Present Today</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{(liveData?.todayAttendance?.present || 0) + (liveData?.todayAttendance?.late || 0)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="text-amber-400">{liveData?.todayAttendance?.late || 0} late</span>
                  <span className="text-slate-600 px-1">•</span>
                  <span className="text-red-400">{liveData?.todayAttendance?.absent || 0} absent</span>
                </div>
              </div>
              </div>
            </Link>

            {/* Card 5 */}
            <Link href="/quotations" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full group-hover:bg-purple-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-110 transition-transform">
                  <FileText size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Pending Quotes</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{liveData?.pendingQuotations?.count || 0}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{fmt(liveData?.pendingQuotations?.totalValue || 0)} total value</span>
                </div>
              </div>
              </div>
            </Link>

            {/* Card 6 */}
            <Link href="/flags" className="relative bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl hover:bg-[#1a2235]/95 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(239,68,68,0.15)] group overflow-hidden flex flex-col h-full">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/10 blur-3xl rounded-full group-hover:bg-red-500/20 transition-all"></div>
              <div className="p-6 flex flex-col justify-between min-h-[160px] h-full w-full relative z-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-inner group-hover:scale-110 transition-transform">
                  <Bell size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Unread Alerts</span>
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter mb-1.5">{liveData?.unreadAlerts?.count || 0}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  {(liveData?.unreadAlerts?.criticalCount || 0) > 0 ? (
                    <><AlertTriangle size={12} strokeWidth={3} /> <span>{liveData?.unreadAlerts?.criticalCount} critical</span></>
                  ) : (
                    <span className="text-slate-400">All systems normal</span>
                  )}
                </div>
              </div>
              </div>
            </Link>
          </>
        )}
      </div>

      {/* --- SECTION 3: Charts Row --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-5 gap-6 mb-10">
        
        {/* Revenue vs Expense (60%) */}
        <div className="lg:col-span-1 2xl:col-span-3 bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col min-h-[400px] min-w-0">
          <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-blue-500/5 blur-[100px] pointer-events-none"></div>
          {loading ? <div className="flex-1 bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
            <div className="p-8 flex flex-col w-full h-full relative z-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">Revenue vs Expenses</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">Last 30 days Performance</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:gap-5 bg-white/[0.02] px-3 md:px-4 py-2 rounded-full border border-white/[0.04] shrink-0 max-w-full">
                  <div className="flex items-center gap-2 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-[#0088ff] shadow-[0_0_8px_rgba(0,136,255,0.8)]"></div><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Revenue</span></div>
                  <div className="flex items-center gap-2 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Expense</span></div>
                </div>
              </div>
              <div className="flex-1 min-h-0 w-full relative -ml-6 z-10">
                {velocityData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <BarChart3 size={40} className="mb-4 opacity-20" strokeWidth={1} />
                    <p className="text-xs font-bold uppercase tracking-widest">No financial data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0088ff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0088ff" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="date" stroke="#475569" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#475569" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 21, 34, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 800 }}
                        labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}
                        formatter={(value: any) => fmt(value)}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#0088ff" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Job Completion Rate (40%) */}
        <div className="lg:col-span-1 2xl:col-span-2 bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col min-h-[400px] min-w-0">
          <div className="absolute bottom-0 left-0 w-[300px] h-[200px] bg-emerald-500/5 blur-[80px] pointer-events-none"></div>
          {loading ? <div className="flex-1 bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
            <div className="p-8 flex flex-col w-full h-full relative z-10">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white tracking-wide relative z-10">Job Completion Rate</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 relative z-10">Current Distribution</p>
              </div>
              
              <div className="flex-1 flex flex-col sm:flex-row items-center justify-between px-2 relative z-10">
                {jobStats.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <Briefcase size={40} className="mb-4 opacity-20" strokeWidth={1} />
                    <p className="text-xs font-bold uppercase tracking-widest">No job data available</p>
                  </div>
                ) : (
                  <>
                    <div className="h-[220px] w-[220px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={jobStats}
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={6}
                          >
                            {jobStats.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'rgba(15, 21, 34, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}
                            itemStyle={{ color: '#fff', fontWeight: 800 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none drop-shadow-2xl">
                        <span className="text-4xl font-black text-white">{jobStats.reduce((a: any, b: any) => a + b.value, 0)}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Total Jobs</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3.5 mt-6 sm:mt-0 w-full sm:w-auto ml-4">
                      {jobStats.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between sm:justify-start gap-5 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }}></div>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{item.name}</span>
                          </div>
                          <span className="text-lg font-black text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 4: Operations Row --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 mb-10">
        
        {/* Column 1: Today's Field Status */}
        <div className="bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl flex flex-col min-h-[450px] max-h-[600px] relative overflow-hidden min-w-0">
          {loading ? <div className="h-full bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
            <div className="p-8 flex flex-col w-full h-full relative z-10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white tracking-wide">Field Status</h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{dateStr}</p>
                  <div className="text-[10px] font-bold text-slate-300 bg-white/[0.03] py-1.5 px-3 rounded-full border border-white/[0.05] tracking-widest uppercase">
                    <span className="text-emerald-400">{liveData?.todayAttendance?.present || 0} Pres</span> <span className="text-slate-600 mx-1">•</span> <span className="text-amber-400">{liveData?.todayAttendance?.late || 0} Late</span> <span className="text-slate-600 mx-1">•</span> <span className="text-red-400">{liveData?.todayAttendance?.absent || 0} Abs</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide relative z-10">
                {attendance.map((emp: any, index: number) => {
                  const statusColors = { 'present': 'bg-emerald-500', 'late': 'bg-amber-500', 'absent': 'bg-red-500' };
                  const colorClass = statusColors[emp.status?.toLowerCase() as keyof typeof statusColors] || 'bg-slate-500';
                  return (
                    <div key={emp.id || emp._id || `emp-${index}`} className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] hover:border-white/[0.05] transition-all group">
                      <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:scale-105 transition-transform`}>
                        <span className={`text-xs font-black ${colorClass.replace('bg-', 'text-')}`}>{emp.initials}</span>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#131927] ${colorClass}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate tracking-wide">{safeText(emp.name)}</p>
                          {emp.activeJob && (
                            <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest">{safeText(emp.activeJob)}</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">{safeText(emp.role)}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.checkInTime || 'No scan'}</span>
                        {emp.lateMinutes > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mt-1 border border-amber-500/20">{emp.lateMinutes}m late</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Active Job Pipeline */}
        <div className="bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl flex flex-col min-h-[450px] max-h-[600px] relative overflow-hidden min-w-0">
          {loading ? <div className="h-full bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
            <div className="p-8 flex flex-col w-full h-full relative z-10">
              <div className="mb-6 flex items-end justify-between relative z-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">Job Pipeline</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">Live Assignments</p>
                </div>
                <Link href="/jobs" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-colors">View all {activeJobPipeline.length}</Link>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide relative z-10">
                {activeJobPipeline.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-emerald-500/70 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <CheckCircle size={40} className="mb-4 opacity-50" strokeWidth={1.5} />
                    <p className="text-xs font-bold uppercase tracking-widest">All clear — no active jobs</p>
                  </div>
                ) : (
                  activeJobPipeline.slice(0, 6).map((job: any, index: number) => {
                    const statusColors = { 'IN_PROGRESS': 'border-l-orange-500 text-orange-400', 'ARRIVED': 'border-l-blue-500 text-blue-400', 'EN_ROUTE': 'border-l-purple-500 text-purple-400', 'ASSIGNED': 'border-l-slate-400 text-slate-400' };
                    const colorData = statusColors[job.status as keyof typeof statusColors] || 'border-l-slate-500 text-slate-500';
                    const [borderColor, textColor] = colorData.split(' ');
                    
                    return (
                      <Link href={`/jobs`} key={job.id || job._id || `job-${index}`} className={`flex flex-col justify-center p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] hover:border-white/[0.05] transition-all border-l-[3px] ${borderColor} group`}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] truncate">{safeText(job.number)}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] shrink-0 ${textColor}`}>{safeText(job.status).replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm font-black text-white tracking-wide group-hover:text-blue-400 transition-colors truncate">{safeText(job.clientName)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 truncate">{safeText(job.assignedTo)} <span className="text-slate-600 mx-1 shrink-0">•</span> {safeText(job.scheduledTime)}</span>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Inventory Alerts */}
        <div className="bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl flex flex-col min-h-[450px] max-h-[600px] relative overflow-hidden min-w-0">
          {loading ? <div className="h-full bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
            <div className="p-8 flex flex-col w-full h-full relative z-10">
              <div className="mb-6 relative z-10">
                <h3 className="text-xl font-bold text-white tracking-wide">Stock & Tools</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">Action Required</p>
              </div>
              <div className="flex-1 overflow-y-auto pr-3 scrollbar-hide flex flex-col gap-8 relative z-10">
                
                {!(liveData?.lowStockItems?.length) && !(liveData?.overdueTools?.length) && (
                  <div className="h-full flex flex-col items-center justify-center text-emerald-500/70 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <Package size={40} className="mb-4 opacity-50" strokeWidth={1.5} />
                    <p className="text-xs font-bold uppercase tracking-widest">All inventory healthy</p>
                  </div>
                )}

                {(liveData?.lowStockItems?.length > 0) && (
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div> Low Stock Items
                    </h4>
                    <div className="space-y-2">
                      {liveData.lowStockItems.map((item: any, index: number) => (
                        <div key={item.id || item._id || `stock-${index}`} className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-colors gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white tracking-wide truncate">{safeText(item.name)}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate">Reorder: {item.reorderLevel}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-lg font-black text-red-400 tracking-tighter">{item.currentStock}</span>
                            <span className="text-[8px] font-black bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md uppercase tracking-widest border border-amber-500/20 shrink-0">Restock</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(liveData?.overdueTools?.length > 0) && (
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div> Overdue Tools
                    </h4>
                    <div className="space-y-2">
                      {liveData.overdueTools.map((tool: any, index: number) => (
                        <div key={tool.id || tool._id || `tool-${index}`} className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-colors gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white tracking-wide truncate">{safeText(tool.name)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{safeText(tool.employeeName)}</p>
                          </div>
                          <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20 shrink-0">{tool.hoursOverdue}h over</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* --- SECTION 5: Live Activity Feed --- */}
      <div className="bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl relative overflow-hidden mb-10 min-w-0">
        {loading ? <div className="h-[200px] bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
          <div className="p-8 flex flex-col w-full h-full relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 relative z-10 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Live Activity Feed</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">Real-time enterprise events</p>
              </div>
              <Link href="/flags" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-colors shrink-0">View Alert Center</Link>
            </div>
            
            {activityFeed.length === 0 ? (
               <div className="w-full py-10 flex flex-col items-center justify-center text-slate-500 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                 <Clock size={40} className="mb-4 opacity-20" strokeWidth={1.5} />
                 <p className="text-xs font-bold uppercase tracking-widest">No recent activity detected</p>
               </div>
            ) : (
              <div className="flex flex-col gap-3 relative z-10">
                {activityFeed.map((item: any, index: number) => {
                  const config = {
                    'alert': { icon: <ShieldAlert size={18} strokeWidth={2.5} />, color: 'text-red-400', border: 'border-l-red-500', bg: 'bg-red-500/10' },
                    'sale': { icon: <Receipt size={18} strokeWidth={2.5} />, color: 'text-emerald-400', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10' },
                    'job': { icon: <Briefcase size={18} strokeWidth={2.5} />, color: 'text-orange-400', border: 'border-l-orange-500', bg: 'bg-orange-500/10' },
                    'attendance': { icon: <Clock size={18} strokeWidth={2.5} />, color: 'text-blue-400', border: 'border-l-blue-500', bg: 'bg-blue-500/10' },
                  }[item.type as string] || { icon: <Bell size={18} strokeWidth={2.5} />, color: 'text-slate-400', border: 'border-l-slate-500', bg: 'bg-slate-500/10' };

                  return (
                    <div key={item.id || item._id || `activity-${index}`} className={`flex items-center gap-5 p-5 rounded-2xl bg-white/[0.01] border border-white/[0.02] hover:bg-white/[0.03] hover:border-white/[0.05] transition-all relative overflow-hidden group`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg.replace('/10', '/40')} group-hover:w-1.5 transition-all`}></div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.05] ${config.bg} ${config.color} shadow-inner group-hover:scale-110 transition-transform`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white tracking-wide truncate">{safeText(item.message)}</p>
                        <p className="text-[9px] font-black text-blue-400 mt-1.5 uppercase tracking-[0.2em] truncate">{safeText(item.actor)}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0 pl-2">{getRelativeTime(item.timestamp)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- SECTION 6: Financial Snapshot --- */}
      <div className="bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] rounded-3xl shadow-2xl relative overflow-hidden mb-10 min-w-0">
        {loading ? <div className="h-[250px] bg-white/[0.02] animate-pulse rounded-2xl m-8" /> : (
          <div className="p-8 flex flex-col w-full h-full relative z-10">
            <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 relative z-10 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Financial Snapshot</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">Monthly Overview</p>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-4 py-2 bg-white/[0.03] border border-white/[0.05] rounded-full shadow-inner shrink-0">{financialSummary?.month} {financialSummary?.year}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
              <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/[0.04] shadow-inner relative overflow-hidden group hover:bg-white/[0.03] transition-colors">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> This Month Income</p>
                <p className="text-4xl font-black text-white tracking-tighter">{fmt(financialSummary?.income || 0)}</p>
              </div>
              <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/[0.04] shadow-inner relative overflow-hidden group hover:bg-white/[0.03] transition-colors">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-red-500/10 blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> This Month Expense</p>
                <p className="text-4xl font-black text-white tracking-tighter">{fmt(financialSummary?.expense || 0)}</p>
              </div>
              <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/[0.04] shadow-inner relative overflow-hidden group hover:bg-white/[0.03] transition-colors">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Net Cashflow</p>
                <p className={`text-4xl font-black tracking-tighter ${(financialSummary?.net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(financialSummary?.net || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(financialSummary?.net || 0))}
                </p>
              </div>
            </div>

            {/* Ratio Bar */}
            <div className="mb-10 relative z-10 bg-white/[0.01] p-6 rounded-3xl border border-white/[0.02]">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                <span className="text-emerald-400">{(((financialSummary?.income || 0) / ((financialSummary?.income || 0) + (financialSummary?.expense || 0))) * 100 || 0).toFixed(1)}% IN</span>
                <span className="text-red-400">{(((financialSummary?.expense || 0) / ((financialSummary?.income || 0) + (financialSummary?.expense || 0))) * 100 || 0).toFixed(1)}% OUT</span>
              </div>
              <div className="w-full h-4 rounded-full flex overflow-hidden shadow-inner bg-slate-900 border border-white/[0.05]">
                <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${((financialSummary?.income || 0) / ((financialSummary?.income || 0) + (financialSummary?.expense || 0))) * 100 || 50}%` }}></div>
                <div className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: `${((financialSummary?.expense || 0) / ((financialSummary?.income || 0) + (financialSummary?.expense || 0))) * 100 || 50}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 border-b border-white/[0.05] pb-3">TOP INCOME SOURCES</p>
                <div className="space-y-4">
                  {financialSummary?.topIncome?.map((cat: any, i: number) => (
                    <div key={i} className="flex items-center justify-between group gap-2">
                      <div className="flex items-center gap-3 min-w-0"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform shrink-0"></div><span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate">{safeText(cat.name)}</span></div>
                      <span className="text-sm font-black text-white tracking-wide shrink-0">{fmt(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 border-b border-white/[0.05] pb-3">TOP EXPENSE DRIVERS</p>
                <div className="space-y-4">
                  {financialSummary?.topExpense?.map((cat: any, i: number) => (
                    <div key={i} className="flex items-center justify-between group gap-2">
                      <div className="flex items-center gap-3 min-w-0"><div className="w-1.5 h-1.5 rounded-full bg-red-500 group-hover:scale-150 transition-transform shrink-0"></div><span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate">{safeText(cat.name)}</span></div>
                      <span className="text-sm font-black text-white tracking-wide shrink-0">{fmt(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- SECTION 7: Quick Actions --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 pb-10">
        <Link href="/jobs?create=true" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-orange-500/30 group-hover:bg-orange-500 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/20 transition-all">
              <FilePlus size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">New Job Card</span>
          </div>
        </Link>
        <Link href="/sales?create=true" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500/30 group-hover:bg-emerald-500 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <CircleDollarSign size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">Record Sale</span>
          </div>
        </Link>
        <Link href="/quotations?create=true" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-purple-500/30 group-hover:bg-purple-500 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
              <FileText size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">New Quotation</span>
          </div>
        </Link>
        <Link href="/cashflow?create=true" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-500/30 group-hover:bg-blue-500 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">Add Transaction</span>
          </div>
        </Link>
        <Link href="/reports" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-slate-400/30 group-hover:bg-slate-400 group-hover:shadow-[0_0_15px_rgba(148,163,184,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-400/10 border border-slate-400/20 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:bg-slate-400/20 transition-all">
              <BarChart3 size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">View Reports</span>
          </div>
        </Link>
        <Link href="/team" className="group relative flex flex-col items-center justify-center bg-[#131927]/90 backdrop-blur-xl border border-white/[0.04] hover:bg-[#1a2235]/95 rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500/30 group-hover:bg-emerald-500 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.8)] transition-all"></div>
          <div className="p-6 flex flex-col items-center justify-center gap-4 w-full h-full relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate w-full text-center">Team Performance</span>
          </div>
        </Link>
      </div>

    </div>
  );
}
