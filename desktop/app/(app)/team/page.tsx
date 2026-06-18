'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import axios from 'axios';
import { Users, UserPlus, Edit, Power, PowerOff, X, Calendar, Eye } from 'lucide-react';

type Role = 'OWNER' | 'ADMIN' | 'TECHNICIAN';
type Status = 'ACTIVE' | 'INACTIVE';

interface UserData {
  id: string;
  name: string;
  role: Role;
  phone: string;
  dailyWage: number;
  status: Status;
}

interface PerformanceData {
  id: string;
  userId: string;
  name: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendance: Record<number, 'PRESENT' | 'ABSENT' | 'LATE' | 'NONE'>;
}

const MOCK_USERS: UserData[] = [
  { id: '1', name: 'Rahul Sharma', role: 'TECHNICIAN', phone: '9876543210', dailyWage: 800, status: 'ACTIVE' },
  { id: '2', name: 'Amit Kumar', role: 'TECHNICIAN', phone: '9876543211', dailyWage: 700, status: 'ACTIVE' },
  { id: '3', name: 'Sanjay Singh', role: 'ADMIN', phone: '9876543212', dailyWage: 1200, status: 'INACTIVE' },
];

const MOCK_PERFORMANCE: PerformanceData[] = [
  {
    id: 'p1', userId: '1', name: 'Rahul Sharma', presentDays: 20, absentDays: 1, lateDays: 1,
    attendance: { 1: 'PRESENT', 2: 'PRESENT', 3: 'PRESENT', 4: 'ABSENT', 5: 'LATE', 6: 'PRESENT', 7: 'NONE' }
  },
  {
    id: 'p2', userId: '2', name: 'Amit Kumar', presentDays: 18, absentDays: 4, lateDays: 0,
    attendance: { 1: 'PRESENT', 2: 'ABSENT', 3: 'ABSENT', 4: 'PRESENT', 5: 'PRESENT', 6: 'PRESENT', 7: 'NONE' }
  }
];

