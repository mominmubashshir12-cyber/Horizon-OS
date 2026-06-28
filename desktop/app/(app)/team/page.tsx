'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut } from '@/services/api';
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

  const fetchEmployees = async () => {
    try {
      const res = await apiGet<any[]>('/users');
      const mapped: UserData[] = ((res.data as any).data ?? res.data ?? []).map((u: any) => ({
        id: String(u.id),
        name: u.fullName,
        role: (u.role === 'PERM_EMPLOYEE' ? 'TECHNICIAN' : u.role) as Role,
        phone: u.phone || '',
        dailyWage: u.baseSalary || 0,
        status: (u.isActive ? 'ACTIVE' : 'INACTIVE') as Status
      }));
      setEmployees(mapped);
    } catch (error) {
      console.error('Failed to fetch employees', error);
      toast.error('Failed to load employees');
    }
  };

  useEffect(() => {
    fetchEmployees();
    setPerformance(MOCK_PERFORMANCE);
  }, []);

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return null;
  }

  const formatCurrency = (val: any) => `₹${val.toLocaleString('en-IN')}`;

  const toggleStatus = async (id: string, currentStatus: Status) => {
    try {
      const newActive = currentStatus !== 'ACTIVE';
      await apiPut(`/users/${id}`, { isActive: newActive });
      setEmployees(employees.map(e => e.id === id ? { ...e, status: newActive ? 'ACTIVE' : 'INACTIVE' } : e));
      toast.success('Status updated');
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleSaveEmployee = async () => {
    if (!formName || !formPhone) {
      toast.error('Name and Phone are required');
      return;
    }
    
    try {
      const defaultUsername = formPhone; 
      const defaultPassword = 'horizon123'; 
      
      await apiPost('/users', {
        username: defaultUsername,
        password: defaultPassword,
        fullName: formName,
        phone: formPhone,
        role: formRole === 'TECHNICIAN' ? 'PERM_EMPLOYEE' : formRole,
        baseSalary: formWage,
      });
      
      toast.success('Employee saved successfully. Default password is: horizon123');
      setIsEmployeeModalOpen(false);
      
      setFormName('');
      setFormPhone('');
      setFormRole('TECHNICIAN');
      setFormWage(0);
      
      fetchEmployees();
    } catch (error: any) {
      console.error('Save failed', error);
      toast.error(error?.response?.data?.message || 'Failed to save employee');
    }
  };

  const getDaysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();

  const renderCalendar = (att: Record<number, 'PRESENT' | 'ABSENT' | 'LATE' | 'NONE'>) => {
    const days = getDaysInMonth(month, year);
    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-[#52525b] uppercase tracking-wide mb-1">{d}</div>
        ))}
        {Array.from({length: days}, (_, i) => i + 1).map(day => {
          const status = att[day] || 'NONE';
          let color = 'glass-card-compact text-[#52525b]'; // NONE
          if (status === 'PRESENT') color = 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30';
          if (status === 'ABSENT') color = 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30';
          if (status === 'LATE') color = 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30';
          
          // Offset based on first day of month
          const isFirst = day === 1;
          const firstDayOffset = new Date(year, month - 1, 1).getDay();
          
          return (
            <div key={day} style={isFirst ? { gridColumnStart: firstDayOffset + 1 } : {}} className={`h-10 rounded-lg flex items-center justify-center text-sm font-medium ${color}`}>
              {day}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-8 flex-1 overflow-auto bg-[#0a0e14]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Team Management</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Manage team members, roles, and attendance</p>
        </div>
        {activeTab === 'EMPLOYEES' && (
          <button onClick={() => setIsEmployeeModalOpen(true)} className="btn btn-primary">
            + Add Employee
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-6 border-b border-white/5 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'EMPLOYEES' ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('PERFORMANCE')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'PERFORMANCE' ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
          >
            Performance
          </button>
        </div>
        {activeTab === 'PERFORMANCE' && (
          <div className="flex gap-3">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input">
              {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'EMPLOYEES' && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Phone</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Daily Wage</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {employees.map(emp => (
                <tr key={emp.id} className={`hover:bg-[#1f1f1f] transition-colors duration-100 ${emp.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-sm text-white font-medium flex items-center gap-2"><Users size={16} className="text-[#a1a1aa]"/> {emp.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${emp.role === 'OWNER' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : emp.role === 'ADMIN' ? 'bg-[#0070f3]/10 text-[#0070f3]' : 'bg-[#52525b]/10 text-[#a1a1aa]'}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.phone}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{formatCurrency(emp.dailyWage)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${emp.status === 'ACTIVE' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex justify-end gap-2">
                    <button onClick={() => { setFormName(emp.name); setFormPhone(emp.phone); setFormRole(emp.role); setFormWage(emp.dailyWage); setIsEmployeeModalOpen(true); }} className="text-[#a1a1aa] hover:text-white transition-colors p-1" title="Edit"><Edit size={16} /></button>
                    <button onClick={() => toggleStatus(emp.id, emp.status)} className={`p-1 transition-colors ${emp.status === 'ACTIVE' ? 'text-[#a1a1aa] hover:text-[#ef4444]' : 'text-[#a1a1aa] hover:text-[#22c55e]'}`} title={emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
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
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-xs font-medium text-[#22c55e] uppercase tracking-wider px-4 py-3">Present</th>
                <th className="text-xs font-medium text-[#f59e0b] uppercase tracking-wider px-4 py-3">Late</th>
                <th className="text-xs font-medium text-[#ef4444] uppercase tracking-wider px-4 py-3">Absent</th>
                <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {performance.map(p => (
                <tr key={p.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                  <td className="px-4 py-3 text-sm text-white font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-[#a1a1aa]">{p.presentDays} days</td>
                  <td className="px-4 py-3 text-sm text-[#a1a1aa]">{p.lateDays} days</td>
                  <td className="px-4 py-3 text-sm text-[#a1a1aa]">{p.absentDays} days</td>
                  <td className="px-4 py-3 flex justify-end gap-2">
                    <button onClick={() => { setSelectedPerformance(p); setIsPerformanceModalOpen(true); }} className="flex items-center gap-1.5 text-sm font-medium text-[#0070f3] hover:text-[#0060d3] transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Employee Details</h2>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-[#52525b] hover:text-white transition-colors duration-150"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Full Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Phone</label>
                <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Role</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value as Role)} className="input">
                  <option value="TECHNICIAN">Technician</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Daily Wage (₹)</label>
                <input type="number" value={formWage} onChange={e => setFormWage(Number(e.target.value))} className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsEmployeeModalOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSaveEmployee} className="btn btn-primary">Save Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Calendar Modal */}
      {isPerformanceModalOpen && selectedPerformance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-w-lg mx-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedPerformance.name}'s Attendance</h2>
                <p className="text-sm text-[#a1a1aa] mt-1">{new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setIsPerformanceModalOpen(false)} className="text-[#52525b] hover:text-white transition-colors duration-150"><X size={20} /></button>
            </div>
            
            <div className="flex gap-4 mb-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#22c55e]"></div><span className="text-[#a1a1aa]">Present ({selectedPerformance.presentDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#f59e0b]"></div><span className="text-[#a1a1aa]">Late ({selectedPerformance.lateDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div><span className="text-[#a1a1aa]">Absent ({selectedPerformance.absentDays})</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#2a2a2a]"></div><span className="text-[#a1a1aa]">No Record</span></div>
            </div>

            <div className="bg-[#0a0e14] p-4 rounded-xl border border-white/5">
              {renderCalendar(selectedPerformance.attendance)}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsPerformanceModalOpen(false)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
