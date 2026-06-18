'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { apiGet, apiPost, apiPut } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Package, Search } from 'lucide-react';

export default function ToolsMaterialsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [activeTab, setActiveTab] = useState<'tools' | 'materials'>('tools');

  // Data
  const [tools, setTools] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [jobsList, setJobsList] = useState<any[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modals state
  const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);

  // Selected item
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  // History / Usage
  const [toolHistory, setToolHistory] = useState<any[]>([]);
  const [materialUsage, setMaterialUsage] = useState<any[]>([]);

  // Forms
  const [toolForm, setToolForm] = useState({ toolCode: '', name: '', category: '', condition: 'GOOD', replacementCost: 0 });
  const [materialForm, setMaterialForm] = useState({ materialCode: '', name: '', category: '', unit: '', currentStock: 0, reorderLevel: 0, shelfLocation: '' });
  const [issueForm, setIssueForm] = useState({ assignedTo: '', jobId: '', condition: 'GOOD' });
  const [takeForm, setTakeForm] = useState({ quantity: 1, jobId: '' });

  // Inline Edit
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editToolForm, setEditToolForm] = useState<any>({});

  const fetchData = async () => {
    try {
      const [tRes, mRes, uRes, jRes] = await Promise.all([
        apiGet('/tools').catch(() => ({ data: [] })),
        apiGet('/materials').catch(() => ({ data: [] })),
        apiGet('/users').catch(() => ({ data: [] })),
        apiGet('/jobs').catch(() => ({ data: [] }))
      ]);
      setTools(tRes.data || []);
      setMaterials(mRes.data || []);
      setUsersList(uRes.data || []);
      setJobsList(jRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats
  const toolsStats = useMemo(() => {
    return {
      total: tools.length,
      issued: tools.filter(t => t.currentHolder).length,
      damaged: tools.filter(t => t.condition === 'DAMAGED').length,
      lost: tools.filter(t => t.condition === 'LOST').length,
    };
  }, [tools]);

  const materialStats = useMemo(() => {
    return {
      total: materials.length,
      lowStock: materials.filter(m => m.currentStock <= m.reorderLevel).length,
    };
  }, [materials]);

  // Filtering
  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchSearch = (t.name?.toLowerCase().includes(search.toLowerCase()) || '') || (t.toolCode?.toLowerCase().includes(search.toLowerCase()) || '');
      const matchCategory = filterCategory ? t.category === filterCategory : true;
      const matchCondition = filterCondition ? t.condition === filterCondition : true;
      return matchSearch && matchCategory && matchCondition;
    });
  }, [tools, search, filterCategory, filterCondition]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchSearch = m.name?.toLowerCase().includes(search.toLowerCase()) || '';
      const matchCategory = filterCategory ? m.category === filterCategory : true;
      const matchStock = filterLowStock ? m.currentStock <= m.reorderLevel : true;
      return matchSearch && matchCategory && matchStock;
    });
  }, [materials, search, filterCategory, filterLowStock]);

  // Actions
  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/tools', toolForm);
      toast.success('Tool added successfully');
      setIsAddToolModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add tool');
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/materials', materialForm);
      toast.success('Material added successfully');
      setIsAddMaterialModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add material');
    }
  };

  const handleIssueTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost(`/tools/${selectedTool.id}/issue`, issueForm);
      toast.success('Tool issued successfully');
      setIsIssueModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to issue tool');
    }
  };

  const handleTakeMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost(`/materials/${selectedMaterial.id}/take`, takeForm);
      toast.success('Material taken successfully');
      setIsTakeModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to take material');
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
      setToolHistory(res.data || []);
    } catch (err) {
      setToolHistory([]);
    }
  };

  const openUsage = async (material: any) => {
    setSelectedMaterial(material);
    setIsUsageModalOpen(true);
    try {
      const res = await apiGet(`/materials/${material.id}/usage`);
      setMaterialUsage(res.data || []);
    } catch (err) {
      setMaterialUsage([]);
    }
  };

  // Columns Definitions
  const toolsColumns: Column<any>[] = [
    { key: 'toolCode', label: 'Tool Code', sortable: true },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => editingToolId === row.id ? (
        <input className="w-full rounded bg-[#0f172a] border border-[#334155] px-2 py-1 text-xs text-white" value={editToolForm.name} onChange={e => setEditToolForm({...editToolForm, name: e.target.value})} />
      ) : String(val || '')
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val, row) => editingToolId === row.id ? (
        <select className="w-full rounded bg-[#0f172a] border border-[#334155] px-2 py-1 text-xs text-white" value={editToolForm.category} onChange={e => setEditToolForm({...editToolForm, category: e.target.value})}>
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
        <select className="w-full rounded bg-[#0f172a] border border-[#334155] px-2 py-1 text-xs text-white" value={editToolForm.condition} onChange={e => setEditToolForm({...editToolForm, condition: e.target.value})}>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="DAMAGED">Damaged</option>
          <option value="LOST">Lost</option>
        </select>
      ) : <StatusBadge status={String(val || 'GOOD')} />
    },
    { key: 'currentHolder', label: 'Current Holder', render: (val) => val ? String(val) : <span className="text-[#94a3b8]">Available</span> },
    {
      key: 'replacementCost',
      label: 'Replacement Cost',
      render: (val, row) => editingToolId === row.id ? (
        <input type="number" className="w-full rounded bg-[#0f172a] border border-[#334155] px-2 py-1 text-xs text-white" value={editToolForm.replacementCost} onChange={e => setEditToolForm({...editToolForm, replacementCost: Number(e.target.value)})} />
      ) : `₹${val || 0}`
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => editingToolId === row.id ? (
        <div className="flex gap-2">
          <button onClick={() => saveEditTool(row.id)} className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">Save</button>
          <button onClick={() => setEditingToolId(null)} className="rounded bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-400">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-2">
          {isOwner && (
            <>
              <button onClick={() => { setEditingToolId(row.id); setEditToolForm({...row}); }} className="rounded bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-500/20">Edit</button>
              <button onClick={() => { setSelectedTool(row); setIsIssueModalOpen(true); }} className="rounded bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-500/20">Issue</button>
            </>
          )}
          <button onClick={() => openHistory(row)} className="rounded bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-500/20">History</button>
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

  const materialsColumns: Column<any>[] = [
    { key: 'materialCode', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'unit', label: 'Unit' },
    {
      key: 'currentStock',
      label: 'Current Stock',
      sortable: true,
      render: (val, row) => (
        <span className={Number(val) <= row.reorderLevel ? 'font-bold text-red-400' : 'text-[#f8fafc]'}>
          {String(val || 0)}
        </span>
      )
    },
    { key: 'reorderLevel', label: 'Reorder Level' },
    { key: 'shelfLocation', label: 'Location' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setSelectedMaterial(row); setIsTakeModalOpen(true); }} className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20">Take Stock</button>
          <button onClick={() => openUsage(row)} className="rounded bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-500/20">Usage</button>
        </div>
      )
    }
  ];

  const usageColumns: Column<any>[] = [
    { key: 'dateTaken', label: 'Date Taken', render: (val) => new Date(String(val)).toLocaleDateString() },
    { key: 'takenBy', label: 'Taken By' },
    { key: 'quantityTaken', label: 'Qty Taken' },
    { key: 'quantityUsed', label: 'Qty Used' },
    { key: 'quantityReturned', label: 'Qty Returned' },
    { key: 'overuseFlag', label: 'Overuse Flag', render: (val) => val ? <StatusBadge status="WARNING" variant="warning" /> : '—' },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={String(val || 'UNKNOWN')} /> }
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Tools & Materials"
        subtitle="Manage tool inventory, track issuances, and monitor conditions"
        actionLabel={isOwner ? `+ Add ${activeTab === 'tools' ? 'Tool' : 'Material'}` : undefined}
        onAction={isOwner ? () => activeTab === 'tools' ? setIsAddToolModalOpen(true) : setIsAddMaterialModalOpen(true) : undefined}
      />

      <div className="flex gap-2 border-b border-[#334155] pb-px">
        <button
          onClick={() => { setActiveTab('tools'); setSearch(''); setFilterCategory(''); setFilterCondition(''); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition-all ${activeTab === 'tools' ? 'border-[#0088ff] text-[#0088ff]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Wrench size={16} /> Tools
        </button>
        <button
          onClick={() => { setActiveTab('materials'); setSearch(''); setFilterCategory(''); setFilterLowStock(false); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition-all ${activeTab === 'materials' ? 'border-[#0088ff] text-[#0088ff]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Package size={16} /> Materials
        </button>
      </div>

      {activeTab === 'tools' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Total Tools</p>
              <p className="mt-1 text-2xl font-black text-white">{toolsStats.total}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Currently Issued</p>
              <p className="mt-1 text-2xl font-black text-blue-400">{toolsStats.issued}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Damaged</p>
              <p className="mt-1 text-2xl font-black text-amber-400">{toolsStats.damaged}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Lost</p>
              <p className="mt-1 text-2xl font-black text-red-400">{toolsStats.lost}</p>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search by name or tool code..." className="w-full rounded-lg border border-[#334155] bg-[#0f172a] pl-10 pr-4 py-2 text-sm text-white focus:border-[#0088ff] focus:outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm text-white focus:border-[#0088ff] focus:outline-none" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="POWER_TOOL">Power Tool</option>
              <option value="HAND_TOOL">Hand Tool</option>
              <option value="MEASUREMENT">Measurement</option>
            </select>
            <select className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm text-white focus:border-[#0088ff] focus:outline-none" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
              <option value="">All Conditions</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          <DataTable columns={toolsColumns} data={filteredTools} />
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Total Materials</p>
              <p className="mt-1 text-2xl font-black text-white">{materialStats.total}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
              <p className="text-xs font-semibold text-slate-400">Low Stock Items</p>
              <p className="mt-1 text-2xl font-black text-red-400">{materialStats.lowStock}</p>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search by name..." className="w-full rounded-lg border border-[#334155] bg-[#0f172a] pl-10 pr-4 py-2 text-sm text-white focus:border-[#0088ff] focus:outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm text-white focus:border-[#0088ff] focus:outline-none" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="CONSUMABLE">Consumable</option>
              <option value="SPARE_PART">Spare Part</option>
              <option value="FLUID">Fluid</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={filterLowStock} onChange={(e) => setFilterLowStock(e.target.checked)} className="rounded border-[#334155] bg-[#0f172a] text-[#0088ff] focus:ring-[#0088ff]" />
              Low Stock Only
            </label>
          </div>

          <DataTable columns={materialsColumns} data={filteredMaterials} />
        </div>
      )}

      {/* Tools Modals */}
      <Modal isOpen={isAddToolModalOpen} onClose={() => setIsAddToolModalOpen(false)} title="Add Tool">
        <form onSubmit={handleAddTool} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Tool Code</label>
            <input required type="text" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={toolForm.toolCode} onChange={e => setToolForm({...toolForm, toolCode: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Name</label>
            <input required type="text" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={toolForm.name} onChange={e => setToolForm({...toolForm, name: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Category</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={toolForm.category} onChange={e => setToolForm({...toolForm, category: e.target.value})}>
              <option value="">Select...</option>
              <option value="POWER_TOOL">Power Tool</option>
              <option value="HAND_TOOL">Hand Tool</option>
              <option value="MEASUREMENT">Measurement</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Condition</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={toolForm.condition} onChange={e => setToolForm({...toolForm, condition: e.target.value})}>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Replacement Cost (₹)</label>
            <input required type="number" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={toolForm.replacementCost} onChange={e => setToolForm({...toolForm, replacementCost: Number(e.target.value)})} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsAddToolModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#0088ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0088ff]/80">Save</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title={`Issue Tool: ${selectedTool?.name}`}>
        <form onSubmit={handleIssueTool} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Assign To</label>
            <select required className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={issueForm.assignedTo} onChange={e => setIssueForm({...issueForm, assignedTo: e.target.value})}>
              <option value="">Select User...</option>
              {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Job Card (Optional)</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={issueForm.jobId} onChange={e => setIssueForm({...issueForm, jobId: e.target.value})}>
              <option value="">None</option>
              {jobsList.map(j => <option key={j.id} value={j.id}>{j.id}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Issued Condition</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={issueForm.condition} onChange={e => setIssueForm({...issueForm, condition: e.target.value})}>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsIssueModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Issue</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`History: ${selectedTool?.name}`} size="lg">
        <DataTable columns={historyColumns} data={toolHistory} />
      </Modal>

      {/* Materials Modals */}
      <Modal isOpen={isAddMaterialModalOpen} onClose={() => setIsAddMaterialModalOpen(false)} title="Add Material">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Material Code</label>
            <input required type="text" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.materialCode} onChange={e => setMaterialForm({...materialForm, materialCode: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Name</label>
            <input required type="text" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.name} onChange={e => setMaterialForm({...materialForm, name: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Category</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.category} onChange={e => setMaterialForm({...materialForm, category: e.target.value})}>
              <option value="">Select...</option>
              <option value="CONSUMABLE">Consumable</option>
              <option value="SPARE_PART">Spare Part</option>
              <option value="FLUID">Fluid</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Unit</label>
              <input required type="text" placeholder="e.g. L, Kg, Pcs" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.unit} onChange={e => setMaterialForm({...materialForm, unit: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Current Stock</label>
              <input required type="number" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.currentStock} onChange={e => setMaterialForm({...materialForm, currentStock: Number(e.target.value)})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Reorder Level</label>
              <input required type="number" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.reorderLevel} onChange={e => setMaterialForm({...materialForm, reorderLevel: Number(e.target.value)})} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Shelf Location</label>
              <input type="text" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={materialForm.shelfLocation} onChange={e => setMaterialForm({...materialForm, shelfLocation: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsAddMaterialModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#0088ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0088ff]/80">Save</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTakeModalOpen} onClose={() => setIsTakeModalOpen(false)} title={`Take Material: ${selectedMaterial?.name}`}>
        <form onSubmit={handleTakeMaterial} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Quantity to Take</label>
            <input required type="number" min="1" max={selectedMaterial?.currentStock} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={takeForm.quantity} onChange={e => setTakeForm({...takeForm, quantity: Number(e.target.value)})} />
            <p className="mt-1 text-xs text-slate-500">Available: {selectedMaterial?.currentStock} {selectedMaterial?.unit}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Job Card (Optional)</label>
            <select className="w-full rounded-lg border border-[#334155] bg-[#0f172a] p-2 text-white" value={takeForm.jobId} onChange={e => setTakeForm({...takeForm, jobId: e.target.value})}>
              <option value="">None</option>
              {jobsList.map(j => <option key={j.id} value={j.id}>{j.id}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsTakeModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600">Take Stock</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title={`Usage: ${selectedMaterial?.name}`} size="lg">
        <DataTable columns={usageColumns} data={materialUsage} />
      </Modal>
    </div>
  );
}