export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'EMPLOYEES'|'PERFORMANCE'>('EMPLOYEES');
  const [employees, setEmployees] = useState<UserData[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceData | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<Role>('TECHNICIAN');
  const [formWage, setFormWage] = useState<number>(0);

  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      toast.error('Access denied');
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    // Mock fetch
    setEmployees(MOCK_USERS);
    setPerformance(MOCK_PERFORMANCE);
  }, []);

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return null;
  }

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const toggleStatus = (id: string, currentStatus: Status) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : e));
    toast.success('Status updated');
  };

  const getDaysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();

  const renderCalendar = (att: Record<number, 'PRESENT' | 'ABSENT' | 'LATE' | 'NONE'>) => {
    const days = getDaysInMonth(month, year);
    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-[#94a3b8] mb-1">{d}</div>
        ))}
        {Array.from({length: days}, (_, i) => i + 1).map(day => {
          const status = att[day] || 'NONE';
          let color = 'bg-[#334155] text-[#94a3b8]'; // NONE
          if (status === 'PRESENT') color = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50';
          if (status === 'ABSENT') color = 'bg-rose-500/20 text-rose-400 border border-rose-500/50';
          if (status === 'LATE') color = 'bg-amber-500/20 text-amber-400 border border-amber-500/50';
          
          // Offset based on first day of month (simple mock offset: assuming 1st is Mon)
          const isFirst = day === 1;
          const firstDayOffset = new Date(year, month - 1, 1).getDay();
          
          return (
            <div key={day} style={isFirst ? { gridColumnStart: firstDayOffset + 1 } : {}} className={`h-10 rounded flex items-center justify-center text-sm font-medium transition-all hover:opacity-80 ${color}`}>
              {day}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <PageHeader
        title="Team Management"
        subtitle="Manage team members, roles, and attendance"
        actionLabel={activeTab === 'EMPLOYEES' ? "+ Add Employee" : undefined}
        onAction={activeTab === 'EMPLOYEES' ? () => setIsEmployeeModalOpen(true) : undefined}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
        <div className="flex gap-2 bg-[#0f172a] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'EMPLOYEES' ? 'bg-[#334155] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'}`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('PERFORMANCE')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'PERFORMANCE' ? 'bg-[#334155] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'}`}
          >
            Performance
          </button>
        </div>
        {activeTab === 'PERFORMANCE' && (
          <div className="flex gap-3">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc]">
              {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc]">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'EMPLOYEES' && (
        <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
          <table className="w-full text-left text-sm text-[#f8fafc]">
            <thead className="border-b border-[#334155] bg-[#0f172a]/50">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Daily Wage</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className={`border-b border-[#334155] last:border-0 hover:bg-[#334155]/20 ${emp.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                  <td className="p-4 font-medium flex items-center gap-2"><Users size={16} className="text-[#94a3b8]"/> {emp.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${emp.role === 'OWNER' ? 'bg-purple-500/20 text-purple-400' : emp.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="p-4 text-[#cbd5e1]">{emp.phone}</td>
                  <td className="p-4 text-emerald-400 font-medium">{formatCurrency(emp.dailyWage)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${emp.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="p-4 flex justify-end gap-2">
                    <button onClick={() => { setFormName(emp.name); setFormPhone(emp.phone); setFormRole(emp.role); setFormWage(emp.dailyWage); setIsEmployeeModalOpen(true); }} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded" title="Edit"><Edit size={16} /></button>
                    <button onClick={() => toggleStatus(emp.id, emp.status)} className={`p-1.5 rounded ${emp.status === 'ACTIVE' ? 'text-rose-400 hover:bg-rose-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`} title={emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                      {emp.status === 'ACTIVE' ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'PERFORMANCE' && (
        <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
          <table className="w-full text-left text-sm text-[#f8fafc]">
            <thead className="border-b border-[#334155] bg-[#0f172a]/50">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium text-emerald-400">Present</th>
                <th className="p-4 font-medium text-amber-400">Late</th>
                <th className="p-4 font-medium text-rose-400">Absent</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => (
                <tr key={p.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/20">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{p.presentDays} days</td>
                  <td className="p-4">{p.lateDays} days</td>
                  <td className="p-4">{p.absentDays} days</td>
                  <td className="p-4 flex justify-end gap-2">
                    <button onClick={() => { setSelectedPerformance(p); setIsPerformanceModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-400 hover:bg-blue-400/10 rounded text-xs font-medium">
                      <Calendar size={14} /> View Calendar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Employee Details</h2>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-[#94a3b8] hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Full Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Phone</label>
                <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Role</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value as Role)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none">
                  <option value="TECHNICIAN">Technician</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Daily Wage (₹)</label>
                <input type="number" value={formWage} onChange={e => setFormWage(Number(e.target.value))} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsEmployeeModalOpen(false)} className="px-4 py-2 rounded-lg text-white hover:bg-[#334155]">Cancel</button>
              <button onClick={() => { toast.success('Saved successfully'); setIsEmployeeModalOpen(false); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-medium">Save Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Calendar Modal */}
      {isPerformanceModalOpen && selectedPerformance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] w-full max-w-2xl p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPerformance.name}'s Attendance</h2>
                <p className="text-sm text-[#94a3b8] mt-1">{new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setIsPerformanceModalOpen(false)} className="text-[#94a3b8] hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="flex gap-4 mb-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500"></div><span className="text-[#cbd5e1]">Present ({selectedPerformance.presentDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500"></div><span className="text-[#cbd5e1]">Late ({selectedPerformance.lateDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-rose-500"></div><span className="text-[#cbd5e1]">Absent ({selectedPerformance.absentDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#334155]"></div><span className="text-[#cbd5e1]">No Record</span></div>
            </div>

            <div className="bg-[#0f172a] p-4 rounded-xl border border-[#334155]">
              {renderCalendar(selectedPerformance.attendance)}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsPerformanceModalOpen(false)} className="px-4 py-2 rounded-lg text-white hover:bg-[#334155]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
