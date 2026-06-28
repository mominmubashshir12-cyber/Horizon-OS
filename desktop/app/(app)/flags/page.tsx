'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, X } from 'lucide-react';
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

  return (
    <div className="p-8 flex-1 overflow-auto bg-[#0a0e14]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Anti-Fraud Flags</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Review anomalous transactions and pricing overrides</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#52525b]">Loading flags...</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                <tr>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Employee</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Product</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Details</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {flags.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#52525b]">No anti-fraud flags found.</td></tr>
                ) : (
                  flags.map(row => (
                    <tr key={row.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                      <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#ef4444]">{row.flagType}</td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{row.user?.fullName}</td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{row.product?.name}</td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{row.details}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.reviewed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#22c55e]/10 text-[#22c55e]">Reviewed</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#f59e0b]/10 text-[#f59e0b]">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!row.reviewed && (
                          <button onClick={() => openReviewModal(row)} className="flex items-center gap-1.5 text-sm font-medium text-[#0070f3] hover:text-[#0060d3] transition-colors">
                            <CheckCircle2 size={16} /> Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Review Flag</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#52525b] hover:text-white transition-colors duration-150"><X size={20}/></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="glass-card p-4">
                <p className="text-sm font-medium text-[#ef4444] mb-2">{selectedFlag?.flagType}</p>
                <p className="text-sm text-[#a1a1aa]">{selectedFlag?.details}</p>
                <p className="text-xs text-[#52525b] mt-3">By: {selectedFlag?.user?.fullName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Review Notes</label>
                <textarea
                  rows={3}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="input"
                  placeholder="Acknowledge or note actions taken..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Mark as Reviewed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
