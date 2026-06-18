'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { Download, FileText, CheckCircle, Table, BarChart3, Users, Package, IndianRupee } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'EMPLOYEE'|'INVENTORY'|'SALES'|'CASHFLOW'>('EMPLOYEE');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      toast.error('Access denied');
      router.push('/dashboard');
    }
  }, [user, router]);

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return null;
  }

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

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
    MOCK_PERFORMANCE.forEach(p => rows.push([p.empName, p.jobsCompleted.toString(), p.rating.toString(), p.attendanceScore]));
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
  const cashflowBg = netCashflow >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30';
  const cashflowColor = netCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <PageHeader title="Reports" subtitle="Performance reports, analytics, and business insights" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
        <div className="flex gap-2 bg-[#0f172a] p-1 rounded-lg">
          {(['EMPLOYEE', 'INVENTORY', 'SALES', 'CASHFLOW'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-[#334155] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'}`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc]">
            {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc]">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'EMPLOYEE' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => toast.success('Generated all reports!')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">
              <FileText size={16} /> Generate All Reports
            </button>
            <button onClick={() => toast.success('All reports approved')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium">
              <CheckCircle size={16} /> Approve All
            </button>
            <button onClick={exportEmployeeCSV} className="flex items-center gap-2 px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-white rounded text-sm font-medium">
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
            <table className="w-full text-left text-sm text-[#f8fafc]">
              <thead className="border-b border-[#334155] bg-[#0f172a]/50">
                <tr>
                  <th className="p-4 font-medium">Employee Name</th>
                  <th className="p-4 font-medium">Jobs Completed</th>
                  <th className="p-4 font-medium">Avg Rating</th>
                  <th className="p-4 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PERFORMANCE.map(p => (
                  <tr key={p.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/20">
                    <td className="p-4 font-medium flex items-center gap-2"><Users size={16} className="text-[#94a3b8]"/> {p.empName}</td>
                    <td className="p-4">{p.jobsCompleted}</td>
                    <td className="p-4">{p.rating} / 5.0</td>
                    <td className="p-4"><span className="text-emerald-400 font-medium">{p.attendanceScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <p className="text-sm text-[#94a3b8]">Total Items Used</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">570</p>
            </div>
            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <p className="text-sm text-[#94a3b8]">Total Cost Value</p>
              <p className="text-3xl font-bold text-rose-400 mt-1">{formatCurrency(14700)}</p>
            </div>
            <div className="p-5 flex items-center justify-end">
               <button onClick={exportInventoryCSV} className="flex items-center gap-2 px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg text-sm font-medium">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#1e293b]">
            <table className="w-full text-left text-sm text-[#f8fafc]">
              <thead className="border-b border-[#334155] bg-[#0f172a]/50">
                <tr>
                  <th className="p-4 font-medium">Material</th>
                  <th className="p-4 font-medium">Quantity Used</th>
                  <th className="p-4 font-medium">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_INVENTORY.map(i => (
                  <tr key={i.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/20">
                    <td className="p-4 font-medium flex items-center gap-2"><Package size={16} className="text-[#94a3b8]"/> {i.material}</td>
                    <td className="p-4">{i.used} {i.unit}</td>
                    <td className="p-4">{formatCurrency(i.cost)}</td>
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
              <div className="p-4 rounded-xl border border-[#334155] bg-[#1e293b] w-48">
                <p className="text-xs text-[#94a3b8] mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(172000)}</p>
              </div>
              <div className="p-4 rounded-xl border border-[#334155] bg-[#1e293b] w-48">
                <p className="text-xs text-[#94a3b8] mb-1">Avg Ticket Size</p>
                <p className="text-xl font-bold text-blue-400">{formatCurrency(4500)}</p>
              </div>
            </div>
            <button onClick={exportSalesCSV} className="flex items-center gap-2 px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg text-sm font-medium">
              <Download size={16} /> Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <h3 className="text-sm font-medium text-white mb-4">Daily Revenue</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_SALES_DAILY}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `₹${val/1000}k`} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <h3 className="text-sm font-medium text-white mb-4">Revenue by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_SALES_CAT} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                    <YAxis dataKey="category" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b] lg:col-span-2 flex flex-col items-center">
              <h3 className="text-sm font-medium text-white mb-4 self-start">Revenue by Employee</h3>
              <div className="h-72 w-full max-w-md">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={MOCK_SALES_EMP} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {MOCK_SALES_EMP.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} formatter={(val: number) => formatCurrency(val)} />
                    <Legend />
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
            <button onClick={exportCashflowPDF} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium">
              <FileText size={16} /> Export PDF
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <p className="text-sm text-[#94a3b8]">Inflow (Sales)</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(245000)}</p>
            </div>
            <div className="p-5 rounded-xl border border-[#334155] bg-[#1e293b]">
              <p className="text-sm text-[#94a3b8]">Outflow (Expenses)</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(115000)}</p>
            </div>
            <div className={`p-5 rounded-xl border lg:col-span-2 ${cashflowBg}`}>
              <p className="text-sm font-medium opacity-80 text-white">Net Cashflow</p>
              <p className={`text-4xl font-bold mt-1 ${cashflowColor}`}>{formatCurrency(netCashflow)}</p>
            </div>
          </div>
          <div className="p-6 rounded-xl border border-[#334155] bg-[#1e293b]">
            <h3 className="text-lg font-semibold text-white mb-2">Executive Summary</h3>
            <p className="text-[#cbd5e1] leading-relaxed">
              For the selected period, operations generated a positive net cashflow of <strong className="text-emerald-400">{formatCurrency(netCashflow)}</strong>.
              Inflow was primarily driven by enterprise installations, which constituted 60% of total revenue. Outflow was contained within budget, largely consisting of inventory purchases and payroll.
              It is recommended to maintain a liquidity buffer of at least ₹50,000 for unexpected overheads.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
