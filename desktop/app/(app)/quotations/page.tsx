'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { Plus, Search, Eye, Edit, Send, CheckCircle, Trash2, X, FileText, Download } from 'lucide-react';

type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED';

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxPercent: number;
  amount: number;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  grandTotal: number;
  status: QuotationStatus;
  createdDate: string;
  validUntil: string;
  assignedTo: string;
  notes: string;
  items: LineItem[];
}

interface PdfDataResponse {
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  firmGstin: string;
}

const MOCK_QUOTATIONS: Quotation[] = [
  {
    id: '1',
    quotationNumber: 'QT-2026-001',
    clientName: 'Acme Corp',
    clientPhone: '9876543210',
    clientAddress: '123 Business Rd, Tech City',
    grandTotal: 153400,
    status: 'ACCEPTED',
    createdDate: new Date().toISOString(),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
    assignedTo: 'Rahul Sharma',
    notes: 'Standard installation terms apply.',
    items: [
      { id: '11', description: 'Server Rack', qty: 2, unitPrice: 40000, taxPercent: 18, amount: 94400 },
      { id: '12', description: 'Router', qty: 1, unitPrice: 50000, taxPercent: 18, amount: 59000 },
    ]
  },
  {
    id: '2',
    quotationNumber: 'QT-2026-002',
    clientName: 'Global Tech',
    clientPhone: '9876543211',
    clientAddress: '45 IT Park, Cyber Hub',
    grandTotal: 45000,
    status: 'DRAFT',
    createdDate: new Date().toISOString(),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
    assignedTo: 'Rahul Sharma',
    notes: '',
    items: [
      { id: '21', description: 'CCTV Camera', qty: 10, unitPrice: 3813.55, taxPercent: 18, amount: 45000 }
    ]
  }
];

