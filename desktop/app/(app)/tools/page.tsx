'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Package, Search } from 'lucide-react';

export default function ToolsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  // Data
  const [tools, setTools] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [jobsList, setJobsList] = useState<any[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');

  // Modals state
  const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Selected item
  const [selectedTool, setSelectedTool] = useState<any>(null);

  // History / Usage
  const [toolHistory, setToolHistory] = useState<any[]>([]);

  // Forms
  const [toolForm, setToolForm] = useState({ toolCode: '', name: '', category: '', condition: 'GOOD', replacementCost: 0 });
  const [issueForm, setIssueForm] = useState({ assignedTo: '', jobId: '', condition: 'GOOD' });

  // Inline Edit
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editToolForm, setEditToolForm] = useState<any>({});

  const fetchData = async () => {
    try {
      const [tRes, uRes, jRes] = await Promise.all([
        apiGet(`/tools?page=${currentPage}&limit=50`).catch(() => ({ data: { data: [], totalPages: 1 } })),
        apiGet('/users').catch(() => ({ data: { data: [] } })),
        apiGet('/jobs').catch(() => ({ data: { data: [] } }))
      ]);
      setTools((tRes as any).data?.data || []);
      setTotalPages((tRes as any).data?.totalPages || 1);
      setUsersList((uRes as any).data?.data || (uRes as any).data || []);
      setJobsList((jRes as any).data?.data || (jRes as any).data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  // Stats
  const toolsStats = useMemo(() => {
    return {
      total: tools.length,
      issued: tools.filter(t => t.currentHolder).length,
      damaged: tools.filter(t => t.condition === 'DAMAGED').length,
      lost: tools.filter(t => t.condition === 'LOST').length,
    };
  }, [tools]);

  // Filtering
  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchSearch = (t.name?.toLowerCase().includes(search.toLowerCase()) || '') || (t.toolCode?.toLowerCase().includes(search.toLowerCase()) || '');
      const matchCategory = filterCategory ? t.category === filterCategory : true;
      const matchCondition = filterCondition ? t.condition === filterCondition : true;
      return matchSearch && matchCategory && matchCondition;
    });
  }, [tools, search, filterCategory, filterCondition]);

  // Actions
  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/tools', toolForm);
      toast.success('Tool added successfully');
      setIsAddToolModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add tool');
    }
  };

  
  const handleIssueTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost(`/tools/${selectedTool.id}/issue`, {
        userId: Number(issueForm.assignedTo),
        jobCardId: issueForm.jobId ? Number(issueForm.jobId) : null,
        issuedCondition: issueForm.condition
      });
      toast.success('Tool issued successfully');
      setIsIssueModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to issue tool');
    }
  };

  
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;
    try {
      const res = await apiDelete(`/tools/${id}`);
      if ((res as any).success) {
        toast.success('Tool deleted successfully');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete tool');
    }
  };

  const handleForceReturn = async (id: number) => {
    if (!confirm('Force return this tool to the warehouse? This will unassign it from its current holder.')) return;
    try {
      const res = await apiPut(`/tools/${id}/force-return`);
      if ((res as any).success) {
        toast.success('Tool forcefully returned');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to force return tool');
    }
  };

  
  const saveEditTool = async (id: string) => {
    try {
      await apiPut(`/tools/${id}`, editToolForm);
      toast.success('Tool updated');
      setEditingToolId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to update tool');
    }
  };

  const openHistory = async (tool: any) => {
    setSelectedTool(tool);
    setIsHistoryModalOpen(true);
    try {
      const res = await apiGet(`/tools/${tool.id}/history`);
      setToolHistory((res.data as any) || []);
    } catch (err) {
      setToolHistory([]);
    }
  };

  
  const inputClasses = "input";

  // Columns Definitions
  const toolsColumns: Column<any>[] = [
    { key: 'toolCode', label: 'Tool Code', sortable: true },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => editingToolId === row.id ? (
        <input className={inputClasses} value={editToolForm.name} onChange={e => setEditToolForm({...editToolForm, name: e.target.value})} />
      ) : String(val || '')
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val, row) => editingToolId === row.id ? (
        <select className={inputClasses} value={editToolForm.category} onChange={e => setEditToolForm({...editToolForm, category: e.target.value})}>
          <option value="POWER_TOOL">Power Tool</option>
          <option value="HAND_TOOL">Hand Tool</option>
          <option value="MEASUREMENT">Measurement</option>
        </select>
      ) : String(val || '')
    },
    {
      key: 'condition',
      label: 'Condition',
      render: (val, row) => editingToolId === row.id ? (
        <select className={inputClasses} value={editToolForm.condition} onChange={e => setEditToolForm({...editToolForm, condition: e.target.value})}>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="DAMAGED">Damaged</option>
          <option value="LOST">Lost</option>
        </select>
      ) : <StatusBadge status={String(val || 'GOOD')} />
    },
    { key: 'currentHolder', label: 'Current Holder', render: (val) => val ? String(val) : <span className="text-[#52525b]">Available</span> },
    {
      key: 'replacementCost',
      label: 'Replacement Cost',
      render: (val, row) => editingToolId === row.id ? (
        <input type="number" className={inputClasses} value={editToolForm.replacementCost} onChange={e => setEditToolForm({...editToolForm, replacementCost: Number(e.target.value)})} />
      ) : `₹${val || 0}`
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => editingToolId === row.id ? (
        <div className="flex gap-2">
          <button onClick={() => saveEditTool(row.id)} className="bg-[#0070f3] hover:bg-[#0060d3] text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150">Save</button>
          <button onClick={() => setEditingToolId(null)} className="bg-transparent border border-white/5 hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-2">
          {isOwner && (
            <>
              <button onClick={() => { setEditingToolId(row.id); setEditToolForm({...row}); }} className="bg-transparent border border-white/5 hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150">Edit</button>
              <button onClick={() => { setSelectedTool(row); setIsIssueModalOpen(true); }} className="bg-transparent border border-white/5 hover:border-[#0070f3] text-[#a1a1aa] hover:text-[#0070f3] text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150">Issue</button>
              {row.currentHolder && (
                <button onClick={() => handleForceReturn(row.id)} className="bg-transparent border border-white/5 hover:border-emerald-500 text-[#a1a1aa] hover:text-emerald-400 text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150" title="Force Return to Warehouse">Return</button>
              )}
            </>
          )}
          <button onClick={() => openHistory(row)} className="bg-transparent border border-white/5 hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors duration-150">History</button>
        </div>
      )
    }
  ];

  const historyColumns: Column<any>[] = [
    { key: 'dateIssued', label: 'Date Issued', render: (val) => new Date(String(val)).toLocaleDateString() },
    { key: 'issuedTo', label: 'Issued To' },
    { key: 'dateReturned', label: 'Date Returned', render: (val) => val ? new Date(String(val)).toLocaleDateString() : '—' },
    { key: 'issuedCondition', label: 'Issued Condition', render: (val) => <StatusBadge status={String(val || 'GOOD')} /> },
    { key: 'returnCondition', label: 'Return Condition', render: (val) => val ? <StatusBadge status={String(val)} /> : '—' },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={String(val || 'UNKNOWN')} /> },
    { key: 'penaltyAmount', label: 'Penalty Amount', render: (val) => val ? `₹${val}` : '—' }
  ];

  
  
  return (
    <div className="flex-1 overflow-auto p-8 space-y-6">
      <PageHeader
        title="Tools"
        subtitle="Manage tool inventory and track issuances"
        actionLabel={isOwner ? "+ Add Tool" : undefined}
        onAction={isOwner ? () => setIsAddToolModalOpen(true) : undefined}
      />

      

      <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Tools</p>
              <p className="mt-2 text-2xl font-semibold text-white">{toolsStats.total}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Currently Issued</p>
              <p className="mt-2 text-2xl font-semibold text-[#0070f3]">{toolsStats.issued}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Damaged</p>
              <p className="mt-2 text-2xl font-semibold text-[#f59e0b]">{toolsStats.damaged}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Lost</p>
              <p className="mt-2 text-2xl font-semibold text-[#ef4444]">{toolsStats.lost}</p>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" size={16} />
              <input type="text" placeholder="Search by name or tool code..." className={`${inputClasses} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className={inputClasses} style={{width: 'auto'}} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="POWER_TOOL">Power Tool</option>
              <option value="HAND_TOOL">Hand Tool</option>
              <option value="MEASUREMENT">Measurement</option>
            </select>
            <select className={inputClasses} style={{width: 'auto'}} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
              <option value="">All Conditions</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          <DataTable 
            columns={toolsColumns} 
            data={filteredTools} 
            pagination={{
              currentPage,
              totalPages,
              onPageChange: (page) => setCurrentPage(page)
            }}
          />
        </div>

      {/* Tools Modals */}
      <Modal isOpen={isAddToolModalOpen} onClose={() => setIsAddToolModalOpen(false)} title="Add Tool">
        <form onSubmit={handleAddTool} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Tool Code</label>
            <input required type="text" className={inputClasses} value={toolForm.toolCode} onChange={e => setToolForm({...toolForm, toolCode: e.target.value})} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Name</label>
            <input required type="text" className={inputClasses} value={toolForm.name} onChange={e => setToolForm({...toolForm, name: e.target.value})} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Category</label>
            <select className={inputClasses} value={toolForm.category} onChange={e => setToolForm({...toolForm, category: e.target.value})}>
              <option value="">Select...</option>
              <option value="POWER_TOOL">Power Tool</option>
              <option value="HAND_TOOL">Hand Tool</option>
              <option value="MEASUREMENT">Measurement</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Condition</label>
            <select className={inputClasses} value={toolForm.condition} onChange={e => setToolForm({...toolForm, condition: e.target.value})}>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Replacement Cost (₹)</label>
            <input required type="number" className={inputClasses} value={toolForm.replacementCost} onChange={e => setToolForm({...toolForm, replacementCost: Number(e.target.value)})} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsAddToolModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title={`Issue Tool: ${selectedTool?.name}`}>
        <form onSubmit={handleIssueTool} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Assign To</label>
            <select required className={inputClasses} value={issueForm.assignedTo} onChange={e => setIssueForm({...issueForm, assignedTo: e.target.value})}>
              <option value="">Select User...</option>
              {usersList.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Job Card (Optional)</label>
            <select className={inputClasses} value={issueForm.jobId} onChange={e => setIssueForm({...issueForm, jobId: e.target.value})}>
              <option value="">None</option>
              {jobsList.map(j => <option key={j.id} value={j.id}>{j.id}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Issued Condition</label>
            <select className={inputClasses} value={issueForm.condition} onChange={e => setIssueForm({...issueForm, condition: e.target.value})}>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsIssueModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Issue</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`History: ${selectedTool?.name}`} size="lg">
        <DataTable columns={historyColumns} data={toolHistory} />
      </Modal>

      

      

      
    </div>
  );
}
