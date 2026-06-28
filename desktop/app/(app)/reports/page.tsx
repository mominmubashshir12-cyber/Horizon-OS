'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { Download, FileText, CheckCircle, Table, BarChart3, Users, Package, IndianRupee } from 'lucide-react';

const PIE_COLORS = ['#0070f3', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MOCK_PERFORMANCE = [
  { id: '1', empName: 'Rahul Sharma', jobsCompleted: 15, rating: 4.8, attendanceScore: '95%' },
  { id: '2', empName: 'Amit Kumar', jobsCompleted: 8, rating: 4.1, attendanceScore: '80%' },
];

const MOCK_INVENTORY = [
  { id: '1', material: 'CAT6 Cable', used: 450, unit: 'meters', cost: 13500 },
  { id: '2', material: 'RJ45 Connectors', used: 120, unit: 'pcs', cost: 1200 },
];

const MOCK_SALES_DAILY = [
  { day: '01', revenue: 4000 }, { day: '02', revenue: 3000 }, { day: '03', revenue: 5000 },
  { day: '04', revenue: 8000 }, { day: '05', revenue: 2000 }, { day: '06', revenue: 9000 },
  { day: '07', revenue: 7500 },
];

const MOCK_SALES_EMP = [
  { name: 'Rahul S.', value: 45000 },
  { name: 'Amit K.', value: 22000 },
  { name: 'Priya S.', value: 31000 },
  { name: 'Vikram D.', value: 15000 },
  { name: 'Neha J.', value: 28000 },
  { name: 'Anil T.', value: 19000 },
  { name: 'Manoj P.', value: 12000 },
];

const MOCK_SALES_CAT = [
  { category: 'Installation', revenue: 85000 },
  { category: 'Repair', revenue: 42000 },
  { category: 'Maintenance', revenue: 31000 },
];

import { apiGet, apiPost } from '@/services/api';
import { generatePayslipPdf } from '@/services/pdfGenerator';

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'EMPLOYEE'|'INVENTORY'|'SALES'|'CASHFLOW'>('EMPLOYEE');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [employeeStats, setEmployeeStats] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchEmployeeReports = async () => {
    try {
      // Fetch all active users
      const usersRes = await apiGet<any[]>('/users');
      // Fetch reports for the selected month/year
      const reportsRes = await apiGet<any[]>(`/reports/employees/${year}/${month}`);
      
      const users = ((usersRes.data as any).data ?? usersRes.data) || [];
      const reports = ((reportsRes.data as any).data ?? reportsRes.data) || [];

      // Merge users with their reports
      const stats = users.map((u: any) => {
        const report = reports.find((r: any) => r.userId === u.id);
        return {
          id: u.id,
          empName: u.fullName,
          jobsCompleted: report ? report.jobsCompleted : '-',
          rating: report ? (report.disciplineScore / 20).toFixed(1) : '-',
          attendanceScore: report ? `${Math.round((report.totalPresent / Math.max(1, (report.totalPresent + report.totalAbsent + report.totalLateDays))) * 100)}%` : 'Not Generated',
          hasReport: !!report,
          report: report ? { ...report, user: u, month, year } : null
        };
      });
      setEmployeeStats(stats);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load employee reports');
    }
  };

  useEffect(() => {
    if (activeTab === 'EMPLOYEE') {
      fetchEmployeeReports();
    }
  }, [month, year, activeTab]);

  const handleGenerateReports = async () => {
    setIsGenerating(true);
    try {
      await apiPost(`/reports/generate/${year}/${month}`, {});
      toast.success(`Generated reports for ${month}/${year}`);
      fetchEmployeeReports();
    } catch (e) {
      toast.error('Failed to generate reports');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      toast.error('Access denied');
      router.push('/dashboard');
    }
  }, [user, router]);

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return null;
  }

  const formatCurrency = (val: any) => `₹${val.toLocaleString('en-IN')}`;

  const downloadCSV = (filename: string, rows: string[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported Successfully');
  };

  const exportEmployeeCSV = () => {
    const rows = [['Employee Name', 'Jobs Completed', 'Rating', 'Attendance Score']];
    employeeStats.forEach(p => rows.push([p.empName, String(p.jobsCompleted), String(p.rating), String(p.attendanceScore)]));
    downloadCSV(`Employee_Performance_${year}_${month}.csv`, rows);
  };

  const exportInventoryCSV = () => {
    const rows = [['Material', 'Used Quantity', 'Unit', 'Total Cost']];
    MOCK_INVENTORY.forEach(i => rows.push([i.material, i.used.toString(), i.unit, i.cost.toString()]));
    downloadCSV(`Inventory_Report_${year}_${month}.csv`, rows);
  };

  const exportSalesCSV = () => {
    const rows = [['Date', 'Revenue']];
    MOCK_SALES_DAILY.forEach(s => rows.push([`2026-${month.toString().padStart(2, '0')}-${s.day}`, s.revenue.toString()]));
    downloadCSV(`Sales_Report_${year}_${month}.csv`, rows);
  };

  const exportCashflowPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Cashflow Report - ${month}/${year}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Total Inflow: ${formatCurrency(245000)}`, 14, 35);
    doc.text(`Total Outflow: ${formatCurrency(115000)}`, 14, 45);
    doc.text(`Net Cashflow: ${formatCurrency(130000)}`, 14, 55);
    doc.text('Summary: Cashflow remains positive due to strong enterprise installations.', 14, 70);
    doc.save(`Cashflow_${year}_${month}.pdf`);
    toast.success('PDF Exported Successfully');
  };

  const netCashflow = 130000;
  const cashflowBg = netCashflow >= 0 ? 'bg-[#22c55e]/10 border-[#22c55e]/30' : 'bg-[#ef4444]/10 border-[#ef4444]/30';
  const cashflowColor = netCashflow >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';

  return (
    <div className="p-8 flex-1 overflow-auto bg-[#0a0e14]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Reports</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Performance reports, analytics, and business insights</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-6 border-b border-white/5 w-full md:w-auto">
          {(['EMPLOYEE', 'INVENTORY', 'SALES', 'CASHFLOW'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input">
            {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'EMPLOYEE' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-3">
            <button onClick={handleGenerateReports} disabled={isGenerating} className="btn btn-primary flex items-center gap-2">
              <FileText size={16} /> {isGenerating ? 'Generating...' : 'Generate All Reports'}
            </button>
            <button onClick={() => toast.success('All reports approved')} className="bg-transparent border border-white/5 hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-[#22c55e] text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 flex items-center gap-2">
              <CheckCircle size={16} /> Approve All
            </button>
            <button onClick={exportEmployeeCSV} className="btn btn-secondary flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                <tr>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Employee Name</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Jobs Completed</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Avg Rating</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Attendance</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {employeeStats.map(p => (
                  <tr key={p.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                    <td className="px-4 py-3 text-sm text-white font-medium flex items-center gap-2"><Users size={16} className="text-[#a1a1aa]"/> {p.empName}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{p.jobsCompleted}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{p.rating !== '-' ? `${p.rating} / 5.0` : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.hasReport ? (
                        <span className="text-[#22c55e] font-medium">{p.attendanceScore}</span>
                      ) : (
                        <span className="text-[#f59e0b] font-medium text-xs border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-0.5 rounded">Not Generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {p.hasReport && (
                        <button onClick={() => generatePayslipPdf(p.report)} className="text-[#a1a1aa] hover:text-[#0070f3] transition-colors" title="Download Payslip">
                          <FileText size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs text-[#52525b] uppercase tracking-wide">Total Items Used</p>
              <p className="text-2xl font-semibold text-white mt-1">570</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs text-[#52525b] uppercase tracking-wide">Total Cost Value</p>
              <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(14700)}</p>
            </div>
            <div className="flex items-center justify-end p-6">
               <button onClick={exportInventoryCSV} className="btn btn-secondary flex items-center gap-2">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                <tr>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Material</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Quantity Used</th>
                  <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {MOCK_INVENTORY.map(i => (
                  <tr key={i.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                    <td className="px-4 py-3 text-sm text-white font-medium flex items-center gap-2"><Package size={16} className="text-[#a1a1aa]"/> {i.material}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{i.used} {i.unit}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatCurrency(i.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'SALES' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <div className="glass-card p-6 w-48 hover:border-[#3a3a3a] transition-colors duration-200">
                <p className="text-xs text-[#52525b] uppercase tracking-wide">Total Revenue</p>
                <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(172000)}</p>
              </div>
              <div className="glass-card p-6 w-48 hover:border-[#3a3a3a] transition-colors duration-200">
                <p className="text-xs text-[#52525b] uppercase tracking-wide">Avg Ticket Size</p>
                <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(4500)}</p>
              </div>
            </div>
            <button onClick={exportSalesCSV} className="btn btn-secondary flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6">Daily Revenue</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_SALES_DAILY}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="day" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={12} tickFormatter={(val) => `₹${val/1000}k`} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', color: '#fff', borderRadius: '8px' }} />
                    <Bar dataKey="revenue" fill="#0070f3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6">Revenue by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_SALES_CAT} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis type="number" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" stroke="#52525b" fontSize={12} width={80} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', color: '#fff', borderRadius: '8px' }} />
                    <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200 lg:col-span-2 flex flex-col items-center">
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6 self-start">Revenue by Employee</h3>
              <div className="h-72 w-full max-w-md">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={MOCK_SALES_EMP} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {MOCK_SALES_EMP.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', color: '#fff', borderRadius: '8px' }} formatter={(val: any) => formatCurrency(val)} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CASHFLOW' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={exportCashflowPDF} className="btn btn-secondary flex items-center gap-2">
              <FileText size={16} /> Export PDF
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs text-[#52525b] uppercase tracking-wide">Inflow (Sales)</p>
              <p className="text-2xl font-semibold text-[#22c55e] mt-1">{formatCurrency(245000)}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs text-[#52525b] uppercase tracking-wide">Outflow (Expenses)</p>
              <p className="text-2xl font-semibold text-[#ef4444] mt-1">{formatCurrency(115000)}</p>
            </div>
            <div className={`border rounded-xl p-6 hover:border-[#3a3a3a] transition-colors duration-200 lg:col-span-2 ${cashflowBg}`}>
              <p className="text-xs text-[#a1a1aa] uppercase tracking-wide">Net Cashflow</p>
              <p className={`text-4xl font-bold mt-1 ${cashflowColor}`}>{formatCurrency(netCashflow)}</p>
            </div>
          </div>
          <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-4">Executive Summary</h3>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              For the selected period, operations generated a positive net cashflow of <strong className="text-white font-medium">{formatCurrency(netCashflow)}</strong>.
              Inflow was primarily driven by enterprise installations, which constituted 60% of total revenue. Outflow was contained within budget, largely consisting of inventory purchases and payroll.
              It is recommended to maintain a liquidity buffer of at least ₹50,000 for unexpected overheads.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
