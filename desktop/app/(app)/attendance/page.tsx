'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Clock, Calendar, Search, MapPin, Image as ImageIcon, ExternalLink, Info, CheckCircle, Download, FileText
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { apiGet, apiPost, apiPut, apiPatch } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Attendance, User as UserType, PerformanceReport } from '@/types';

type TabType = 'today' | 'history' | 'performance' | 'corrections';

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
        setUsers(((res.data as any).data ?? res.data ?? []).filter((u: any) => u.isActive));
      }
    } catch (err: unknown) {
      console.error('Failed to retrieve users', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="flex-1 overflow-auto p-8 space-y-6">
      <PageHeader
        title="Attendance & Performance"
        subtitle="Manage daily logs, view historical attendance, and generate performance reports"
      />

      <div className="flex gap-6 border-b border-white/5">
        {(['today', 'history', 'performance', 'corrections'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[#0070f3] text-white'
                : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'today' && <TodayTab users={users} />}
      {activeTab === 'history' && <HistoryTab users={users} />}
      {activeTab === 'performance' && <PerformanceTab users={users} />}
      {activeTab === 'corrections' && <CorrectionsTab />}
    </div>
  );
}

function TodayTab({ users }: { users: UserType[] }) {
  const [todayLogs, setTodayLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { user: authUser } = useAuth();
  const isOwnerAdmin = authUser?.role === 'OWNER' || authUser?.role === 'ADMIN';

  const [isMultiDayModalOpen, setIsMultiDayModalOpen] = useState(false);
  const [selectedMultiDayLogId, setSelectedMultiDayLogId] = useState<number | null>(null);
  const [expectedCheckoutDate, setExpectedCheckoutDate] = useState('');

  const handleMarkMultiDay = async () => {
    if (!selectedMultiDayLogId || !expectedCheckoutDate) {
      toast.error('Please select an expected checkout date and time');
      return;
    }
    try {
      const res = await apiPatch(`/attendance/${selectedMultiDayLogId}/set-multiday`, {
        expectedCheckoutDate: new Date(expectedCheckoutDate).toISOString()
      });
      if (res.success) {
        toast.success('Marked as multi-day deployment');
        setIsMultiDayModalOpen(false);
        setSelectedMultiDayLogId(null);
        setExpectedCheckoutDate('');
        fetchTodayLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to mark as multi-day');
    }
  };

  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedExtendLogId, setSelectedExtendLogId] = useState<number | null>(null);
  const [newExpectedCheckoutDate, setNewExpectedCheckoutDate] = useState('');

  const handleExtendDeployment = async () => {
    if (!selectedExtendLogId || !newExpectedCheckoutDate) {
      toast.error('Please select a new expected checkout date and time');
      return;
    }
    try {
      const res = await apiPatch(`/attendance/${selectedExtendLogId}/extend-deployment`, {
        newExpectedCheckoutDate: new Date(newExpectedCheckoutDate).toISOString()
      });
      if (res.success) {
        toast.success('Deployment extended successfully');
        setIsExtendModalOpen(false);
        setSelectedExtendLogId(null);
        setNewExpectedCheckoutDate('');
        fetchTodayLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to extend deployment');
    }
  };

  const fetchTodayLogs = useCallback(async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const res = await apiGet<Attendance[]>(`/attendance?startDate=${todayStr}&endDate=${todayStr}`);
      if (res.success) {
        setTodayLogs((res.data as any).data ?? res.data ?? []);
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
        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#22c55e]/10 text-[#22c55e]">
          Present: {stats.present}
        </div>
        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#f59e0b]/10 text-[#f59e0b]">
          Late: {stats.late}
        </div>
        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#ef4444]/10 text-[#ef4444]">
          Absent: {stats.absent}
        </div>
      </div>

      {isLoading && <div className="text-sm text-[#a1a1aa]">Refreshing live board...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {combined.map(({ user, log }) => {
          let statusColor = 'bg-[#ef4444]';
          let statusText = 'Absent';
          if (log && log.status !== 'ABSENT') {
             statusColor = log.lateMinutes > 0 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]';
             statusText = log.lateMinutes > 0 ? 'Present Late' : 'Present On Time';
          }

          return (
            <div key={user.id} className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white text-base">{user.fullName}</h3>
                  <span className="text-xs text-[#52525b] uppercase tracking-wide">{user.role}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    {log?.isMultiDay && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 mr-1">
                        MULTI-DAY
                      </span>
                    )}
                    {log?.hasCompletedUnlinkedJob && !log?.checkOutTime && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 mr-1 animate-pulse">
                        JOB DONE - OPEN SHIFT
                      </span>
                    )}
                    <div className={`w-2.5 h-2.5 rounded-sm ${statusColor}`} />
                    <span className="text-xs text-[#a1a1aa]">{statusText}</span>
                  </div>
                </div>
              </div>

              <div className="glass-card-compact space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Check In:</span>
                  <span className="text-sm text-white font-medium">
                    {log?.checkInTime ? formatISTTime(log.checkInTime) : 'Not checked in'}
                  </span>
                </div>
                {log && log.lateMinutes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Late:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#ef4444]/10 text-[#ef4444]">
                      {log.lateMinutes} mins late
                    </span>
                  </div>
                )}
                
                {log && log.lunchStartTime && !log.lunchEndTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Lunch:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/10 text-orange-400 animate-pulse border border-orange-500/20">
                      On Lunch
                    </span>
                  </div>
                )}

                {log && log.lunchDurationMins > 0 && log.lunchEndTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Lunch:</span>
                    {log.lunchFlag === 'RED' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-red-500/20 text-red-500 border border-red-500/30">
                        {log.lunchDurationMins}m (Red Flag)
                      </span>
                    ) : log.lunchFlag === 'WARNING' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                        {log.lunchDurationMins}m (Warning)
                      </span>
                    ) : (
                      <span className="text-sm text-[#a1a1aa] font-medium">{log.lunchDurationMins}m</span>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Check Out:</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-white font-medium">
                      {log?.checkOutTime ? formatISTTime(log.checkOutTime) : (log?.checkInTime ? 'Still working' : '—')}
                    </span>
                    {log?.checkoutAuto && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        Auto Checkout
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {log?.checkInPhoto && (
                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                  <button 
                    onClick={() => setSelectedPhoto(log.checkInPhoto || null)}
                    className="flex items-center gap-2 text-[#0070f3] hover:text-[#0060d3] text-sm font-medium transition-colors"
                  >
                    <img src={`http://localhost:3001/api/attendance/photo/${log.checkInPhoto}`} alt="Thumb" className="w-8 h-8 rounded-md object-cover border border-white/5" />
                    <span>View Photo</span>
                  </button>
                  {isOwnerAdmin && !log.checkOutTime && (
                    <>
                      {!log.isMultiDay ? (
                        <button
                          onClick={() => {
                            setSelectedMultiDayLogId(log.id);
                            setIsMultiDayModalOpen(true);
                          }}
                          className="text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-md hover:bg-purple-500/20 transition-colors"
                        >
                          Mark Multi-Day
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedExtendLogId(log.id);
                            // Pre-fill the current expected checkout date if it exists
                            if (log.expectedCheckoutDate) {
                              const dt = new Date(log.expectedCheckoutDate);
                              const tzOffset = dt.getTimezoneOffset() * 60000;
                              const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
                              setNewExpectedCheckoutDate(localISOTime);
                            }
                            setIsExtendModalOpen(true);
                          }}
                          className="text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-md hover:bg-blue-500/20 transition-colors"
                        >
                          Extend
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {isOwnerAdmin && log && !log.checkInPhoto && !log.checkOutTime && (
                <div className="mt-auto pt-4 border-t border-white/5 flex justify-end">
                  {!log.isMultiDay ? (
                    <button
                      onClick={() => {
                        setSelectedMultiDayLogId(log.id);
                        setIsMultiDayModalOpen(true);
                      }}
                      className="text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-md hover:bg-purple-500/20 transition-colors"
                    >
                      Mark Multi-Day
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedExtendLogId(log.id);
                        if (log.expectedCheckoutDate) {
                          const dt = new Date(log.expectedCheckoutDate);
                          const tzOffset = dt.getTimezoneOffset() * 60000;
                          const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
                          setNewExpectedCheckoutDate(localISOTime);
                        }
                        setIsExtendModalOpen(true);
                      }}
                      className="text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-md hover:bg-blue-500/20 transition-colors"
                    >
                      Extend
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Check-in Photo">
         {selectedPhoto && <img src={`http://localhost:3001/api/attendance/photo/${selectedPhoto}`} alt="Full size" className="max-w-full rounded-lg" />}
      </Modal>

      <Modal isOpen={isMultiDayModalOpen} onClose={() => setIsMultiDayModalOpen(false)} title="Mark Multi-Day Deployment">
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1aa]">
            This will mark the shift as a multi-day deployment, preventing standard 16h auto-checkout. The shift will automatically close at the expected return time.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#52525b] uppercase tracking-wider">
              Expected Return Date & Time
            </label>
            <input
              type="datetime-local"
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#3a3a3a]"
              value={expectedCheckoutDate}
              onChange={(e) => setExpectedCheckoutDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsMultiDayModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#27272a] hover:bg-[#3f3f46] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkMultiDay}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isExtendModalOpen} onClose={() => setIsExtendModalOpen(false)} title="Extend Multi-Day Deployment">
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1aa]">
            Select a new expected return date and time. It must be after the current expected return time.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#52525b] uppercase">New Expected Return Time</label>
            <input
              type="datetime-local"
              className="input w-full bg-[#18181b] border-[#27272a] focus:border-[#3b82f6] text-white"
              value={newExpectedCheckoutDate}
              onChange={(e) => setNewExpectedCheckoutDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsExtendModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#27272a] hover:bg-[#3f3f46] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExtendDeployment}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Extend Deployment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CorrectionsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [correctedTime, setCorrectedTime] = useState('');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiGet<any[]>('/attendance/correction-requests?status=PENDING');
      if (res.success) {
        setRequests((res.data as any).data ?? res.data ?? []);
      }
    } catch (err) {
      toast.error('Failed to load corrections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openModal = (req: any, type: 'APPROVE' | 'REJECT') => {
    setSelectedReq(req);
    setActionType(type);
    setReviewNote('');
    
    if (req.requestedTime) {
      const d = new Date(req.requestedTime);
      setCorrectedTime(d.toISOString().slice(0, 16)); 
    } else {
      setCorrectedTime('');
    }
  };

  const handleProcess = async () => {
    if (!selectedReq || !actionType) return;
    if (actionType === 'REJECT' && !reviewNote) {
      toast.error('Review note is required for rejection');
      return;
    }
    
    setIsProcessing(true);
    try {
      const endpoint = `/attendance/correction-requests/${selectedReq.id}/${actionType.toLowerCase()}`;
      const payload: any = { reviewNote };
      if (actionType === 'APPROVE' && correctedTime) {
        payload.correctedTime = new Date(correctedTime).toISOString();
      }
      
      const res = await apiPut(endpoint, payload);
      if (res.success) {
        toast.success(`Request ${actionType.toLowerCase()}d successfully`);
        setSelectedReq(null);
        fetchRequests();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process request');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${requests.length > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
        <Info size={20} className={requests.length > 0 ? 'text-orange-400' : 'text-emerald-400'} />
        <span className={`font-semibold ${requests.length > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
          {requests.length > 0 ? `${requests.length} pending requests` : 'All corrections resolved'}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Submitted At</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Employee</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Reason</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Requested Time</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f1f]">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatISTDate(req.createdAt)} {formatISTTime(req.createdAt)}</td>
                <td className="px-4 py-3 text-sm font-medium text-white">{req.user?.fullName}</td>
                <td className="px-4 py-3 text-sm text-blue-400 font-semibold text-xs tracking-wider">
                  {req.requestType.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 text-sm text-[#a1a1aa] max-w-xs truncate" title={req.reason}>{req.reason}</td>
                <td className="px-4 py-3 text-sm text-white font-medium">{formatISTTime(req.requestedTime)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openModal(req, 'APPROVE')} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-md text-xs font-bold transition">Approve</button>
                    <button onClick={() => openModal(req, 'REJECT')} className="px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md text-xs font-bold transition">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#52525b]">No pending correction requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedReq} onClose={() => setSelectedReq(null)} title={`${actionType === 'APPROVE' ? 'Approve' : 'Reject'} Correction`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5">
            <span className="text-slate-500 font-bold uppercase text-xs block mb-1">Reason:</span>
            {selectedReq?.reason}
          </p>
          
          {actionType === 'APPROVE' && selectedReq?.requestType !== 'UNDO_CHECKOUT' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#a1a1aa] block">Corrected Time</label>
              <input 
                type="datetime-local" 
                value={correctedTime}
                onChange={(e) => setCorrectedTime(e.target.value)}
                className="input w-full"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a1a1aa] block">Review Note {actionType === 'REJECT' && <span className="text-red-400">*</span>}</label>
            <textarea 
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              className="input w-full h-20 resize-none"
              placeholder={actionType === 'REJECT' ? "Reason for rejection is required" : "Optional note"}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button onClick={() => setSelectedReq(null)} className="btn btn-secondary">Cancel</button>
            <button 
              onClick={handleProcess} 
              disabled={isProcessing || (actionType === 'REJECT' && !reviewNote)}
              className={`btn ${actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
            >
              {isProcessing ? 'Processing...' : `Confirm ${actionType === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
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
         setLogs(((res.data as any).data ?? res.data ?? []).slice(0, 31));
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

  const inputClasses = "input";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end glass-card-compact">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium text-[#a1a1aa] block">Employee Filter</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className={inputClasses}>
            <option value="ALL">All Employees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-medium text-[#a1a1aa] block">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputClasses}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-medium text-[#a1a1aa] block">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputClasses}>
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={handleExportCSV} className="btn btn-secondary flex items-center gap-2">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Check In</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Check Out</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Late Minutes</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-center">Photo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f1f]">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                <td className="px-4 py-3 text-sm font-medium text-white">{formatISTDate(log.date)}</td>
                <td className="px-4 py-3 text-sm text-[#a1a1aa]">{log.user?.fullName || '—'}</td>
                <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatISTTime(log.checkInTime)}</td>
                <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatISTTime(log.checkOutTime)}</td>
                <td className="px-4 py-3 text-sm">
                  {log.lateMinutes > 0 ? (
                    <span className="text-[#ef4444] font-medium">{log.lateMinutes} mins</span>
                  ) : (
                    <span className="text-[#a1a1aa]">0 mins</span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                <td className="px-4 py-3 text-center">
                  {log.checkInPhoto ? (
                    <button onClick={() => setSelectedPhoto(log.checkInPhoto || '')} className="inline-flex items-center gap-1 rounded bg-transparent border border-white/5 px-2 py-1 text-xs font-medium text-[#a1a1aa] hover:text-white hover:border-[#3a3a3a] transition-colors">
                      <ImageIcon size={12} /> View
                    </button>
                  ) : <span className="text-[#52525b] text-sm">—</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#52525b]">No records found for selected period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Check-in Photo">
         {selectedPhoto && <img src={`http://localhost:3001/api/attendance/photo/${selectedPhoto}`} alt="Full size" className="max-w-full rounded-lg" />}
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
  else if (score >= 70) color = '#f59e0b'; 

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="64" cy="64" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#2a2a2a]" />
        <circle 
          cx="64" cy="64" r="40" 
          stroke={color} strokeWidth="8" fill="transparent" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
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

  const inputClasses = "input";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end glass-card-compact">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium text-[#a1a1aa] block">Employee</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className={inputClasses}>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-medium text-[#a1a1aa] block">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputClasses}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-32">
          <label className="text-xs font-medium text-[#a1a1aa] block">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputClasses}>
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-[#a1a1aa]">Loading performance data...</div>
      ) : report ? (
        <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Attendance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Present</span>
                  <p className="mt-2 text-2xl font-semibold text-[#22c55e]">{report.totalPresent}</p>
                </div>
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Absent</span>
                  <p className="mt-2 text-2xl font-semibold text-[#ef4444]">{report.totalAbsent}</p>
                </div>
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Late Days</span>
                  <p className="mt-2 text-2xl font-semibold text-[#f59e0b]">{report.totalLateDays}</p>
                </div>
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Late Minutes</span>
                  <p className="mt-2 text-2xl font-semibold text-[#f59e0b]">{report.totalLateMinutes} <span className="text-sm">mins</span></p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Discipline Score</h3>
              <div className="flex items-center gap-6 glass-card">
                <CircularProgress score={report.disciplineScore} />
                <div className="text-sm text-[#a1a1aa] flex-1">
                  Score is calculated based on timely arrivals, tool handling, and general behavior. A score above 85 is excellent.
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Lunch Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Red Flags</span>
                  <p className="mt-2 text-2xl font-semibold text-red-500">{report.lunchPenaltyMins > 0 ? '1+' : '0'}</p>
                </div>
                <div className="glass-card-compact">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Penalty Mins</span>
                  <p className="mt-2 text-2xl font-semibold text-orange-400">{report.lunchPenaltyMins || 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#52525b]">Red flags directly deduct from the discipline score. Penalty minutes are added to late minutes for salary deduction.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Salary Calculation</h3>
              <div className="glass-card space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Base Salary</span>
                  <span className="font-medium text-white">₹{report.baseSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Deductions {report.deductionReason && <span className="text-xs italic text-[#52525b] ml-1">({report.deductionReason})</span>}</span>
                  <span className="font-medium text-[#ef4444]">- ₹{report.deductionAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Bonuses {report.bonusReason && <span className="text-xs italic text-[#52525b] ml-1">({report.bonusReason})</span>}</span>
                  <span className="font-medium text-[#22c55e]">+ ₹{report.bonusAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">Final Salary</span>
                  <span className="text-2xl font-semibold text-white">₹{report.finalSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Approval Status</h3>
              {report.ownerApproved ? (
                <div className="flex items-center gap-2 text-[#22c55e] bg-[#22c55e]/10 px-4 py-3 rounded-lg border border-[#22c55e]/20">
                  <CheckCircle size={18} />
                  <span className="text-sm font-medium">Approved</span>
                </div>
              ) : (
                <button 
                  onClick={handleApprove}
                  className="w-full py-3 rounded-lg bg-transparent border border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={16} /> Pending Approval
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center glass-card border-dashed">
          <FileText className="mx-auto h-8 w-8 text-[#52525b] mb-4" />
          <h3 className="text-sm font-medium text-white mb-2">No Report Found</h3>
          <p className="text-sm text-[#a1a1aa] mb-6">There is no performance report generated for the selected month.</p>
          <button 
            onClick={generateReport}
            disabled={isGenerating}
            className="btn btn-primary disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      )}
    </div>
  );
}
