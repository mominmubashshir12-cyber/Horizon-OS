'use client';

import React, { useEffect, useState } from 'react';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    firmName: '',
    firmAddress: '',
    firmGstin: '',
    firmPhone: '',
    standardCheckInTime: '09:00',
    autoCheckoutTime: '22:00',
    maxLunchDurationMins: 60,
    workingDaysPerMonth: 26,
    overtimeMultiplier: 1.5,
    absentPenaltyRate: 1.0,
    globalLowStockThreshold: 5,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data.success && res.data.data) {
        setFormData({
          firmName: res.data.data.firmName || '',
          firmAddress: res.data.data.firmAddress || '',
          firmGstin: res.data.data.firmGstin || '',
          firmPhone: res.data.data.firmPhone || '',
          standardCheckInTime: res.data.data.standardCheckInTime || '09:00',
          autoCheckoutTime: res.data.data.autoCheckoutTime || '22:00',
          maxLunchDurationMins: res.data.data.maxLunchDurationMins || 60,
          workingDaysPerMonth: res.data.data.workingDaysPerMonth || 26,
          overtimeMultiplier: res.data.data.overtimeMultiplier || 1.5,
          absentPenaltyRate: res.data.data.absentPenaltyRate || 1.0,
          globalLowStockThreshold: res.data.data.globalLowStockThreshold || 5,
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put('/settings', formData);
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully.' });
      } else {
        setMessage({ type: 'error', text: res.data.message || 'Failed to save settings.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  if (loading) {
    return (
      <div className="p-8 flex-1 flex items-center justify-center bg-[#0a0e14]">
        <p className="text-[#a1a1aa]">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex-1 overflow-auto bg-[#0a0e14]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Manage firm configuration and operational rules</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-3 p-4 rounded-lg border ${message.type === 'success' ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]' : 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8 pb-20">
        
        {/* Firm Details */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-medium text-white mb-4">Firm Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Firm Name</label>
              <input type="text" name="firmName" value={formData.firmName} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">GSTIN</label>
              <input type="text" name="firmGstin" value={formData.firmGstin} onChange={handleChange} className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Phone</label>
              <input type="text" name="firmPhone" value={formData.firmPhone} onChange={handleChange} className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Address</label>
              <input type="text" name="firmAddress" value={formData.firmAddress} onChange={handleChange} className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
          </div>
        </section>

        {/* Attendance Rules */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-medium text-white mb-4">Attendance Rules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Standard Check-In Time</label>
              <input type="time" name="standardCheckInTime" value={formData.standardCheckInTime} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Auto-Checkout Time</label>
              <input type="time" name="autoCheckoutTime" value={formData.autoCheckoutTime} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Max Lunch Duration (mins)</label>
              <input type="number" min="0" name="maxLunchDurationMins" value={formData.maxLunchDurationMins} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
          </div>
        </section>

        {/* Payroll Rules */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-medium text-white mb-4">Payroll Rules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Working Days Per Month</label>
              <input type="number" min="1" max="31" name="workingDaysPerMonth" value={formData.workingDaysPerMonth} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Overtime Multiplier</label>
              <input type="number" step="0.1" min="1" name="overtimeMultiplier" value={formData.overtimeMultiplier} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Absent Penalty Rate</label>
              <input type="number" step="0.1" min="0" name="absentPenaltyRate" value={formData.absentPenaltyRate} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
          </div>
        </section>

        {/* Alert Thresholds */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-medium text-white mb-4">Alert Thresholds</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Global Low Stock Threshold</label>
              <input type="number" min="0" name="globalLowStockThreshold" value={formData.globalLowStockThreshold} onChange={handleChange} required className="w-full bg-[#121820] border border-white/5 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0070f3]" />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#0070f3] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0070f3]/90 focus:outline-none focus:ring-2 focus:ring-[#0070f3]/50 disabled:opacity-50">
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
