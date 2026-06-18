// app/(app)/jobs/page.tsx
// Job cards board — features pipeline switching, list & kanban grids, assignment modals, and verification controls.
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  List,
  Kanban,
  Search,
  Calendar,
  Clock,
  User,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Edit2,
  Eye,
  Info,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { JobCard, User as UserType, JobStatus, JobType } from '@/types';

// Pipeline steps for the view stepper
const PIPELINE_STEPS: JobStatus[] = [
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
];

export default function JobsPage(): React.JSX.Element {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  // Toggle state between List and Kanban views
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Core Data States
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({
    ASSIGNED: 0,
    EN_ROUTE: 0,
    ARRIVED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    VERIFIED: 0,
    CANCELLED: 0,
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modals Controller
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);

  // Form States
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    siteAddress: '',
    mapsLink: '',
    jobType: 'REPAIR' as JobType,
    assignedToId: '',
    scheduledDate: '',
    scheduledTime: '09:00',
    estimatedDuration: '60',
    equipmentNotes: '',
    notes: '',
  });

  // ─── Fetch Core Data ─────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      let endpoint = '/jobcards';
      const params: string[] = [];

      if (statusFilter !== 'ALL') {
        params.push(`status=${statusFilter}`);
      }
      if (dateFilter) {
        params.push(`date=${dateFilter}`);
      }
      if (searchQuery) {
        params.push(`search=${encodeURIComponent(searchQuery)}`);
      }

      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const res = await apiGet<JobCard[]>(endpoint);
      if (res.success) {
        setJobs(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to retrieve job cards');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, dateFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    if (!isOwnerAdmin) return;
    try {
      const res = await apiGet<Record<string, number>>('/jobcards/stats');
      if (res.success) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Failed to retrieve stats', err);
    }
  }, [isOwnerAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isOwnerAdmin) return;
    try {
      const res = await apiGet<UserType[]>('/users');
      if (res.success) {
        setUsers(res.data.filter((u) => u.isActive));
      }
    } catch (err) {
      console.error('Failed to retrieve team members', err);
    }
  }, [isOwnerAdmin]);

  useEffect(() => {
    fetchJobs();
    fetchStats();
    fetchUsers();
  }, [fetchJobs, fetchStats, fetchUsers]);

  // ─── Verification & Actions ──────────────────────────────────────────────────

  const handleVerify = async (jobId: number) => {
    try {
      const res = await apiPut<JobCard>(`/jobcards/${jobId}/verify`);
      if (res.success) {
        toast.success(res.message);
        fetchJobs();
        fetchStats();
        if (selectedJob?.id === jobId) {
          // Update details modal state if currently open
          const updatedJob = await apiGet<JobCard>(`/jobcards/${jobId}`);
          if (updatedJob.success) {
            setSelectedJob(updatedJob.data);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to verify job card');
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to cancel this job card?')) return;
    try {
      const res = await apiDelete<JobCard>(`/jobcards/${jobId}`);
      if (res.success) {
        toast.success(res.message);
        fetchJobs();
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel job card');
    }
  };

  // ─── Modal Actions ───────────────────────────────────────────────────────────

  const openViewModal = async (job: JobCard) => {
    try {
      const res = await apiGet<JobCard>(`/jobcards/${job.id}`);
      if (res.success) {
        setSelectedJob(res.data);
        setIsViewModalOpen(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load details');
    }
  };

  const openCreateModal = () => {
    setFormMode('create');
    setFormData({
      clientName: '',
      clientPhone: '',
      siteAddress: '',
      mapsLink: '',
      jobType: 'REPAIR',
      assignedToId: '',
      scheduledDate: '',
      scheduledTime: '09:00',
      estimatedDuration: '60',
      equipmentNotes: '',
      notes: '',
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (job: JobCard) => {
    setFormMode('edit');
    const scheduledDateObj = new Date(job.scheduledDate);
    const yyyy = scheduledDateObj.getFullYear();
    const mm = String(scheduledDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(scheduledDateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = scheduledDateObj.toTimeString().substring(0, 5);

    setSelectedJob(job);
    setFormData({
      clientName: job.clientName || '',
      clientPhone: job.clientPhone || '',
      siteAddress: job.siteAddress || '',
      mapsLink: job.mapsLink || '',
      jobType: job.jobType as JobType,
      assignedToId: String(job.assignedToId),
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      estimatedDuration: job.estimatedDuration || '60',
      equipmentNotes: job.equipmentNotes || '',
      notes: job.notes || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.jobType || !formData.assignedToId || !formData.scheduledDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const combinedDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`);

      const payload = {
        ...formData,
        assignedToId: parseInt(formData.assignedToId, 10),
        scheduledDate: combinedDateTime.toISOString(),
      };

      let res;
      if (formMode === 'create') {
        res = await apiPost<JobCard>('/jobcards', payload);
      } else {
        res = await apiPut<JobCard>(`/jobcards/${selectedJob!.id}`, payload);
      }

      if (res.success) {
        toast.success(res.message);
        setIsCreateModalOpen(false);
        fetchJobs();
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit form');
    }
  };

  // ─── Format Helpers ──────────────────────────────────────────────────────────

  const formatIST = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader
        title="Job Cards"
        subtitle="Manage client service jobs, dispatches, and work logs"
        actionLabel={isOwnerAdmin ? 'New Job Card' : undefined}
        onAction={isOwnerAdmin ? openCreateModal : undefined}
      />

      {/* ─── Stats Dashboard Cards (Owner only) ────────────────────────────────── */}
      {isOwnerAdmin && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Assigned', count: stats.ASSIGNED, color: 'text-[#0088ff]', bg: 'bg-[#0088ff]/5 border-[#0088ff]/20 shadow-[0_4px_20px_rgba(0,136,255,0.05)]' },
            { label: 'En Route', count: stats.EN_ROUTE, color: 'text-yellow-400', bg: 'bg-yellow-500/5 border-yellow-500/20 shadow-[0_4px_20px_rgba(234,179,8,0.05)]' },
            { label: 'Arrived', count: stats.ARRIVED, color: 'text-orange-400', bg: 'bg-orange-500/5 border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.05)]' },
            { label: 'In Progress', count: stats.IN_PROGRESS, color: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/20 shadow-[0_4px_20px_rgba(168,85,247,0.05)]' },
            { label: 'Completed', count: stats.COMPLETED, color: 'text-[#00e676]', bg: 'bg-[#00e676]/5 border-[#00e676]/20 shadow-[0_4px_20px_rgba(0,230,118,0.05)]' },
            { label: 'Verified', count: stats.VERIFIED, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.05)]' },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg backdrop-blur-md ${item.bg}`}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {item.label}
              </p>
              <p className={`text-4xl font-black ${item.color}`}>{item.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Control Bar ───────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#121826]/80 backdrop-blur-md p-4 shadow-lg md:flex-row md:items-center md:justify-between">
        {/* Left: Search & Filters */}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client or site address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#090d14]/50 py-2.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-500 outline-none transition-all focus:border-[#0088ff] focus:ring-1 focus:ring-[#0088ff]"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#090d14]/50 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-[#0088ff] focus:ring-1 focus:ring-[#0088ff]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="EN_ROUTE">En Route</option>
            <option value="ARRIVED">Arrived</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="VERIFIED">Verified</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#090d14]/50 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-[#0088ff] focus:ring-1 focus:ring-[#0088ff] [color-scheme:dark]"
          />
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex items-center gap-2 border-t border-white/10 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'list'
                ? 'bg-[#0088ff] text-white shadow-[0_0_15px_rgba(0,136,255,0.4)]'
                : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <List size={16} />
            List
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'kanban'
                ? 'bg-[#0088ff] text-white shadow-[0_0_15px_rgba(0,136,255,0.4)]'
                : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Kanban size={16} />
            Kanban
          </button>
        </div>
      </div>

      {/* ─── List View ─────────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#121826]/80 backdrop-blur-md shadow-lg">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-bold tracking-wider text-slate-500 uppercase">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold tracking-wider text-slate-500 uppercase">No job cards found</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-[#090d14]/50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <th className="px-8 py-5">Job Number</th>
                  <th className="px-8 py-5">Client Name</th>
                  <th className="px-8 py-5">Site Address</th>
                  <th className="px-8 py-5">Job Type</th>
                  <th className="px-8 py-5">Assigned To</th>
                  <th className="px-8 py-5">Scheduled Date</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job) => (
                  <tr key={job.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 font-black text-[#0088ff]">{job.jobNumber}</td>
                    <td className="px-8 py-5 font-bold text-white">{job.clientName}</td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-400 max-w-[200px] truncate">
                      {job.siteAddress || '—'}
                    </td>
                    <td className="px-8 py-5">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-white/10 text-slate-300">
                        {job.jobType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-300">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-500" />
                        {job.assignedTo?.fullName || '—'}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-400">{formatIST(job.scheduledDate)}</td>
                    <td className="px-8 py-5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openViewModal(job)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#090d14] border border-white/5 text-slate-400 transition-all hover:bg-[#0088ff] hover:text-white hover:border-[#0088ff] hover:shadow-[0_0_15px_rgba(0,136,255,0.4)]"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {isOwnerAdmin && (
                          <>
                            <button
                              onClick={() => openEditModal(job)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#090d14] border border-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            {job.status === 'COMPLETED' && (
                              <button
                                onClick={() => handleVerify(job.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#090d14] border border-white/5 text-slate-400 transition-all hover:bg-[#00e676] hover:text-[#090d14] hover:border-[#00e676] hover:shadow-[0_0_15px_rgba(0,230,118,0.4)]"
                                title="Verify Completed Work"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            {job.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleDelete(job.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#090d14] border border-white/5 text-slate-400 transition-all hover:bg-[#ff3366] hover:text-white hover:border-[#ff3366] hover:shadow-[0_0_15px_rgba(255,51,102,0.4)]"
                                title="Cancel Job"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Kanban View ─────────────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {/* TODO: Add HTML5 Drag-and-drop context handlers here */}
          {[
            { status: 'ASSIGNED', title: 'Assigned', color: 'bg-[#0088ff]/5 border-[#0088ff]/20', accent: 'text-[#0088ff]' },
            { status: 'EN_ROUTE', title: 'En Route', color: 'bg-yellow-500/5 border-yellow-500/20', accent: 'text-yellow-400' },
            { status: 'IN_PROGRESS', title: 'In Progress', color: 'bg-purple-500/5 border-purple-500/20', accent: 'text-purple-400' },
            { status: 'COMPLETED', title: 'Completed', color: 'bg-[#00e676]/5 border-[#00e676]/20', accent: 'text-[#00e676]' },
            { status: 'VERIFIED', title: 'Verified', color: 'bg-emerald-500/5 border-emerald-500/20', accent: 'text-emerald-400' },
            { status: 'CANCELLED', title: 'Cancelled', color: 'bg-[#ff3366]/5 border-[#ff3366]/20', accent: 'text-[#ff3366]' },
          ].map((column) => {
            const columnJobs = jobs.filter((j) => j.status === column.status);
            return (
              <div
                key={column.status}
                className={`rounded-2xl border backdrop-blur-md p-4 flex flex-col min-h-[500px] shadow-lg ${column.color}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${column.accent}`}>
                    {column.title}
                  </span>
                  <span className="flex h-5 items-center justify-center rounded-full bg-white/5 px-2 text-[10px] font-black text-white border border-white/10">
                    {columnJobs.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
                  {columnJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => openViewModal(job)}
                      className="group cursor-pointer rounded-xl border border-white/5 bg-[#121826]/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-white/20"
                    >
                      <span className="text-[10px] font-black tracking-widest text-[#0088ff]">{job.jobNumber}</span>
                      <p className="mt-1 font-bold text-white text-sm line-clamp-2">
                        {job.clientName}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-slate-400 text-xs font-semibold">
                        <User size={12} className="text-slate-500 group-hover:text-white transition-colors" />
                        <span className="truncate">{job.assignedTo?.fullName || 'Unassigned'}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-slate-400 text-xs font-semibold">
                        <Calendar size={12} className="text-slate-500 group-hover:text-white transition-colors" />
                        <span>{new Date(job.scheduledDate).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={formMode === 'create' ? 'Create Job Card' : 'Edit Job Card'}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Client Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Client Phone
              </label>
              <input
                type="text"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Site Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Site Address
              </label>
              <input
                type="text"
                value={formData.siteAddress}
                onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Maps Link */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Google Maps Link
              </label>
              <input
                type="text"
                value={formData.mapsLink}
                onChange={(e) => setFormData({ ...formData, mapsLink: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Job Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Job Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as JobType })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              >
                <option value="NEW_INSTALL">New Installation</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="REPAIR">Repair</option>
                <option value="QUOTATION_VISIT">Quotation Visit</option>
              </select>
            </div>

            {/* Assign To */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.assignedToId}
                onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              >
                <option value="">Select Employee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Scheduled Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Scheduled Time
              </label>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Estimated Duration (minutes) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Est. Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Equipment Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Equipment Notes
              </label>
              <textarea
                rows={2}
                value={formData.equipmentNotes}
                onChange={(e) => setFormData({ ...formData, equipmentNotes: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                General Notes
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] placeholder-slate-500 outline-none focus:border-[#2563eb]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#334155] pt-4">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-lg border border-[#334155] bg-transparent px-4 py-2 text-sm font-semibold text-[#94a3b8] transition-colors hover:bg-[#0f172a] hover:text-[#f8fafc]"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
              {formMode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── View Details Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedJob ? `Job Card Details: ${selectedJob.jobNumber}` : 'Job Details'}
        size="lg"
      >
        {selectedJob && (
          <div className="space-y-6">
            {/* ── Stepper Pipeline ── */}
            <div>
              <p className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Pipeline Progress
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0f172a] p-4 border border-[#334155]">
                {PIPELINE_STEPS.map((step, idx) => {
                  const currentIdx = PIPELINE_STEPS.indexOf(selectedJob.status as JobStatus);
                  const isCompleted = idx < currentIdx;
                  const isActive = step === selectedJob.status;

                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                            isActive
                              ? 'bg-[#2563eb] text-white ring-4 ring-[#2563eb]/20'
                              : isCompleted
                              ? 'bg-green-600 text-white'
                              : 'bg-[#1e293b] text-[#94a3b8] border border-[#334155]'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span
                          className={`mt-1.5 text-[10px] font-semibold tracking-wide uppercase ${
                            isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'
                          }`}
                        >
                          {step.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 min-w-[20px] transition-colors ${
                            idx < currentIdx ? 'bg-green-600' : 'bg-[#334155]'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* ── Grid Details ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Client Info */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/40 p-4">
                <span className="block text-xs font-semibold text-[#2563eb] uppercase tracking-wider mb-2">
                  Client Information
                </span>
                <p className="text-base font-bold text-white">{selectedJob.clientName}</p>
                {selectedJob.clientPhone && (
                  <p className="text-sm text-slate-400 mt-1">Phone: {selectedJob.clientPhone}</p>
                )}
                {selectedJob.siteAddress && (
                  <p className="text-sm text-slate-300 mt-2 flex gap-1.5">
                    <MapPin size={16} className="text-[#94a3b8] flex-shrink-0" />
                    <span>{selectedJob.siteAddress}</span>
                  </p>
                )}
                {selectedJob.mapsLink && (
                  <a
                    href={selectedJob.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:underline"
                  >
                    Open in Google Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Assignment Details */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/40 p-4">
                <span className="block text-xs font-semibold text-[#2563eb] uppercase tracking-wider mb-2">
                  Job Schedule & Assignment
                </span>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <User size={16} className="text-[#94a3b8]" />
                    <span>Assigned to: {selectedJob.assignedTo?.fullName || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar size={16} className="text-[#94a3b8]" />
                    <span>Scheduled: {formatIST(selectedJob.scheduledDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock size={16} className="text-[#94a3b8]" />
                    <span>Duration: {selectedJob.estimatedDuration || '—'} minutes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Summary & Notes ── */}
            {(selectedJob.equipmentNotes || selectedJob.notes || selectedJob.workSummary) && (
              <div className="space-y-3 rounded-lg border border-[#334155] bg-[#0f172a]/40 p-4">
                {selectedJob.equipmentNotes && (
                  <div>
                    <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider block">
                      Equipment Notes
                    </span>
                    <p className="text-sm text-slate-200 mt-0.5">{selectedJob.equipmentNotes}</p>
                  </div>
                )}
                {selectedJob.notes && (
                  <div>
                    <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider block">
                      General Notes
                    </span>
                    <p className="text-sm text-slate-200 mt-0.5">{selectedJob.notes}</p>
                  </div>
                )}
                {selectedJob.workSummary && (
                  <div className="border-t border-[#334155] pt-2.5 mt-2.5">
                    <span className="text-xs font-semibold text-green-400 uppercase tracking-wider block">
                      Work Completion Summary
                    </span>
                    <p className="text-sm text-slate-200 mt-0.5">{selectedJob.workSummary}</p>
                    {selectedJob.issuesFound && (
                      <p className="text-sm text-red-400 mt-1">
                        <strong>Issues Found:</strong> {selectedJob.issuesFound}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Site Visit History ── */}
            <div>
              <p className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                On-Site Visit History
              </p>
              {selectedJob.siteVisits && selectedJob.siteVisits.length > 0 ? (
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {selectedJob.siteVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex items-center justify-between rounded-lg bg-[#0f172a] px-4 py-2 border border-[#334155] text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">Arrived at site</span>
                        <span className="text-slate-400 mt-0.5">{formatIST(visit.arrivedAt)}</span>
                      </div>
                      {visit.arrivedLat && visit.arrivedLng && (
                        <span className="text-slate-400">
                          Lat: {visit.arrivedLat.toFixed(5)}, Lng: {visit.arrivedLng.toFixed(5)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-[#0f172a] p-3 text-center text-xs text-slate-500 border border-[#334155]">
                  No site arrival logs found
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 border-t border-[#334155] pt-4">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="rounded-lg border border-[#334155] bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#0f172a] hover:text-[#f8fafc]"
              >
                Close
              </button>
              {isOwnerAdmin && selectedJob.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => {
                    handleVerify(selectedJob.id);
                    setIsViewModalOpen(false);
                  }}
                  className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
                >
                  Verify Completed Work
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
