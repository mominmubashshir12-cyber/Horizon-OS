'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiGet, apiPut } from '@/services/api';

export default function FlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchFlags = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiGet<any[]>('/antifraud');
      if (res.success) {
        setFlags(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch flags');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const openReviewModal = (flag: any) => {
    setSelectedFlag(flag);
    setReviewNotes('');
    setIsModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPut(`/antifraud/${selectedFlag.id}/review`, { reviewNotes });
      if (res.success) {
        toast.success('Flag reviewed successfully');
        setIsModalOpen(false);
        fetchFlags();
      }
    } catch (err: any) {
      toast.error('Failed to submit review');
    }
  };

  const columns: Column<any>[] = [
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val as string).toLocaleString() },
    { key: 'flagType', label: 'Type', render: (val) => <span className="text-red-400 font-bold">{val}</span> },
    { key: 'user', label: 'Employee', render: (_, row) => row.user?.fullName },
    { key: 'product', label: 'Product', render: (_, row) => row.product?.name },
    { key: 'details', label: 'Details' },
    { key: 'status', label: 'Status', render: (_, row) => (row.reviewed ? <span className="text-green-400">Reviewed</span> : <span className="text-yellow-400">Pending</span>) },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        !row.reviewed && (
          <button onClick={() => openReviewModal(row)} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
            <CheckCircle2 size={14} /> Review
          </button>
        ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader title="Anti-Fraud Flags" subtitle="Review anomalous transactions and pricing overrides" />

      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading flags...</div>
      ) : (
        <DataTable columns={columns} data={flags} emptyMessage="No anti-fraud flags found." />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Review Flag"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div className="rounded-lg bg-[#0f172a] p-4 border border-[#334155]">
            <p className="text-sm font-semibold text-red-400 mb-2">{selectedFlag?.flagType}</p>
            <p className="text-sm text-slate-300">{selectedFlag?.details}</p>
            <p className="text-xs text-slate-500 mt-2">By: {selectedFlag?.user?.fullName}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Review Notes</label>
            <textarea
              rows={3}
              required
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              placeholder="Acknowledge or note actions taken..."
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[#334155] pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-[#334155] bg-transparent px-4 py-2 text-sm font-semibold text-[#94a3b8] hover:bg-[#0f172a] hover:text-[#f8fafc]"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
              Mark as Reviewed
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
