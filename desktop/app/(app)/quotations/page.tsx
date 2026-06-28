'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { apiGet, apiPost } from '@/services/api';
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

  const fetchQuotations = async () => {
    try {
      const res = await apiGet<any>('/quotations');
      if (res.success) {
        setQuotations(res.data.data || []);
      }
    } catch (error) {
      toast.error('Failed to load quotations');
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleConvertToJob = async (id: string) => {
    if (!confirm('Convert this quotation to a new Job Card?')) return;
    try {
      const res = await apiPost(`/quotations/${id}/convert-to-job`);
      if ((res as any).success) {
        toast.success('Quotation converted to Job Card successfully!');
        fetchQuotations();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to convert to Job Card');
    }
  };

  const formatCurrency = (val: any) => `₹${val.toLocaleString('en-IN')}`;
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

  const inputClasses = "input";

  return (
    <div className="flex-1 overflow-auto p-8 space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Create, send, and track client quotations"
        actionLabel="+ New Quotation"
        onAction={() => setIsCreateModalOpen(true)}
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pending', value: stats.pending, color: 'text-[#f59e0b]' },
          { label: 'Accepted', value: stats.accepted, color: 'text-[#22c55e]' },
          { label: 'Converted', value: stats.converted, color: 'text-[#0070f3]' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">{s.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" size={16} />
          <input
            type="text"
            placeholder="Search by client or quotation number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClasses} pl-10`}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={`${inputClasses} w-auto`}
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
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm text-[#a1a1aa]">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Quotation #</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Client Name</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Grand Total</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Created Date</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Valid Until</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Assigned To</th>
              <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotations.map(q => (
              <tr key={q.id} className="border-b border-[#1f1f1f] hover:bg-[#1f1f1f] transition-colors duration-100">
                <td className="px-4 py-3 text-white font-medium">{q.quotationNumber}</td>
                <td className="px-4 py-3 text-white">{q.clientName}</td>
                <td className="px-4 py-3">{formatCurrency(q.grandTotal)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                    q.status === 'ACCEPTED' ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                    q.status === 'DRAFT' ? 'bg-[#52525b]/10 text-[#a1a1aa]' :
                    q.status === 'SENT' ? 'bg-[#0070f3]/10 text-[#0070f3]' :
                    q.status === 'CONVERTED' ? 'bg-[#a855f7]/10 text-[#a855f7]' :
                    'bg-[#ef4444]/10 text-[#ef4444]'
                  }`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3">{formatDateIST(q.createdDate)}</td>
                <td className="px-4 py-3">{formatDateIST(q.validUntil)}</td>
                <td className="px-4 py-3">{q.assignedTo}</td>
                <td className="px-4 py-3 flex justify-end gap-2">
                  <button onClick={() => { setSelectedQuotation(q); setIsViewModalOpen(true); }} className="text-[#a1a1aa] hover:text-[#0070f3] transition-colors" title="View"><Eye size={16} /></button>
                  {user?.role === 'OWNER' && (
                    <>
                      <button disabled={q.status === 'CONVERTED' || q.status === 'EXPIRED'} className="text-[#a1a1aa] hover:text-[#f59e0b] disabled:opacity-30 disabled:hover:text-[#a1a1aa] transition-colors" title="Edit"><Edit size={16} /></button>
                      <button disabled={q.status !== 'DRAFT'} className="text-[#a1a1aa] hover:text-[#0070f3] disabled:opacity-30 disabled:hover:text-[#a1a1aa] transition-colors" title="Send"><Send size={16} /></button>
                      {q.status === 'ACCEPTED' && (
                        <button onClick={() => handleConvertToJob(q.id)} className="text-[#a1a1aa] hover:text-[#22c55e] transition-colors" title="Convert to Job Card"><CheckCircle size={16} /></button>
                      )}
                      <button disabled={q.status !== 'DRAFT'} className="text-[#a1a1aa] hover:text-[#ef4444] disabled:opacity-30 disabled:hover:text-[#a1a1aa] transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredQuotations.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#52525b]">No quotations found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Create Quotation</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#52525b] hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Client Name</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Phone</label>
                <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inputClasses} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Address</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Validity (Days)</label>
                <input type="number" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inputClasses} />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-white">Line Items</h3>
                <button onClick={handleAddItem} className="text-xs bg-transparent border border-white/5 hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors duration-150">
                  <Plus size={14} /> Add Item
                </button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start glass-card-compact">
                    <div className="flex-1">
                      <input placeholder="Description" type="text" value={item.description} onChange={e => handleUpdateItem(index, 'description', e.target.value)} className={inputClasses} />
                    </div>
                    <div className="w-20">
                      <input placeholder="Qty" type="number" value={item.qty} onChange={e => handleUpdateItem(index, 'qty', Number(e.target.value))} className={inputClasses} />
                    </div>
                    <div className="w-28">
                      <input placeholder="Unit Price" type="number" value={item.unitPrice} onChange={e => handleUpdateItem(index, 'unitPrice', Number(e.target.value))} className={inputClasses} />
                    </div>
                    <div className="w-20">
                      <input placeholder="Tax %" type="number" value={item.taxPercent} onChange={e => handleUpdateItem(index, 'taxPercent', Number(e.target.value))} className={inputClasses} />
                    </div>
                    <div className="w-28 flex items-center h-9 px-3">
                      <span className="text-sm font-medium text-white">{formatCurrency(item.amount || 0)}</span>
                    </div>
                    <button onClick={() => handleRemoveItem(index)} className="text-[#52525b] hover:text-[#ef4444] transition-colors mt-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-right">
                <span className="text-sm font-medium text-[#a1a1aa] mr-4">Running Total:</span>
                <span className="text-2xl font-semibold text-white">{formatCurrency(liveGrandTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-8 border-t border-white/5 pt-6">
              <button onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => { toast.success('Quotation Created!'); setIsCreateModalOpen(false); }} className="btn btn-primary">Save Quotation</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Quotation {selectedQuotation.quotationNumber}</h2>
                <p className="text-xs text-[#a1a1aa]">Created: {formatDateIST(selectedQuotation.createdDate)} • Valid until: {formatDateIST(selectedQuotation.validUntil)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generatePdf(selectedQuotation)} className="flex items-center gap-2 btn btn-primary">
                  <Download size={16} /> Generate PDF
                </button>
                <button onClick={() => setIsViewModalOpen(false)} className="text-[#52525b] hover:text-white p-2 transition-colors"><X size={20} /></button>
              </div>
            </div>

            <div className="glass-card mb-6">
              <h3 className="text-xs font-medium text-[#52525b] uppercase tracking-wider mb-2">Bill To</h3>
              <p className="text-base font-medium text-white">{selectedQuotation.clientName}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">{selectedQuotation.clientAddress}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">Phone: {selectedQuotation.clientPhone}</p>
            </div>

            <div className="mb-6 glass-card overflow-hidden !p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-right">Qty</th>
                    <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-right">Unit Price</th>
                    <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-right">Tax</th>
                    <th className="px-4 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-[#a1a1aa]">
                  {selectedQuotation.items.map(it => (
                    <tr key={it.id} className="border-b border-white/5 last:border-0 hover:bg-[#1f1f1f] transition-colors duration-100">
                      <td className="px-4 py-3">{it.description}</td>
                      <td className="px-4 py-3 text-right">{it.qty}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(it.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">{it.taxPercent}%</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-4 border-t border-white/5">
                  <span className="text-sm font-medium text-[#a1a1aa]">Grand Total</span>
                  <span className="text-xl font-semibold text-white">{formatCurrency(selectedQuotation.grandTotal)}</span>
                </div>
              </div>
            </div>

            {selectedQuotation.notes && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-[#52525b] uppercase tracking-wider mb-2">Notes & Terms</h4>
                <p className="text-sm text-[#a1a1aa]">{selectedQuotation.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
