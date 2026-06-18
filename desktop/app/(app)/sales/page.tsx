'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiGet, apiPost, apiPut } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Sale, AntifraudFlag, User } from '@/types';
import { AlertTriangle, X } from 'lucide-react';

export default function SalesPage() {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [sales, setSales] = useState<Sale[]>([]);
  const [flags, setFlags] = useState<AntifraudFlag[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRecordSaleOpen, setIsRecordSaleOpen] = useState(false);
  const [reviewingFlag, setReviewingFlag] = useState<AntifraudFlag | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Record Sale Form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    quantity: 1,
    unitPrice: 0,
    userId: user?.id?.toString() || '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [salesRes, flagsRes] = await Promise.all([
        apiGet<Sale[]>('/sales'),
        isOwnerAdmin ? apiGet<AntifraudFlag[]>('/antifraud/flags?reviewed=false') : Promise.resolve({ success: true, data: [] }),
      ]);
      if (salesRes.success) setSales(salesRes.data);
      if (flagsRes.success && isOwnerAdmin) {
        setFlags(flagsRes.data);
        window.dispatchEvent(new CustomEvent('update-fraud-badge', { detail: flagsRes.data.length }));
      }
    } catch (err: unknown) {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [isOwnerAdmin]);

  const fetchEmployees = useCallback(async () => {
    if (!isOwnerAdmin) return;
    try {
      const res = await apiGet<User[]>('/users');
      if (res.success) setEmployees(res.data);
    } catch (err) {
      // ignore
    }
  }, [isOwnerAdmin]);

  useEffect(() => {
    fetchData();
    fetchEmployees();
  }, [fetchData, fetchEmployees]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await apiGet<Product[]>(`/products/lookup?q=${encodeURIComponent(searchQuery)}`);
        if (res.success) setSearchResults(res.data);
      } catch (err) {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setFormData({ ...formData, unitPrice: p.customerPrice });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || formData.quantity <= 0 || formData.unitPrice <= 0) {
      toast.error('Please select a valid product and enter valid quantity and price');
      return;
    }

    try {
      const payload: Record<string, string | number> = {
        productId: selectedProduct.id,
        quantity: formData.quantity,
        unitPrice: formData.unitPrice,
        notes: formData.notes,
      };
      if (isOwnerAdmin && formData.userId) {
        payload.userId = parseInt(formData.userId, 10);
      }
      const res = await apiPost<Sale>('/sales', payload);
      if (res.success) {
        toast.success('Sale recorded successfully!');
        setIsRecordSaleOpen(false);
        setSelectedProduct(null);
        setFormData({
          quantity: 1,
          unitPrice: 0,
          userId: user?.id?.toString() || '',
          notes: '',
        });
        fetchData();
      }
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Transaction blocked or failed.');
    }
  };

  const handleReviewFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingFlag) return;
    try {
      const res = await apiPut(`/antifraud/flags/${reviewingFlag.id}/review`, { reviewNotes });
      if (res.success) {
        toast.success('Flag marked as reviewed');
        setReviewingFlag(null);
        setReviewNotes('');
        fetchData();
      }
    } catch (err: unknown) {
      toast.error('Failed to review flag');
    }
  };

  const dismissFlag = (id: number) => {
    const updated = flags.filter(f => f.id !== id);
    setFlags(updated);
    window.dispatchEvent(new CustomEvent('update-fraud-badge', { detail: updated.length }));
  };

  const columns: Column<Sale>[] = [
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
    { key: 'productName', label: 'Product', render: (_, row: Sale) => row.product?.name },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitPrice', label: 'Price', render: (val) => `₹${Number(val).toLocaleString('en-IN')}` },
    { key: 'totalAmount', label: 'Total', render: (val) => `₹${Number(val).toLocaleString('en-IN')}` },
    { key: 'user', label: 'Sold By', render: (_, row: Sale) => row.user?.fullName },
  ];

  if (isOwnerAdmin) {
    columns.push({
      key: 'marginAmount',
      label: 'Margin',
      render: (val, row: Sale) => (
        <span className="text-emerald-400">
          ₹{Number(val).toLocaleString('en-IN')} ({Number(row.marginPercent).toFixed(1)}%)
        </span>
      ),
    });
  }

  const isPriceValid = selectedProduct && formData.unitPrice >= selectedProduct.minSellingPrice && formData.unitPrice <= selectedProduct.maxSellingPrice;
  const priceColor = !selectedProduct ? 'text-white' : isPriceValid ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader
        title="Point of Sale"
        subtitle="Record new sales and view transaction history"
        actionLabel="Record Sale"
        onAction={() => setIsRecordSaleOpen(true)}
      />

      {isOwnerAdmin && flags.length > 0 && (
        <div className="mb-8 space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="flex items-center justify-between rounded-lg bg-red-500/20 border border-red-500/50 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-400" size={24} />
                <div>
                  <p className="font-semibold text-red-400">
                    Fraud Alert: {flag.user?.fullName} - {flag.product?.name}
                  </p>
                  <p className="text-sm text-red-300">
                    Type: {flag.flagType} | Consecutive: {flag.consecutiveCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setReviewingFlag(flag); setReviewNotes(''); }}
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Review
                </button>
                <button onClick={() => dismissFlag(flag.id)} className="text-red-400 hover:text-red-300">
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-4 text-sm font-bold tracking-wide text-[#f8fafc]">Recent Transactions</h3>
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading sales...</div>
        ) : (
          <DataTable columns={columns} data={sales} emptyMessage="No sales recorded." />
        )}
      </div>

      <Modal isOpen={isRecordSaleOpen} onClose={() => setIsRecordSaleOpen(false)} title="Record New Sale" size="lg">
        <form onSubmit={handleRecordSale} className="space-y-6">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-slate-400">Product Search</label>
            {!selectedProduct ? (
              <>
                <input
                  type="text"
                  placeholder="Type to search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                />
                {isSearching && <div className="absolute right-3 top-8 text-xs text-slate-400">Searching...</div>}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#334155] bg-[#1e293b] shadow-lg">
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="cursor-pointer border-b border-[#334155] px-4 py-2 hover:bg-[#0f172a]"
                      >
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="flex gap-4 text-xs text-slate-400">
                          <span>Stock: {p.currentStock}</span>
                          <span>Price Range: ₹{p.minSellingPrice.toLocaleString('en-IN')} - ₹{p.maxSellingPrice.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2">
                <div>
                  <div className="font-semibold text-white">{selectedProduct.name}</div>
                  <div className="text-xs text-slate-400">Stock: {selectedProduct.currentStock} | Min: ₹{selectedProduct.minSellingPrice.toLocaleString('en-IN')} | Max: ₹{selectedProduct.maxSellingPrice.toLocaleString('en-IN')}</div>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                className={`w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm outline-none focus:border-blue-500 ${priceColor}`}
              />
              {selectedProduct && !isPriceValid && (
                <p className="mt-1 text-xs text-red-400">Price is outside allowed range!</p>
              )}
            </div>
          </div>

          {isOwnerAdmin && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Employee</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#334155]">
            <button type="button" onClick={() => setIsRecordSaleOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-[#334155]">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Confirm Sale</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!reviewingFlag} onClose={() => setReviewingFlag(null)} title="Review Fraud Flag">
        <form onSubmit={handleReviewFlag} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Review Notes</label>
            <textarea
              required
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none min-h-[100px]"
              placeholder="Enter explanation and actions taken..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setReviewingFlag(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-[#334155]">Cancel</button>
            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Submit Review</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
