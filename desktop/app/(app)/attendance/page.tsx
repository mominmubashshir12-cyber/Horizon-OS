'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Clock, Calendar, Search, MapPin, Image as ImageIcon, ExternalLink, Info, CheckCircle, Download, FileText
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { apiGet, apiPost } from '@/services/api';
import type { Attendance, User as UserType, PerformanceReport } from '@/types';

type TabType = 'today' | 'history' | 'performance';

const formatISTTime = (timeStr: string | null | undefined) => {
  if (!timeStr) return '—';
  return new Date(timeStr).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatISTDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function AttendancePage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [users, setUsers] = useState<UserType[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiGet<UserType[]>('/users');
      if (res.success) {
        setUsers(res.data.filter((u) => u.isActive));
      }
    } catch (err: unknown) {
      console.error('Failed to retrieve users', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader
        title="Attendance & Performance"
        subtitle="Manage daily logs, view historical attendance, and generate performance reports"
      />

      <div className="mb-6 flex space-x-2 border-b border-[#334155] pb-4">
        {(['today', 'history', 'performance'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-[#2563eb] text-white'
                : 'bg-transparent text-slate-400 hover:bg-[#1e293b] hover:text-[#f8fafc]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'today' && <TodayTab users={users} />}
      {activeTab === 'history' && <HistoryTab users={users} />}
      {activeTab === 'performance' && <PerformanceTab users={users} />}
    </div>
  );
}

function TodayTab({ users }: { users: UserType[] }) {
  const [todayLogs, setTodayLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchTodayLogs = useCallback(async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const res = await apiGet<Attendance[]>(`/attendance?startDate=${todayStr}&endDate=${todayStr}`);
      if (res.success) {
        setTodayLogs(res.data);
      }
    } catch (err: unknown) {
      console.error('Failed to get today logs', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayLogs();
    const interval = setInterval(() => {
      fetchTodayLogs();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchTodayLogs]);

  const combined = useMemo(() => {
    return users.map(user => {
      const log = todayLogs.find(l => l.userId === user.id);
      return { user, log };
    });
  }, [users, todayLogs]);

  const stats = useMemo(() => {
    return combined.reduce((acc, { log }) => {
      if (!log) {
        acc.absent++;
      } else if (log.status === 'ABSENT') {
        acc.absent++;
      } else if (log.lateMinutes > 0) {
        acc.late++;
      } else {
        acc.present++;
      }
      return acc;
    }, { present: 0, late: 0, absent: 0 });
  }, [combined]);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="rounded-full bg-green-500/20 text-green-400 px-4 py-1.5 text-sm font-medium border border-green-500/30">
          Present: {stats.present}
        </div>
        <div className="rounded-full bg-yellow-500/20 text-yellow-400 px-4 py-1.5 text-sm font-medium border border-yellow-500/30">
          Late: {stats.late}
        </div>
        <div className="rounded-full bg-red-500/20 text-red-400 px-4 py-1.5 text-sm font-medium border border-red-500/30">
          Absent: {stats.absent}
        </div>
      </div>

      {isLoading && <div className="text-slate-400">Refreshing live board...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {combined.map(({ user, log }) => {
          let statusColor = 'bg-red-500';
          let statusText = 'Absent';
          if (log && log.status !== 'ABSENT') {
             statusColor = log.lateMinutes > 0 ? 'bg-yellow-500' : 'bg-green-500';
             statusText = log.lateMinutes > 0 ? 'Present Late' : 'Present On Time';
          }

          return (
            <div key={user.id} className="rounded-xl border border-[#334155] bg-[#1e293b] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-[#f8fafc] text-lg">{user.fullName}</h3>
                  <span className="text-xs bg-[#334155] text-slate-300 px-2 py-0.5 rounded">{user.role}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                    <span className="text-xs text-slate-300">{statusText}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0f172a] rounded-lg p-3 space-y-2 text-sm text-slate-300 border border-[#334155]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Check In:</span>
                  <span className="font-medium text-[#f8fafc]">
                    {log?.checkInTime ? formatISTTime(log.checkInTime) : 'Not checked in yet'}
                  </span>
                </div>
                {log && log.lateMinutes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Late:</span>
                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-medium text-xs border border-red-500/30">
                      {log.lateMinutes} mins late
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Check Out:</span>
                  <span className="font-medium text-[#f8fafc]">
                    {log?.checkOutTime ? formatISTTime(log.checkOutTime) : (log?.checkInTime ? 'Still working' : '—')}
                  </span>
                </div>
              </div>

              {log?.checkInPhoto && (
                <div className="mt-auto pt-2 border-t border-[#334155]">
                  <button 
                    onClick={() => setSelectedPhoto(log.checkInPhoto || null)}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    <img src={log.checkInPhoto} alt="Thumb" className="w-8 h-8 rounded object-cover border border-[#334155]" />
                    <span className="underline">View Photo</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Check-in Photo">
         {selectedPhoto && <img src={selectedPhoto} alt="Full size" className="max-w-full rounded-lg" />}
      </Modal>
    </div>
  );
}

function HistoryTab({ users }: { users: UserType[] }) {
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [userId, setUserId] = useState<string>('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const end = new Date(year, month, 0);
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      
      let endpoint = `/attendance?startDate=${startDate}&endDate=${endDate}`;
      if (userId !== 'ALL') {
         endpoint += `&userId=${userId}`;
      }
      
      const res = await apiGet<Attendance[]>(endpoint);
      if (res.success) {
         setLogs(res.data.slice(0, 31));
      }
    } catch (err: unknown) {
      toast.error('Failed to load history logs');
    } finally {
      setIsLoading(false);
    }
  }, [month, year, userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportCSV = () => {
    const header = ['Date', 'Name', 'Check In', 'Check Out', 'Late Minutes', 'Status'];
    const rows = logs.map(l => [
      formatISTDate(l.date),
      l.user?.fullName || '—',
      l.checkInTime ? formatISTTime(l.checkInTime) : '—',
      l.checkOutTime ? formatISTTime(l.checkOutTime) : '—',
      `${l.lateMinutes} mins`,
      l.status
    ]);
    
    const csvContent = [header, ...rows].map(e => e.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_history_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employee Filter</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            <option value="ALL">All Employees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={handleExportCSV} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white flex items-center gap-2 hover:bg-[#1d4ed8]">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#334155] bg-[#0f172a] text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Check In</th>
              <th className="px-6 py-4">Check Out</th>
              <th className="px-6 py-4">Late Minutes</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Photo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-[#0f172a]/40 transition-colors">
                <td className="px-6 py-4 font-semibold text-[#f8fafc]">{formatISTDate(log.date)}</td>
                <td className="px-6 py-4 font-medium text-slate-300">{log.user?.fullName || '—'}</td>
                <td className="px-6 py-4 text-slate-300">{formatISTTime(log.checkInTime)}</td>
                <td className="px-6 py-4 text-slate-300">{formatISTTime(log.checkOutTime)}</td>
                <td className="px-6 py-4">
                  {log.lateMinutes > 0 ? (
                    <span className="text-red-400 font-medium">{log.lateMinutes} mins late</span>
                  ) : (
                    <span className="text-slate-400">0 mins</span>
                  )}
                </td>
                <td className="px-6 py-4"><StatusBadge status={log.status} /></td>
                <td className="px-6 py-4 text-center">
                  {log.checkInPhoto ? (
                    <button onClick={() => setSelectedPhoto(log.checkInPhoto || '')} className="inline-flex items-center gap-1 rounded bg-[#0f172a] border border-[#334155] px-2.5 py-1 text-xs text-blue-400 hover:bg-[#2563eb]/10">
                      <ImageIcon size={12} /> Thumbnail
                    </button>
                  ) : <span className="text-slate-500">—</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No records found for selected period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Check-in Photo">
         {selectedPhoto && <img src={selectedPhoto} alt="Full size" className="max-w-full rounded-lg" />}
      </Modal>
    </div>
  );
}

function CircularProgress({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = '#ef4444'; 
  if (score > 85) color = '#22c55e'; 
  else if (score >= 70) color = '#eab308'; 

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="64" cy="64" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#334155]" />
        <circle 
          cx="64" cy="64" r="40" 
          stroke={color} strokeWidth="8" fill="transparent" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[#f8fafc]">{score}</span>
      </div>
    </div>
  );
}

function PerformanceTab({ users }: { users: UserType[] }) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    if (!userId && users.length > 0) {
      setUserId(users[0].id.toString());
    }
  }, [users, userId]);

  const fetchReport = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await apiGet<PerformanceReport[] | PerformanceReport>(`/reports?userId=${userId}&month=${month}&year=${year}`);
      if (res.success) {
         if (Array.isArray(res.data) && res.data.length > 0) {
            setReport(res.data[0]);
         } else if (!Array.isArray(res.data) && res.data) {
            setReport(res.data as PerformanceReport);
         } else {
            setReport(null);
         }
      } else {
        setReport(null);
      }
    } catch (err: unknown) {
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, month, year]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const generateReport = async () => {
    if (!userId) return;
    setIsGenerating(true);
    try {
       const res = await apiPost<PerformanceReport>('/attendance/generate-report', { userId: Number(userId), month, year });
       if (res.success) {
          toast.success('Report generated successfully');
          setReport(res.data);
       }
    } catch(err: unknown) {
       toast.error((err as any).response?.data?.message || 'Failed to generate report');
    } finally {
       setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!report) return;
    try {
      const res = await apiPost<PerformanceReport>(`/reports/${report.id}/approve`);
      if (res.success) {
        toast.success('Report approved');
        setReport({ ...report, ownerApproved: true });
      }
    } catch (err: unknown) {
      toast.error((err as any).response?.data?.message || 'Approval failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employee</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none text-[#f8fafc]">
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading performance data...</div>
      ) : report ? (
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Attendance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0f172a] p-3 rounded-lg border border-[#334155]">
                  <span className="text-sm text-slate-400">Total Present</span>
                  <p className="text-xl font-bold text-green-400">{report.totalPresent}</p>
                </div>
                <div className="bg-[#0f172a] p-3 rounded-lg border border-[#334155]">
                  <span className="text-sm text-slate-400">Total Absent</span>
                  <p className="text-xl font-bold text-red-400">{report.totalAbsent}</p>
                </div>
                <div className="bg-[#0f172a] p-3 rounded-lg border border-[#334155]">
                  <span className="text-sm text-slate-400">Late Days</span>
                  <p className="text-xl font-bold text-yellow-400">{report.totalLateDays}</p>
                </div>
                <div className="bg-[#0f172a] p-3 rounded-lg border border-[#334155]">
                  <span className="text-sm text-slate-400">Late Minutes</span>
                  <p className="text-xl font-bold text-yellow-400">{report.totalLateMinutes} mins</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Discipline Score</h3>
              <div className="flex items-center gap-6 bg-[#0f172a] p-4 rounded-lg border border-[#334155]">
                <CircularProgress score={report.disciplineScore} />
                <div className="text-sm text-slate-400 flex-1">
                  Score is calculated based on timely arrivals, tool handling, and general behavior. A score above 85 is excellent.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Salary Calculation</h3>
              <div className="bg-[#0f172a] p-5 rounded-lg border border-[#334155] space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Base Salary</span>
                  <span className="font-medium">₹{report.baseSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Deductions {report.deductionReason && <span className="text-xs italic">({report.deductionReason})</span>}</span>
                  <span className="font-medium text-red-400">- ₹{report.deductionAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Bonuses {report.bonusReason && <span className="text-xs italic">({report.bonusReason})</span>}</span>
                  <span className="font-medium text-green-400">+ ₹{report.bonusAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-[#334155] pt-3 mt-3 flex justify-between items-center">
                  <span className="text-base font-semibold text-[#f8fafc]">Final Salary</span>
                  <span className="text-2xl font-bold text-[#2563eb]">₹{report.finalSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Approval Status</h3>
              {report.ownerApproved ? (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-lg">
                  <CheckCircle size={20} />
                  <span className="font-semibold">Approved</span>
                </div>
              ) : (
                <button 
                  onClick={handleApprove}
                  className="w-full py-3 rounded-lg bg-yellow-500/20 text-yellow-500 font-semibold border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={18} /> Pending Approval
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center border border-dashed border-[#334155] rounded-xl bg-[#1e293b]/50">
          <FileText className="mx-auto h-12 w-12 text-slate-500 mb-4" />
          <h3 className="text-lg font-medium text-[#f8fafc] mb-2">No Report Found</h3>
          <p className="text-sm text-slate-400 mb-6">There is no performance report generated for the selected month.</p>
          <button 
            onClick={generateReport}
            disabled={isGenerating}
            className="rounded-lg bg-[#2563eb] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      )}
    </div>
  );
}
