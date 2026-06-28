// app/(app)/jobs/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  List,
  Search,
  Plus,
  Filter,
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
  X,
  UserPlus,
  ShieldAlert,
  ArrowRight,
  Activity,
  Zap,
  Play,
  CheckCircle,
  Package
} from 'lucide-react';
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

function InlineBadge({ status }: { status: string }) {
  let bg = 'glass-panel';
  let text = 'text-[#a1a1aa]';

  switch (status) {
    case 'UNASSIGNED':
      bg = 'bg-[#52525b]/10'; text = 'text-[#a1a1aa]'; break;
    case 'ASSIGNED':
      bg = 'bg-[#0070f3]/10'; text = 'text-[#0070f3]'; break;
    case 'EN_ROUTE':
    case 'ARRIVED':
    case 'IN_PROGRESS':
      bg = 'bg-[#f59e0b]/10'; text = 'text-[#f59e0b]'; break;
    case 'COMPLETED':
    case 'VERIFIED':
      bg = 'bg-[#22c55e]/10'; text = 'text-[#22c55e]'; break;
    case 'CANCELLED':
      bg = 'bg-[#ef4444]/10'; text = 'text-[#ef4444]'; break;
    case 'OVERDUE':
      bg = 'bg-[#f59e0b]/20 border border-[#f59e0b]/30 animate-pulse'; text = 'text-[#f59e0b] font-bold'; break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${bg} ${text}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function JobsPage(): React.JSX.Element {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  // Core Data States
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
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
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [verifyModalJobId, setVerifyModalJobId] = useState<number | null>(null);
  const [qualityRating, setQualityRating] = useState<'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'POOR' | 'NOT_DONE'>('SATISFACTORY');
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);

  // Form States
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    siteAddress: '',
    mapsLink: '',
    jobType: 'REPAIR' as JobType,
    assignedEmployeeIds: [] as string[],
    requiredTools: [] as string[],
    requiredMaterials: [] as { productId: string; quantity: string }[],
    scheduledDate: '',
    scheduledTime: '09:00',
    estimatedDuration: '60',
    equipmentNotes: '',
    notes: '',
  });
  const [reassignForm, setReassignForm] = useState({ jobId: 0, assignedEmployeeIds: [] as string[] });

  // Job Requests
  const [jobRequests, setJobRequests] = useState<any[]>([]);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Verify-return inline picker state
  const [verifyReturnState, setVerifyReturnState] = useState<{
    issuanceId: number;
    condition: 'GOOD' | 'DAMAGED' | 'MISSING';
    note: string;
  } | null>(null);

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

      const res = await apiGet<{ data: JobCard[] }>(endpoint);
      if (res.success) {
        setJobs(res.data.data ?? []);
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
      const res = await apiGet<{ data: UserType[] }>('/users');
      if (res.success) {
        setUsers((res.data.data ?? []).filter((u: any) => u.isActive));
      }
    } catch (err) {
      console.error('Failed to retrieve team members', err);
    }
  }, [isOwnerAdmin]);

  const fetchJobRequests = useCallback(async () => {
    if (!isOwnerAdmin) return;
    try {
      const res = await apiGet<{ data: any[] }>('/jobcards/requests');
      if (res.success) {
        setJobRequests(res.data.data ?? []);
      }
    } catch (err) {
      console.error('Failed to retrieve job requests', err);
    }
  }, [isOwnerAdmin]);

  useEffect(() => {
    fetchJobs();
    fetchStats();
    fetchUsers();
    fetchJobRequests();

    if (isOwnerAdmin) {
      apiGet<any[]>('/tools').then(res => {
        if (res.success) setTools((res.data as any).data ?? res.data);
      });
      apiGet<any[]>('/materials').then(res => {
        if (res.success) setMaterials((res.data as any).data ?? res.data);
      });
    }
  }, [fetchJobs, fetchStats, fetchUsers, fetchJobRequests, isOwnerAdmin]);

  // ─── Verification & Actions ──────────────────────────────────────────────────

  const handleVerify = (jobId: number) => {
    setVerifyModalJobId(jobId);
    setQualityRating('SATISFACTORY');
  };

  const submitVerify = async () => {
    if (!verifyModalJobId) return;
    try {
      const res = await apiPut<JobCard>(`/jobcards/${verifyModalJobId}/verify`, { qualityRating });
      if (res.success) {
        toast.success(res.message);
        setVerifyModalJobId(null);
        fetchJobs();
        fetchStats();
        if (selectedJob?.id === verifyModalJobId) {
          const updatedJob = await apiGet<JobCard>(`/jobcards/${verifyModalJobId}`);
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

  const handleSwapTool = async (oldToolId: string) => {
    try {
      const res = await apiGet<any[]>(`/tools/${oldToolId}/alternatives`);
      if (res.success && res.data && res.data.length > 0) {
        const altTool = res.data[0];
        setFormData(prev => ({
          ...prev,
          requiredTools: prev.requiredTools.map(id => id === oldToolId ? String(altTool.id) : id)
        }));
        toast.success(`Swapped to ${altTool.name} (${altTool.toolCode})`);
      } else {
        toast.error('No available alternatives found in the same category.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch alternatives');
    }
  };

  const handleForceReturnTool = async (toolId: string) => {
    if (!confirm('Force return this tool to the warehouse? This will unassign it from its current holder.')) return;
    try {
      const res = await apiPut(`/tools/${toolId}/force-return`);
      if ((res as any).success) {
        toast.success('Tool forcefully returned');
        // Refresh the tools list to update the holder status
        const toolsRes = await apiGet<any[]>('/tools');
        if (toolsRes.success) setTools((toolsRes.data as any).data ?? toolsRes.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to force return tool');
    }
  };

  // ─── Modal Actions ───────────────────────────────────────────────────────────

  const handleAddonResponse = async (addonId: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await apiPut(`/addons/${addonId}/respond`, { status });
      if (res.success) {
        toast.success(`Addon request ${status.toLowerCase()}`);
        // refresh the jobcard
        if (selectedJob) {
          const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob.id}`);
          if (updatedJob.success) {
            setSelectedJob(updatedJob.data);
            fetchJobs();
          }
        }
      } else {
        toast.error(res.message || 'Failed to respond to addon request');
      }
    } catch (e: any) {
      toast.error('Network error');
    }
  };

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
      assignedEmployeeIds: [] as string[],
      requiredTools: [] as string[],
      requiredMaterials: [] as { productId: string; quantity: string }[],
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
      assignedEmployeeIds: job.assignedEmployees ? job.assignedEmployees.map(e => String(e.id)) : [],
      requiredTools: job.requiredTools ? job.requiredTools.map((t: any) => String(t.toolId)) : [],
      requiredMaterials: job.requiredMaterials ? job.requiredMaterials.map((m: any) => ({ productId: String(m.productId), quantity: String(m.quantity) })) : [],
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      estimatedDuration: job.estimatedDuration || '60',
      equipmentNotes: job.equipmentNotes || '',
      notes: job.notes || '',
    });
    setIsCreateModalOpen(true);
  };

  const openReassignModal = (job: JobCard) => {
    setReassignForm({ jobId: job.id, assignedEmployeeIds: job.assignedEmployees ? job.assignedEmployees.map(e => String(e.id)) : [] });
    setIsReassignModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.jobType || !formData.scheduledDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const combinedDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`);

      const payload = {
        ...formData,
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

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reassignForm.assignedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }
    try {
      const res = await apiPut<JobCard>(`/jobcards/${reassignForm.jobId}`, {
        assignedEmployeeIds: reassignForm.assignedEmployeeIds,
      });
      if (res.success) {
        toast.success('Job reassigned successfully');
        setIsReassignModalOpen(false);
        fetchJobs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reassign job');
    }
  };

  const handleApproveJobRequest = async (requestId: number, approve: boolean, isAssignment: boolean = false) => {
    try {
      const res = await apiPut(`/jobcards/requests/${requestId}/approve`, { approve });
      if (res.success) {
        toast.success(approve ? (isAssignment ? 'Request approved. Job assigned.' : 'Request approved. Employee unassigned.') : 'Request declined.');
        fetchJobRequests();
        fetchJobs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process request');
    }
  };

  const handleToggleRequiresTools = async () => {
    if (!selectedJob) return;
    try {
      const res = await apiPut<JobCard>(`/jobcards/${selectedJob.id}/no-tools`);
      if (res.success) {
        toast.success(res.message);
        const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob.id}`);
        if (updatedJob.success) setSelectedJob(updatedJob.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update tools requirement');
    }
  };

  const handleApproveTool = async (issuanceId: number) => {
    try {
      const res = await apiPut(`/tools/issuances/${issuanceId}/approve`);
      if (res.success) {
        toast.success('Tool issuance approved');
        const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob!.id}`);
        if (updatedJob.success) setSelectedJob(updatedJob.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve tool');
    }
  };

  const handleApproveMaterial = async (usageId: number) => {
    try {
      const res = await apiPut(`/materials/usage/${usageId}/approve`);
      if (res.success) {
        toast.success('Material usage approved');
        const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob!.id}`);
        if (updatedJob.success) setSelectedJob(updatedJob.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve material');
    }
  };

  const handleVerifyToolReturn = async (issuanceId: number, condition: 'GOOD' | 'DAMAGED' | 'MISSING', note: string) => {
    try {
      const res = await apiPut(`/tools/issuances/${issuanceId}/verify-return`, { condition, adminNote: note || undefined });
      if (res.success) {
        const msg = condition === 'GOOD' ? 'Tool return verified ✓' :
                    condition === 'DAMAGED' ? 'Return verified — damage recorded & discipline score updated' :
                    'Return verified — tool marked MISSING & discipline score updated';
        toast.success(msg);
        setVerifyReturnState(null);
        const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob!.id}`);
        if (updatedJob.success) setSelectedJob(updatedJob.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to verify tool return');
    }
  };

  const handleReviewMaterial = async (usageId: number) => {
    try {
      const res = await apiPut(`/materials/usage/${usageId}/review`);
      if (res.success) {
        toast.success('Material usage reviewed');
        const updatedJob = await apiGet<JobCard>(`/jobcards/${selectedJob!.id}`);
        if (updatedJob.success) setSelectedJob(updatedJob.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review material usage');
    }
  };

  const formatIST = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#0a0e14]">
      {/* ─── Page Header ───────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Job Cards</h1>
          <p className="mt-1 text-sm text-[#a1a1aa]">Manage client service jobs, dispatches, and work logs</p>
        </div>
        {isOwnerAdmin && (
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            New Job Card
          </button>
        )}
      </div>

      {/* ─── Stats Dashboard Cards (Owner only) (4 Cards) ──────── */}
      {isOwnerAdmin && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active', count: stats.ASSIGNED + stats.EN_ROUTE + stats.ARRIVED + stats.IN_PROGRESS },
            { label: 'Completed', count: stats.COMPLETED },
            { label: 'Verified', count: stats.VERIFIED },
            { label: 'Cancelled', count: stats.CANCELLED },
          ].map((item) => (
            <div
              key={item.label}
              className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200 flex flex-col justify-between h-32"
            >
              <div className="mt-4">
                <p className="text-2xl font-semibold text-white">{item.count}</p>
                <p className="text-sm text-[#a1a1aa]">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pending Job Requests ──────────────────────────────── */}
      {isOwnerAdmin && jobRequests.length > 0 && (
        <div className="mb-6 glass-card border-[#f59e0b]/30">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#f59e0b]/5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-[#f59e0b]" size={18} />
              <h3 className="font-medium text-white">Pending Job Reassignment Requests</h3>
            </div>
            <span className="text-xs bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-1 rounded-full font-bold">
              {jobRequests.length} pending
            </span>
          </div>
          <div className="divide-y divide-[#1f1f1f]">
            {jobRequests.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors">
                <div>
                  <p className="text-sm text-white font-medium mb-1">
                    Job: {req.jobCard?.jobNumber} - {req.jobCard?.clientName}
                  </p>
                  <p className="text-sm text-[#a1a1aa] mb-1">Requested by: {req.requestedBy?.fullName}</p>
                  <p className="text-sm text-[#ef4444] italic">Reason: {req.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveJobRequest(req.id, false, !!req.requestedJobId)}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleApproveJobRequest(req.id, true, !!req.requestedJobId)}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {req.requestedJobId ? 'Approve Assignment' : 'Acknowledge & Unassign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Control Bar ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
          <input
            type="text"
            placeholder="Search by client or site address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="ALL">All Statuses</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="EN_ROUTE">En Route</option>
          <option value="ARRIVED">Arrived</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="VERIFIED">Verified</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input [color-scheme:dark]"
        />
      </div>

      {/* ─── List View ─────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm font-medium text-[#52525b] uppercase tracking-wider">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-sm font-medium text-[#52525b] uppercase tracking-wider">No job cards found</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Job Number</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Client Name</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Site Address</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Job Type</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Assigned To</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Scheduled Date</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                  <td className="text-sm text-white font-medium px-4 py-3">{job.jobNumber}</td>
                  <td className="text-sm text-white px-4 py-3">{job.clientName}</td>
                  <td className="text-sm text-[#a1a1aa] px-4 py-3 max-w-[200px] truncate">
                    {job.siteAddress || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium glass-card-compact !p-1 text-[#a1a1aa]">
                      {job.jobType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-sm text-[#a1a1aa] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-[#52525b]" />
                      {job.assignedEmployees && job.assignedEmployees.length > 0
                        ? job.assignedEmployees.map(e => e.fullName).join(', ')
                        : 'Unassigned'}
                    </div>
                  </td>
                  <td className="text-sm text-[#a1a1aa] px-4 py-3">{formatIST(job.scheduledDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InlineBadge status={job.status} />
                      {job.isOverdue && job.status !== 'COMPLETED' && job.status !== 'VERIFIED' && (
                        <InlineBadge status="OVERDUE" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openViewModal(job)}
                        className="text-[#a1a1aa] hover:text-white transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {isOwnerAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(job)}
                            className="text-[#a1a1aa] hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          {job.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleVerify(job.id)}
                              className="text-[#a1a1aa] hover:text-[#22c55e] transition-colors"
                              title="Verify Completed Work"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          {['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(job.status) && (
                            <button
                              onClick={() => openReassignModal(job)}
                              className="text-[#a1a1aa] hover:text-[#0070f3] transition-colors"
                              title="Reassign Job"
                            >
                              <UserPlus size={16} />
                            </button>
                          )}
                          {job.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleDelete(job.id)}
                              className="text-[#a1a1aa] hover:text-[#ef4444] transition-colors"
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

      {/* ─── Create/Edit Modal ─────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {formMode === 'create' ? 'Create Job Card' : 'Edit Job Card'}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#52525b] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Client Phone</label>
                  <input
                    type="text"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Site Address</label>
                  <input
                    type="text"
                    value={formData.siteAddress}
                    onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Google Maps Link</label>
                  <input
                    type="text"
                    value={formData.mapsLink}
                    onChange={(e) => setFormData({ ...formData, mapsLink: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Job Type *</label>
                  <select
                    required
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value as JobType })}
                    className="input"
                  >
                    <option value="NEW_INSTALL">New Installation</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="REPAIR">Repair</option>
                    <option value="QUOTATION_VISIT">Quotation Visit</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Assign To</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.assignedEmployeeIds.includes(String(u.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assignedEmployeeIds: [...formData.assignedEmployeeIds, String(u.id)] });
                            } else {
                              setFormData({ ...formData, assignedEmployeeIds: formData.assignedEmployeeIds.filter(id => id !== String(u.id)) });
                            }
                          }}
                          className="rounded border-gray-600 bg-gray-800 text-[#0070f3] focus:ring-[#0070f3]"
                        />
                        <span className="text-sm text-white">{u.fullName} ({u.role.replace('_', ' ')})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Required Tools</label>
                  <select
                    className="input mb-3"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const tid = e.target.value;
                      if (!formData.requiredTools.includes(tid)) {
                        setFormData({ ...formData, requiredTools: [...formData.requiredTools, tid] });
                      }
                    }}
                  >
                    <option value="">Select a tool to add...</option>
                    {tools.map(t => (
                      <option key={t.id} value={t.id} disabled={formData.requiredTools.includes(String(t.id))}>
                        {t.name} ({t.toolCode})
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-2">
                    {formData.requiredTools.map(rt => {
                      const tool = tools.find(t => String(t.id) === rt);
                      if (!tool) return null;
                      
                      const isHeld = tool.currentHolderId !== null;
                      const holder = isHeld ? users.find(u => u.id === tool.currentHolderId) : null;

                      return (
                        <div key={rt} className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-medium">{tool.name} <span className="text-xs text-[#a1a1aa]">({tool.toolCode})</span></span>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, requiredTools: formData.requiredTools.filter(t => t !== rt) })}
                              className="text-xs font-medium text-red-500 hover:text-red-400 shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                          {isHeld && (
                            <div className="flex items-center justify-between bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded p-1.5 px-2">
                              <span className="text-xs font-medium text-[#f59e0b]">
                                ⚠ Held by {holder?.fullName || 'another employee'}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleForceReturnTool(rt)}
                                  className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 px-2 py-1 rounded transition-colors"
                                  title="Force return this tool to the warehouse so it can be assigned here"
                                >
                                  Force Return
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSwapTool(rt)}
                                  className="text-xs font-semibold text-[#f59e0b] bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 px-2 py-1 rounded transition-colors"
                                >
                                  Swap
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Required Inventories (Materials)</label>
                  <select
                    className="input mb-3"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const mid = e.target.value;
                      if (!formData.requiredMaterials.some(rm => rm.productId === mid)) {
                        setFormData({ ...formData, requiredMaterials: [...formData.requiredMaterials, { productId: mid, quantity: '1' }] });
                      }
                    }}
                  >
                    <option value="">Select an inventory item to add...</option>
                    {materials.map(m => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={formData.requiredMaterials.some(rm => rm.productId === String(m.id)) || m.currentStock <= 0}
                      >
                        {m.name} ({m.unit}) — Stock: {m.currentStock}{m.currentStock <= 0 ? ' (Out of stock)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-2">
                    {formData.requiredMaterials.map(rm => {
                      const mat = materials.find(m => String(m.id) === rm.productId);
                      const qty = parseFloat(rm.quantity);
                      const isOverStock = mat && !isNaN(qty) && qty > mat.currentStock;
                      return mat ? (
                        <div
                          key={rm.productId}
                          className={`flex items-center gap-4 p-2 rounded-lg border ${
                            isOverStock
                              ? 'bg-[#ef4444]/5 border-[#ef4444]/30'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-sm text-white font-medium truncate">{mat.name} ({mat.unit})</div>
                            <div className={`text-xs mt-0.5 ${ isOverStock ? 'text-[#ef4444] font-medium' : 'text-[#52525b]' }`}>
                              {isOverStock
                                ? `⚠ Only ${mat.currentStock} in stock`
                                : `Stock: ${mat.currentStock}`
                              }
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={rm.quantity}
                            onChange={(e) => {
                              const newMat = formData.requiredMaterials.map(m => m.productId === rm.productId ? { ...m, quantity: e.target.value } : m);
                              setFormData({ ...formData, requiredMaterials: newMat });
                            }}
                            className={`input !w-20 !py-1 !min-h-0 h-8 text-center shrink-0 ${ isOverStock ? '!border-[#ef4444]/50 !text-[#ef4444]' : '' }`}
                            placeholder="Qty"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, requiredMaterials: formData.requiredMaterials.filter(m => m.productId !== rm.productId) })}
                            className="text-xs font-medium text-red-500 hover:text-red-400 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="input [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Scheduled Time</label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="input [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Est. Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.estimatedDuration}
                    onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Equipment Notes</label>
                  <textarea
                    rows={2}
                    value={formData.equipmentNotes}
                    onChange={(e) => setFormData({ ...formData, equipmentNotes: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">General Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              {/* Stock shortage banner */}
              {(() => {
                const stockShortages = formData.requiredMaterials.filter(rm => {
                  const mat = materials.find((m: any) => String(m.id) === rm.productId);
                  const qty = parseFloat(rm.quantity);
                  return mat && !isNaN(qty) && qty > mat.currentStock;
                });
                if (stockShortages.length === 0) return null;
                return (
                  <div className="mt-4 p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg">
                    <p className="text-xs font-semibold text-[#ef4444] mb-1">⚠ Cannot create job — insufficient stock:</p>
                    <ul className="space-y-0.5">
                      {stockShortages.map(rm => {
                        const mat = materials.find((m: any) => String(m.id) === rm.productId);
                        return mat ? (
                          <li key={rm.productId} className="text-xs text-[#ef4444]/80">
                            • {mat.name}: need {rm.quantity} {mat.unit}, only {mat.currentStock} available
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                );
              })()}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={formData.requiredMaterials.some(rm => {
                    const mat = materials.find((m: any) => String(m.id) === rm.productId);
                    const qty = parseFloat(rm.quantity);
                    return mat && !isNaN(qty) && qty > mat.currentStock;
                  })}
                >
                  {formMode === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Reassign Modal ────────────────────────────────────────────────────── */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Reassign Job</h2>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-[#52525b] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleReassignSubmit}>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Assign To</label>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={reassignForm.assignedEmployeeIds.includes(String(u.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReassignForm({ ...reassignForm, assignedEmployeeIds: [...reassignForm.assignedEmployeeIds, String(u.id)] });
                          } else {
                            setReassignForm({ ...reassignForm, assignedEmployeeIds: reassignForm.assignedEmployeeIds.filter(id => id !== String(u.id)) });
                          }
                        }}
                        className="rounded border-gray-600 bg-gray-800 text-[#0070f3] focus:ring-[#0070f3]"
                      />
                      <span className="text-sm text-white">{u.fullName} ({u.role.replace('_', ' ')})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsReassignModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Reassign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── View Details Modal ────────────────────────────────────────────────── */}
      {isViewModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Job Details: {selectedJob.jobNumber}</h2>
                {selectedJob.isOverdue && selectedJob.status !== 'COMPLETED' && selectedJob.status !== 'VERIFIED' && (
                  <InlineBadge status="OVERDUE" />
                )}
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-[#52525b] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-[#a1a1aa] mb-1.5 block uppercase tracking-wide">Pipeline Progress</p>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0a0e14] p-4 rounded-lg border border-white/5">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const currentIdx = PIPELINE_STEPS.indexOf(selectedJob.status as JobStatus);
                    const isCompleted = idx < currentIdx;
                    const isActive = step === selectedJob.status;
                    return (
                      <React.Fragment key={step}>
                        <div className="flex flex-col items-center">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium ${
                            isActive ? 'bg-[#0070f3] text-white' : isCompleted ? 'bg-[#22c55e] text-white' : 'glass-card-compact text-[#52525b]'
                          }`}>
                            {idx + 1}
                          </div>
                          <span className={`mt-1.5 text-[10px] uppercase font-medium ${isActive ? 'text-[#0070f3]' : 'text-[#a1a1aa]'}`}>
                            {step.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {idx < PIPELINE_STEPS.length - 1 && (
                          <div className={`h-0.5 flex-1 min-w-[20px] ${idx < currentIdx ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="glass-card p-4">
                  <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide mb-2 block">Client Information</span>
                  <p className="text-sm font-medium text-white">{selectedJob.clientName}</p>
                  {selectedJob.clientPhone && <p className="text-sm text-[#a1a1aa] mt-1">Phone: {selectedJob.clientPhone}</p>}
                  {selectedJob.siteAddress && (
                    <p className="text-sm text-[#a1a1aa] mt-2 flex items-start gap-1.5">
                      <MapPin size={16} className="text-[#52525b] shrink-0 mt-0.5" />
                      <span>{selectedJob.siteAddress}</span>
                    </p>
                  )}
                  {selectedJob.mapsLink && (
                    <a href={selectedJob.mapsLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#0070f3] hover:text-[#0060d3] transition-colors">
                      Open in Google Maps <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="glass-card p-4">
                  <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide mb-2 block">Job Schedule & Assignment</span>
                  <div className="space-y-2 text-sm text-[#a1a1aa]">
                    <div className="flex items-start gap-2">
                      <User size={16} className="text-[#52525b] mt-0.5" />
                      <div>
                        <span>Assigned to: </span>
                        {selectedJob.assignedEmployees && selectedJob.assignedEmployees.length > 0 ? (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {selectedJob.assignedEmployees.map((e: any) => (
                              <span key={e.id} className="text-white bg-white/10 px-2 py-0.5 rounded text-xs inline-block mr-1 mb-1">
                                {e.fullName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-[#52525b]" />
                      <span>Scheduled: {formatIST(selectedJob.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#52525b]" />
                      <span>Duration: {selectedJob.estimatedDuration || '—'} minutes</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-sm font-medium text-[#a1a1aa]">Requires Tools</span>
                    {isOwnerAdmin ? (
                      <button
                        onClick={handleToggleRequiresTools}
                        className={`w-11 h-6 rounded-full transition-colors relative ${selectedJob.requiresTools ? 'bg-[#0070f3]' : 'bg-[#3f3f46]'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${selectedJob.requiresTools ? 'left-6' : 'left-1'}`} />
                      </button>
                    ) : (
                      <span className="text-sm text-white">{selectedJob.requiresTools ? 'Yes' : 'No'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Required Tools & Materials */}
              {((selectedJob.requiredTools?.length ?? 0) > 0 || (selectedJob.requiredMaterials?.length ?? 0) > 0) && (
                <div className="glass-card p-4">
                  <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide mb-2 block">Required Items (from Admin)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedJob.requiredTools?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-white mb-2">Tools</h4>
                        <ul className="list-disc pl-4 text-sm text-[#a1a1aa]">
                          {selectedJob.requiredTools?.map((t: any) => (
                            <li key={t.id}>{t.tool.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(selectedJob.requiredMaterials?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-white mb-2">Materials</h4>
                        <ul className="list-disc pl-4 text-sm text-[#a1a1aa]">
                          {selectedJob.requiredMaterials?.map((m: any) => (
                            <li key={m.id}>{m.product.name} - {m.quantity} {m.product.unit}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Addon Requests */}
              {selectedJob.addonRequests && selectedJob.addonRequests.length > 0 && (
                <div className="glass-card p-4 border-amber-500/20 mt-4">
                  <span className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-2 block">Mid-Job Addon Requests</span>
                  <div className="space-y-3">
                    {selectedJob.addonRequests.map((addon: any) => (
                      <div key={addon.id} className="bg-white/5 p-3 rounded-lg border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">Requested by {addon.requestedBy?.fullName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              addon.status === 'APPROVED' ? 'bg-[#22c55e]/20 text-[#22c55e]' :
                              addon.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' :
                              'bg-amber-500/20 text-amber-500'
                            }`}>
                              {addon.status}
                            </span>
                          </div>
                          <div className="text-xs text-[#a1a1aa]">
                            {addon.tools?.map((t: any) => (
                              <div key={t.id}>• {t.tool?.name} (Tool) - Reason: {t.reason}</div>
                            ))}
                            {addon.materials?.map((m: any) => (
                              <div key={m.id}>• {m.material?.name} ({m.quantityRequested} qty) - Reason: {m.reason}</div>
                            ))}
                          </div>
                          {addon.managerNote && (
                            <div className="text-xs text-amber-400 mt-1 italic">Note: {addon.managerNote}</div>
                          )}
                        </div>
                        
                        {addon.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddonResponse(addon.id, 'APPROVED')}
                              className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs px-3 py-1.5 rounded transition-colors"
                            >
                              Approve & Issue
                            </button>
                            <button
                              onClick={() => handleAddonResponse(addon.id, 'REJECTED')}
                              className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools & Materials */}
              {selectedJob.requiresTools && (
                <div className="glass-card p-4 space-y-6 border-[#0070f3]/20">
                  <span className="text-xs font-medium text-[#0070f3] uppercase tracking-wide block">Tools &amp; Materials</span>

                  {/* ── TOOLS ────────────────────────────────── */}
                  <div>
                    <h4 className="text-sm font-medium text-[#a1a1aa] mb-3">Issued Tools</h4>
                    {selectedJob.toolIssuances && selectedJob.toolIssuances.length > 0 ? (
                      <div className="space-y-2">
                        {selectedJob.toolIssuances.map((issuance: any) => {
                          const isPending    = !issuance.isApproved;
                          const isIssued     = issuance.isApproved && issuance.status === 'ISSUED';
                          const isReturned   = issuance.status === 'RETURNED';
                          const isVerified   = issuance.status === 'RETURN_VERIFIED';

                          return (
                            <div key={issuance.id} className="bg-[#0a0e14] p-3 rounded-lg border border-white/5">
                              {/* Row 1: name + status badge */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-medium truncate">
                                    {issuance.tool?.name}
                                    <span className="text-[#a1a1aa] font-normal ml-1">({issuance.tool?.toolCode})</span>
                                  </p>
                                  {isIssued && issuance.custodyLocation === 'HOME' && (
                                    <p className="text-[10px] text-amber-500 font-bold tracking-wide mt-1 uppercase">Home Custody</p>
                                  )}
                                  <p className="text-xs text-[#a1a1aa] mt-0.5">Issued condition: {issuance.issuedCondition}</p>
                                  {isReturned && (
                                    <p className="text-xs text-[#f59e0b] mt-0.5">
                                      Returned condition: <span className="font-medium">{issuance.returnCondition || 'N/A'}</span>
                                      {issuance.user && <span className="ml-2 text-[#a1a1aa]">by {issuance.user.fullName}</span>}
                                    </p>
                                  )}
                                  {isVerified && (
                                    <p className="text-xs text-[#22c55e] mt-0.5">
                                      ✓ Return verified — condition: <span className="font-medium">{issuance.returnCondition || 'N/A'}</span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isPending && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">Pending Issuance</span>
                                  )}
                                  {isIssued && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#0070f3]/15 text-[#0070f3]">Issued</span>
                                  )}
                                  {isReturned && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">Returned – Awaiting Verification</span>
                                  )}
                                  {isVerified && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">Return Verified ✓</span>
                                  )}
                                </div>
                              </div>
                              {/* Row 2: admin action buttons */}
                              {isOwnerAdmin && (
                                <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                                  {isPending && (
                                    <button
                                      onClick={() => handleApproveTool(issuance.id)}
                                      className="text-xs bg-[#0070f3] hover:bg-[#0060d3] text-white px-3 py-1 rounded"
                                    >
                                      Approve Issuance
                                    </button>
                                  )}
                                  {isReturned && (() => {
                                    if (verifyReturnState?.issuanceId === issuance.id) {
                                      // ── Inline condition picker ──────────────────────
                                      const vrs = verifyReturnState!;
                                      return (
                                        <div className="w-full space-y-3 mt-1">
                                          <p className="text-xs text-[#a1a1aa] font-medium">Admin: confirm return condition</p>
                                          <div className="flex gap-2">
                                            {(['GOOD', 'DAMAGED', 'MISSING'] as const).map(cond => {
                                              const colors = {
                                                GOOD:    { active: 'bg-[#22c55e] text-white border-[#22c55e]',    idle: 'border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10' },
                                                DAMAGED: { active: 'bg-[#f59e0b] text-white border-[#f59e0b]',    idle: 'border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10' },
                                                MISSING: { active: 'bg-[#ef4444] text-white border-[#ef4444]',    idle: 'border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10' },
                                              };
                                              const isActive = vrs.condition === cond;
                                              return (
                                                <button
                                                  key={cond}
                                                  onClick={() => setVerifyReturnState(s => s ? { ...s, condition: cond } : s)}
                                                  className={`flex-1 text-xs px-2 py-1.5 rounded border font-medium transition-all ${
                                                    isActive ? colors[cond].active : colors[cond].idle
                                                  }`}
                                                >
                                                  {cond === 'GOOD' ? '✓ Good' : cond === 'DAMAGED' ? '⚠ Damaged' : '✕ Missing'}
                                                </button>
                                              );
                                            })}
                                          </div>
                                          {/* Deduction preview */}
                                          {vrs.condition !== 'GOOD' && (
                                            <p className={`text-xs ${ vrs.condition === 'MISSING' ? 'text-[#ef4444]' : 'text-[#f59e0b]' }`}>
                                              ⚡ Discipline score −{vrs.condition === 'MISSING' ? '15' : '5'} pts · Tool incident +1
                                            </p>
                                          )}
                                          <input
                                            type="text"
                                            placeholder="Admin note (optional)"
                                            value={vrs.note}
                                            onChange={e => setVerifyReturnState(s => s ? { ...s, note: e.target.value } : s)}
                                            className="w-full bg-[#0a0e14] border border-white/10 text-white text-xs rounded px-2 py-1.5 placeholder-[#52525b] focus:outline-none focus:border-[#0070f3]/50"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleVerifyToolReturn(issuance.id, vrs.condition, vrs.note)}
                                              className={`flex-1 text-xs text-white px-3 py-1.5 rounded font-medium ${
                                                vrs.condition === 'GOOD'    ? 'bg-[#22c55e] hover:bg-[#16a34a]' :
                                                vrs.condition === 'DAMAGED' ? 'bg-[#f59e0b] hover:bg-[#d97706]' :
                                                'bg-[#ef4444] hover:bg-[#dc2626]'
                                              }`}
                                            >
                                              Confirm
                                            </button>
                                            <button
                                              onClick={() => setVerifyReturnState(null)}
                                              className="text-xs text-[#a1a1aa] hover:text-white px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => setVerifyReturnState({ issuanceId: issuance.id, condition: 'GOOD', note: '' })}
                                        className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-white px-3 py-1 rounded"
                                      >
                                        Verify Return
                                      </button>
                                    );
                                  })()}
                                  {isVerified && (
                                    <span className="text-xs text-[#22c55e] py-1">✓ No action required</span>
                                  )}
                                  {isIssued && (
                                    <span className="text-xs text-[#a1a1aa] py-1 italic">Waiting for employee to return tool</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-[#52525b] italic">No tools requested.</p>}
                  </div>

                  {/* ── MATERIALS ────────────────────────────── */}
                  <div className="pt-2 border-t border-white/5">
                    <h4 className="text-sm font-medium text-[#a1a1aa] mb-3">Material Usage</h4>
                    {selectedJob.materialUsageLogs && selectedJob.materialUsageLogs.length > 0 ? (
                      <div className="space-y-2">
                        {selectedJob.materialUsageLogs.map((log: any) => {
                          const isPending   = !log.isApproved;
                          const isApproved  = log.isApproved && !log.completedAt;
                          const isCompleted = !!log.completedAt && !log.ownerReviewed;
                          const isReviewed  = log.ownerReviewed;

                          return (
                            <div key={log.id} className="bg-[#0a0e14] p-3 rounded-lg border border-white/5">
                              {/* Row 1: name + status */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-medium truncate">{log.product?.name}</p>
                                  <p className="text-xs text-[#a1a1aa] mt-0.5">Taken: {log.quantityTaken} {log.product?.unit}</p>
                                  {isCompleted && (
                                    <p className="text-xs text-[#f59e0b] mt-0.5">
                                      Used: <span className="font-medium">{log.quantityUsed}</span> &nbsp;&middot;&nbsp;
                                      Returned: <span className="font-medium">{log.quantityReturned}</span> {log.product?.unit}
                                      {log.overuseFlag && <span className="ml-2 text-[#ef4444]">⚠ Overuse</span>}
                                    </p>
                                  )}
                                  {isReviewed && (
                                    <p className="text-xs text-[#22c55e] mt-0.5">
                                      ✓ Reviewed — used: {log.quantityUsed}, returned: {log.quantityReturned} {log.product?.unit}
                                      {log.overuseFlag && <span className="ml-2 text-[#ef4444]">⚠ Overuse flagged</span>}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isPending && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">Pending Approval</span>
                                  )}
                                  {isApproved && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#0070f3]/15 text-[#0070f3]">Approved</span>
                                  )}
                                  {isCompleted && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">Completed – Awaiting Review</span>
                                  )}
                                  {isReviewed && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">Reviewed ✓</span>
                                  )}
                                </div>
                              </div>
                              {/* Row 2: admin actions */}
                              {isOwnerAdmin && (
                                <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                                  {isPending && (
                                    <button
                                      onClick={() => handleApproveMaterial(log.id)}
                                      className="text-xs bg-[#0070f3] hover:bg-[#0060d3] text-white px-3 py-1 rounded"
                                    >
                                      Approve Request
                                    </button>
                                  )}
                                  {isApproved && (
                                    <span className="text-xs text-[#a1a1aa] py-1 italic">Waiting for employee to log usage</span>
                                  )}
                                  {isCompleted && (
                                    <button
                                      onClick={() => handleReviewMaterial(log.id)}
                                      className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-white px-3 py-1 rounded"
                                    >
                                      Review &amp; Confirm
                                    </button>
                                  )}
                                  {isReviewed && (
                                    <span className="text-xs text-[#22c55e] py-1">✓ No action required</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-[#52525b] italic">No materials requested.</p>}
                  </div>
                </div>
              )}


              {(selectedJob.equipmentNotes || selectedJob.notes || selectedJob.workSummary) && (
                <div className="glass-card p-4 space-y-4">
                  {selectedJob.equipmentNotes && (
                    <div>
                      <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide block mb-1">Equipment Notes</span>
                      <p className="text-sm text-white">{selectedJob.equipmentNotes}</p>
                    </div>
                  )}
                  {selectedJob.notes && (
                    <div>
                      <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide block mb-1">General Notes</span>
                      <p className="text-sm text-white">{selectedJob.notes}</p>
                    </div>
                  )}
                  {selectedJob.workSummary && (
                    <div className="border-t border-white/5 pt-4 mt-2">
                      <span className="text-xs font-medium text-[#22c55e] uppercase tracking-wide block mb-1">Work Completion Summary</span>
                      <p className="text-sm text-white">{selectedJob.workSummary}</p>
                      {selectedJob.completedAt && (
                        <p className="text-xs text-[#a1a1aa] mt-1">Completed at: {formatIST(selectedJob.completedAt)}</p>
                      )}
                      {selectedJob.issuesFound && (
                        <p className="text-sm text-[#ef4444] mt-2">
                          <span className="font-medium">Issues Found:</span> {selectedJob.issuesFound}
                        </p>
                      )}
                      {(selectedJob.photos || []).filter((p: any) => p.phase === 'COMPLETION').length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide block mb-2">Completion Photos</span>
                          <div className="flex flex-wrap gap-2">
                            {(selectedJob.photos || []).filter((p: any) => p.phase === 'COMPLETION').map((photo: any) => (
                              <img
                                key={photo.id}
                                src={photo.photoUrl}
                                alt="Completion"
                                onClick={() => setLightboxPhoto(photo.photoUrl)}
                                className="h-24 w-24 object-cover rounded border border-white/10 cursor-zoom-in hover:opacity-90 transition-opacity"
                                title={`Taken by ${photo.takenBy?.fullName}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide mb-2 block">On-Site Visit History</p>
                {selectedJob.siteVisits && selectedJob.siteVisits.length > 0 ? (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {selectedJob.siteVisits.map((visit) => (
                      <div key={visit.id} className="flex items-center justify-between rounded-lg bg-[#0a0e14] px-4 py-2 border border-white/5 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">Arrived at site</span>
                          <span className="text-xs text-[#a1a1aa] mt-0.5">{formatIST(visit.arrivedAt)}</span>
                        </div>
                        {visit.arrivedLat && visit.arrivedLng && (
                          <span className="text-xs text-[#a1a1aa]">
                            Lat: {visit.arrivedLat.toFixed(5)}, Lng: {visit.arrivedLng.toFixed(5)}
                          </span>
                        )}
                      </div>
                    ))}
                    {selectedJob.startedAt && (
                      <div className="flex items-center justify-between rounded-lg bg-[#0a0e14] px-4 py-2 border border-white/5 text-sm mt-2 border-l-2 border-l-[#0070f3]">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#0070f3]">Started Work</span>
                          <span className="text-xs text-[#a1a1aa] mt-0.5">{formatIST(selectedJob.startedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#0a0e14] p-3 text-center text-sm text-[#52525b] border border-white/5">
                    No site arrival logs found
                  </div>
                )}
                
                {/* Arrival Photos */}
                {(selectedJob.photos || []).filter((p: any) => p.phase === 'ARRIVAL').length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wide block mb-2">Arrival Photos</span>
                    <div className="flex flex-wrap gap-2">
                      {(selectedJob.photos || []).filter((p: any) => p.phase === 'ARRIVAL').map((photo: any) => (
                        <img
                          key={photo.id}
                          src={photo.photoUrl}
                          alt="Arrival"
                          onClick={() => setLightboxPhoto(photo.photoUrl)}
                          className="h-16 w-16 object-cover rounded cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-[#0070f3] transition-all"
                          title={`Taken by ${photo.takenBy?.fullName}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-6">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="btn btn-secondary"
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
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150"
                  >
                    Verify Completed Work
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Verify Job Modal ────────────────────────────────────────────────────────── */}
      {verifyModalJobId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-md mx-auto relative border border-[#334155]">
            <button onClick={() => setVerifyModalJobId(null)} className="absolute top-4 right-4 text-[#52525b] hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-lg font-semibold text-white mb-2">Verify Job Card</h2>
            <p className="text-sm text-[#a1a1aa] mb-6">Rate the quality of the work. This will affect employee discipline scores.</p>
            
            <div className="space-y-3 mb-6">
              {['EXCELLENT', 'GOOD', 'SATISFACTORY', 'POOR', 'NOT_DONE'].map((rating) => (
                <div
                  key={rating}
                  onClick={() => setQualityRating(rating as any)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    qualityRating === rating 
                      ? rating === 'NOT_DONE' || rating === 'POOR'
                        ? 'bg-red-900/20 border-red-500/50'
                        : rating === 'EXCELLENT'
                          ? 'bg-amber-900/20 border-amber-500/50'
                          : 'bg-green-900/20 border-green-500/50'
                      : 'bg-[#0a0e14] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div>
                    <h3 className={`font-semibold ${qualityRating === rating ? 'text-white' : 'text-[#a1a1aa]'}`}>
                      {rating.replace('_', ' ')}
                    </h3>
                    <p className="text-xs text-[#52525b] mt-1">
                      {rating === 'GOOD' && '+5 Discipline Score'}
                      {rating === 'SATISFACTORY' && 'No change to score'}
                      {rating === 'POOR' && '-5 Discipline Score'}
                      {rating === 'NOT_DONE' && '-15 Score & Revert to Assigned'}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    qualityRating === rating
                      ? rating === 'NOT_DONE' || rating === 'POOR' ? 'border-red-500' : rating === 'EXCELLENT' ? 'border-amber-500' : 'border-green-500'
                      : 'border-[#52525b]'
                  }`}>
                    {qualityRating === rating && (
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        rating === 'NOT_DONE' || rating === 'POOR' ? 'bg-red-500' : rating === 'EXCELLENT' ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-6">
              <button onClick={() => setVerifyModalJobId(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={submitVerify} className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Verify Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Photo Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>✕</span> Close (or click anywhere)
            </button>
            <img
              src={lightboxPhoto}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