export default function QuotationsPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [validityDays, setValidityDays] = useState(15);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Partial<LineItem>[]>([
    { description: '', qty: 1, unitPrice: 0, taxPercent: 18, amount: 0 }
  ]);

  useEffect(() => {
    // Mock fetch
    setQuotations(MOCK_QUOTATIONS);
  }, []);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
  const formatDateIST = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  const stats = {
    total: quotations.length,
    pending: quotations.filter(q => q.status === 'DRAFT' || q.status === 'SENT').length,
    accepted: quotations.filter(q => q.status === 'ACCEPTED').length,
    converted: quotations.filter(q => q.status === 'CONVERTED').length,
  };

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.clientName.toLowerCase().includes(search.toLowerCase()) || q.quotationNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    const it = newItems[index];
    it.amount = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) * (1 + (Number(it.taxPercent) || 0) / 100);
    setItems(newItems);
  };

  const handleAddItem = () => setItems([...items, { description: '', qty: 1, unitPrice: 0, taxPercent: 18, amount: 0 }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const liveGrandTotal = items.reduce((acc, it) => acc + (it.amount || 0), 0);

  const generatePdf = async (q: Quotation) => {
    try {
      const res = await axios.get<PdfDataResponse>(`/api/quotations/${q.id}/pdf-data`);
      const { firmName, firmAddress, firmPhone, firmGstin } = res.data;
      
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(firmName, 14, 22);
      doc.setFontSize(10);
      doc.text(firmAddress, 14, 30);
      doc.text(`Phone: ${firmPhone}`, 14, 35);
      doc.text(`GSTIN: ${firmGstin}`, 14, 40);
      
      doc.setFontSize(14);
      doc.text('QUOTATION', 150, 22);
      doc.setFontSize(10);
      doc.text(`No: ${q.quotationNumber}`, 150, 30);
      doc.text(`Date: ${formatDateIST(q.createdDate)}`, 150, 35);
      doc.text(`Valid Until: ${formatDateIST(q.validUntil)}`, 150, 40);
      
      doc.text('Bill To:', 14, 55);
      doc.text(q.clientName, 14, 60);
      doc.text(q.clientAddress, 14, 65);
      doc.text(`Phone: ${q.clientPhone}`, 14, 70);
      
      const tableBody = q.items.map(item => [
        item.description,
        item.qty.toString(),
        item.unitPrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
        `${item.taxPercent}%`,
        item.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
      ]);
      
      autoTable(doc, {
        startY: 80,
        head: [['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount']],
        body: tableBody,
      });
      
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 100;
      doc.text(`Grand Total: ${q.grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 150, finalY + 10);
      
      doc.text('Terms & Conditions:', 14, finalY + 20);
      doc.text('1. Payment is due within the validity period.', 14, finalY + 25);
      doc.text('2. Goods once sold will not be taken back.', 14, finalY + 30);
      if (q.notes) doc.text(`Notes: ${q.notes}`, 14, finalY + 35);
      doc.text('Thank you for your business!', 14, finalY + 50);
      
      doc.save(`Quotation-${q.quotationNumber}.pdf`);
      toast.success('PDF Generated Successfully');
    } catch (error) {
      console.error('Failed to generate PDF', error);
      toast.error('Failed to generate PDF. Could not fetch firm data.');
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <PageHeader
        title="Quotations"
        subtitle="Create, send, and track client quotations"
        actionLabel="+ New Quotation"
        onAction={() => setIsCreateModalOpen(true)}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-blue-400' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Accepted', value: stats.accepted, color: 'text-emerald-400' },
          { label: 'Converted', value: stats.converted, color: 'text-purple-400' },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-xl border border-[#334155] bg-[#1e293b]">
            <p className="text-sm text-[#94a3b8] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={18} />
          <input
            type="text"
            placeholder="Search by client or quotation number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#334155] bg-[#0f172a] pl-10 pr-4 py-2 text-sm text-[#f8fafc] focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm text-[#f8fafc] focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="CONVERTED">Converted</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
        <table className="w-full text-left text-sm text-[#f8fafc]">
          <thead className="border-b border-[#334155] bg-[#0f172a]/50">
            <tr>
              <th className="p-4 font-medium">Quotation #</th>
              <th className="p-4 font-medium">Client Name</th>
              <th className="p-4 font-medium">Grand Total</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Created Date</th>
              <th className="p-4 font-medium">Valid Until</th>
              <th className="p-4 font-medium">Assigned To</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotations.map(q => (
              <tr key={q.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/20">
                <td className="p-4 font-medium">{q.quotationNumber}</td>
                <td className="p-4">{q.clientName}</td>
                <td className="p-4">{formatCurrency(q.grandTotal)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    q.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' :
                    q.status === 'DRAFT' ? 'bg-slate-500/20 text-slate-400' :
                    q.status === 'SENT' ? 'bg-blue-500/20 text-blue-400' :
                    q.status === 'CONVERTED' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>
                    {q.status}
                  </span>
                </td>
                <td className="p-4 text-[#94a3b8]">{formatDateIST(q.createdDate)}</td>
                <td className="p-4 text-[#94a3b8]">{formatDateIST(q.validUntil)}</td>
                <td className="p-4">{q.assignedTo}</td>
                <td className="p-4 flex justify-end gap-2">
                  <button onClick={() => { setSelectedQuotation(q); setIsViewModalOpen(true); }} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded" title="View"><Eye size={16} /></button>
                  {user?.role === 'OWNER' && (
                    <>
                      <button disabled={q.status === 'CONVERTED' || q.status === 'EXPIRED'} className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Edit"><Edit size={16} /></button>
                      <button disabled={q.status !== 'DRAFT'} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Send"><Send size={16} /></button>
                      <button disabled={q.status !== 'ACCEPTED'} className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Convert to Sale"><CheckCircle size={16} /></button>
                      <button disabled={q.status !== 'DRAFT'} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Delete"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredQuotations.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#94a3b8]">No quotations found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Create Quotation</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#94a3b8] hover:text-white"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Client Name</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Phone</label>
                <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-[#94a3b8] mb-1">Address</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Validity (Days)</label>
                <input type="number" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-white">Line Items</h3>
                <button onClick={handleAddItem} className="text-sm bg-[#334155] hover:bg-[#475569] text-white px-3 py-1.5 rounded flex items-center gap-1">
                  <Plus size={16} /> Add Item
                </button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start bg-[#0f172a] p-3 rounded-lg border border-[#334155]">
                    <div className="flex-1">
                      <input placeholder="Description" type="text" value={item.description} onChange={e => handleUpdateItem(index, 'description', e.target.value)} className="w-full rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-sm text-white" />
                    </div>
                    <div className="w-20">
                      <input placeholder="Qty" type="number" value={item.qty} onChange={e => handleUpdateItem(index, 'qty', Number(e.target.value))} className="w-full rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-sm text-white" />
                    </div>
                    <div className="w-28">
                      <input placeholder="Unit Price" type="number" value={item.unitPrice} onChange={e => handleUpdateItem(index, 'unitPrice', Number(e.target.value))} className="w-full rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-sm text-white" />
                    </div>
                    <div className="w-20">
                      <input placeholder="Tax %" type="number" value={item.taxPercent} onChange={e => handleUpdateItem(index, 'taxPercent', Number(e.target.value))} className="w-full rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-sm text-white" />
                    </div>
                    <div className="w-28 flex items-center h-8">
                      <span className="text-sm font-medium text-white">{formatCurrency(item.amount || 0)}</span>
                    </div>
                    <button onClick={() => handleRemoveItem(index)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded mt-0.5">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-right">
                <span className="text-[#94a3b8] mr-4">Running Total:</span>
                <span className="text-2xl font-bold text-white">{formatCurrency(liveGrandTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 border-t border-[#334155] pt-4">
              <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-lg text-white hover:bg-[#334155]">Cancel</button>
              <button onClick={() => { toast.success('Quotation Created!'); setIsCreateModalOpen(false); }} className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 font-medium">Save Quotation</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Quotation {selectedQuotation.quotationNumber}</h2>
                <p className="text-sm text-[#94a3b8]">Created: {formatDateIST(selectedQuotation.createdDate)} | Valid until: {formatDateIST(selectedQuotation.validUntil)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generatePdf(selectedQuotation)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">
                  <Download size={16} /> Generate PDF
                </button>
                <button onClick={() => setIsViewModalOpen(false)} className="text-[#94a3b8] hover:text-white p-1"><X size={24} /></button>
              </div>
            </div>

            <div className="bg-[#0f172a] rounded-lg p-6 border border-[#334155] mb-6">
              <h3 className="text-sm font-semibold text-[#94a3b8] uppercase mb-2">Bill To</h3>
              <p className="text-lg font-medium text-white">{selectedQuotation.clientName}</p>
              <p className="text-sm text-[#cbd5e1]">{selectedQuotation.clientAddress}</p>
              <p className="text-sm text-[#cbd5e1]">Phone: {selectedQuotation.clientPhone}</p>
            </div>

            <div className="mb-6">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#334155] text-[#94a3b8]">
                  <tr>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Unit Price</th>
                    <th className="pb-2 font-medium text-right">Tax</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-[#f8fafc]">
                  {selectedQuotation.items.map(it => (
                    <tr key={it.id} className="border-b border-[#334155]/50 last:border-0">
                      <td className="py-3">{it.description}</td>
                      <td className="py-3 text-right">{it.qty}</td>
                      <td className="py-3 text-right">{formatCurrency(it.unitPrice)}</td>
                      <td className="py-3 text-right">{it.taxPercent}%</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 border-t border-[#334155]">
                  <span className="text-[#94a3b8] font-medium">Grand Total</span>
                  <span className="text-xl font-bold text-white">{formatCurrency(selectedQuotation.grandTotal)}</span>
                </div>
              </div>
            </div>

            {selectedQuotation.notes && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-[#94a3b8] mb-1">Notes / Terms</h4>
                <p className="text-sm text-white">{selectedQuotation.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
