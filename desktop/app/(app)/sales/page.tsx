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
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
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
        apiGet<any>(`/sales?page=${currentPage}&limit=50`),
        isOwnerAdmin ? apiGet<AntifraudFlag[]>('/antifraud?reviewed=false') : Promise.resolve({ success: true, data: [] }),
      ]);
      if (salesRes.success) {
        setSales(salesRes.data.data || []);
        setTotalPages(salesRes.data.totalPages || 1);
      }
      if (flagsRes.success && isOwnerAdmin) {
        setFlags(flagsRes.data as AntifraudFlag[]);
        window.dispatchEvent(new CustomEvent('update-fraud-badge', { detail: (flagsRes.data as AntifraudFlag[]).length }));
      }
    } catch (err: unknown) {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [isOwnerAdmin, currentPage]);

  const fetchEmployees = useCallback(async () => {
    if (!isOwnerAdmin) return;
    try {
      const res = await apiGet<{ data: User[] }>('/users');
      if (res.success) setEmployees(res.data.data ?? []);
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
        <span className="text-[#22c55e]">
          ₹{Number(val).toLocaleString('en-IN')} ({Number(row.marginPercent).toFixed(1)}%)
        </span>
      ),
    });
  }

  const isPriceValid = selectedProduct && formData.unitPrice >= selectedProduct.minSellingPrice && formData.unitPrice <= selectedProduct.maxSellingPrice;
  const priceColor = !selectedProduct ? 'text-white' : isPriceValid ? 'text-[#22c55e]' : 'text-[#ef4444]';
  const inputClasses = "input";

  return (
    <div className="flex-1 overflow-auto p-8 space-y-6">
      <PageHeader
        title="Point of Sale"
        subtitle="Record new sales and view transaction history"
        actionLabel="Record Sale"
        onAction={() => setIsRecordSaleOpen(true)}
      />

      {isOwnerAdmin && flags.length > 0 && (
        <div className="space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="flex items-center justify-between rounded-xl bg-red-500/5 border border-red-500/20 p-4">
              <div className="flex items-center gap-4">
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <AlertTriangle className="text-[#ef4444]" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">
                    Fraud Alert: <span className="font-normal text-[#a1a1aa]">{flag.user?.fullName} - {flag.product?.name}</span>
                  </p>
                  <p className="text-xs text-[#ef4444] mt-1 uppercase tracking-wide">
                    Type: {flag.flagType} • Consecutive: {flag.consecutiveCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setReviewingFlag(flag); setReviewNotes(''); }}
                  className="bg-transparent border border-white/5 hover:border-[#ef4444] text-[#a1a1aa] hover:text-[#ef4444] text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
                >
                  Review
                </button>
                <button onClick={() => dismissFlag(flag.id)} className="text-[#52525b] hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="p-6 bg-white/5 border-b border-white/5">
          <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">Recent Transactions</h3>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-[#52525b] text-sm">Loading sales...</div>
        ) : (
          <DataTable 
            columns={columns} 
            data={sales} 
            emptyMessage="No sales recorded." 
            pagination={{
              currentPage,
              totalPages,
              onPageChange: (page) => setCurrentPage(page)
            }}
          />
        )}
      </div>

      <Modal isOpen={isRecordSaleOpen} onClose={() => setIsRecordSaleOpen(false)} title="Record New Sale" size="lg">
        <form onSubmit={handleRecordSale} className="space-y-4">
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Product Search</label>
            {!selectedProduct ? (
              <>
                <input
                  type="text"
                  placeholder="Type to search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={inputClasses}
                />
                {isSearching && <div className="absolute right-3 top-8 text-xs text-[#52525b]">Searching...</div>}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 max-h-60 overflow-y-auto rounded-lg border border-white/5 glass-panel shadow-2xl">
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="cursor-pointer border-b border-white/5 last:border-0 px-4 py-3 hover:bg-[#1f1f1f] transition-colors"
                      >
                        <div className="font-medium text-white text-sm">{p.name}</div>
                        <div className="flex gap-4 text-xs text-[#a1a1aa] mt-1 uppercase tracking-wide">
                          <span>Stock: {p.currentStock}</span>
                          <span>Price Range: ₹{p.minSellingPrice.toLocaleString('en-IN')} - ₹{p.maxSellingPrice.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0a0e14] px-4 py-3">
                <div>
                  <div className="font-medium text-white text-sm">{selectedProduct.name}</div>
                  <div className="text-xs text-[#a1a1aa] mt-1 uppercase tracking-wide">Stock: {selectedProduct.currentStock} • Min: ₹{selectedProduct.minSellingPrice.toLocaleString('en-IN')} • Max: ₹{selectedProduct.maxSellingPrice.toLocaleString('en-IN')}</div>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-[#52525b] hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 0 })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                className={`w-full bg-[#0a0e14] border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0070f3] transition-colors duration-150 ${priceColor}`}
              />
              {selectedProduct && !isPriceValid && (
                <p className="mt-1.5 text-xs text-[#ef4444]">Price is outside allowed range!</p>
              )}
            </div>
          </div>

          {isOwnerAdmin && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Employee</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className={inputClasses}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={`${inputClasses} min-h-[80px]`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsRecordSaleOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Confirm Sale</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!reviewingFlag} onClose={() => setReviewingFlag(null)} title="Review Fraud Flag">
        <form onSubmit={handleReviewFlag} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Review Notes</label>
            <textarea
              required
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className={`${inputClasses} min-h-[100px]`}
              placeholder="Enter explanation and actions taken..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReviewingFlag(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="bg-transparent border border-white/5 hover:border-red-800 text-[#a1a1aa] hover:text-[#ef4444] text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150">Submit Review</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
