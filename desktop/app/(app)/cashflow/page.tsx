// Cashflow Module — cinematic finance tracker.
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/services/api';
import { IndianRupee, ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon, Table as TableIcon, Download, List, Plus, X, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  isDefault: boolean;
}

interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  categoryId: number;
  date: string;
  notes: string | null;
  category: { name: string; color: string };
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
  incomeByCategory: { name: string; color: string; amount: number }[];
  expenseByCategory: { name: string; color: string; amount: number }[];
  dailyFlow: { date: string; day: number; income: number; expense: number; net: number }[];
}

interface Velocity {
  month: string;
  year: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
}

/* ─── UI Helpers ─────────────────────────────────────────────────────── */

function fmt(val: any) { return `₹${val.toLocaleString('en-IN')}`; }

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function CashflowPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TRANSACTIONS' | 'LEDGER' | 'CATEGORIES'>('OVERVIEW');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [velocity, setVelocity] = useState<Velocity[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Tx Form
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ title: '', amount: '', type: 'EXPENSE', categoryId: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  const fetchOverview = async () => {
    try {
      const [sumRes, velRes] = await Promise.all([
        apiGet<any>('/cashflow/summary'),
        apiGet<any>('/cashflow/velocity?months=6')
      ]);
      setSummary(sumRes.data);
      setVelocity(velRes.data.reverse());
    } catch (e) { console.error('Cashflow fetch error', e); }
  };

  const fetchTransactions = async () => {
    try {
      const res = await apiGet<any>('/cashflow/transactions');
      setTransactions(res.data);
    } catch (e) { console.error('Transactions fetch error', e); }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiGet<any>('/cashflow/categories');
      setCategories(res.data);
    } catch (e) { console.error('Categories fetch error', e); }
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    fetchTransactions();
    fetchCategories();
  }, [token]);

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/cashflow/transactions', txForm);
      setShowTxModal(false);
      fetchOverview();
      fetchTransactions();
    } catch (e) { console.error('Tx save error', e); }
  };

  // ─── TABS ───

  const renderOverview = () => {
    if (!summary) return <div className="p-8 text-center text-[#52525b]">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card glass-card-hover p-6 h-32 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-lg p-2 bg-[#22c55e]/10 text-[#22c55e]">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{fmt(summary.totalIncome)}</p>
              <p className="text-xs text-[#52525b] uppercase tracking-wide mt-1">Income</p>
            </div>
          </div>
          <div className="glass-card glass-card-hover p-6 h-32 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-lg p-2 bg-[#ef4444]/10 text-[#ef4444]">
                <ArrowDownRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{fmt(summary.totalExpense)}</p>
              <p className="text-xs text-[#52525b] uppercase tracking-wide mt-1">Expense</p>
            </div>
          </div>
          <div className="glass-card glass-card-hover p-6 h-32 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-lg p-2 bg-[#0070f3]/10 text-[#0070f3]">
                <IndianRupee size={16} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{fmt(summary.netCashflow)}</p>
              <p className="text-xs text-[#52525b] uppercase tracking-wide mt-1">Net Flow</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Velocity Chart */}
          <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6 flex items-center gap-2"><Activity size={16}/> 6-Month Velocity</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="totalIncome" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#1a1a1a', strokeWidth: 2 }} name="Income" />
                  <Line type="monotone" dataKey="totalExpense" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#1a1a1a', strokeWidth: 2 }} name="Expense" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Bar */}
          <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6 flex items-center gap-2"><BarChart3 size={16}/> Daily Pulse</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.dailyFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="day" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', borderRadius: '8px' }} />
                  <Bar dataKey="income" fill="#22c55e" stackId="a" />
                  <Bar dataKey="expense" fill="#ef4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
           <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6 flex items-center gap-2"><PieChartIcon size={16}/> Income Sources</h3>
            <div className="h-48 flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.incomeByCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                    {summary.incomeByCategory.map((e, i) => <Cell key={i} fill={e.color || '#0070f3'} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', borderRadius: '8px', border: '1px solid' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
            <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6 flex items-center gap-2"><PieChartIcon size={16}/> Expense Breakdown</h3>
            <div className="h-48 flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.expenseByCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                    {summary.expenseByCategory.map((e, i) => <Cell key={i} fill={e.color || '#ef4444'} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#2a2a2a', borderRadius: '8px', border: '1px solid' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactions = () => (
    <div className="glass-card overflow-hidden hover:border-[#3a3a3a] transition-colors duration-200">
      <div className="flex items-center justify-between p-6 border-b border-white/5">
        <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">All Transactions</h3>
        <button onClick={() => setShowTxModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={16}/> Add Entry
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Date</th>
              <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Title</th>
              <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Category</th>
              <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-xs font-medium text-[#52525b] uppercase tracking-wider px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f1f]">
            {transactions.map(t => (
              <tr key={t.id} className="hover:bg-[#1f1f1f] transition-colors duration-100">
                <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-sm text-white font-medium">{t.title}</td>
                <td className="px-4 py-3 text-sm text-[#a1a1aa]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.category.color }}/>{t.category.name}</span>
                </td>
                <td className="px-4 py-3">
                  {t.type === 'INCOME' ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#22c55e]/10 text-[#22c55e]">IN</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#ef4444]/10 text-[#ef4444]">OUT</span>}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${t.type === 'INCOME' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#52525b]">No transactions found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-8 flex-1 overflow-auto bg-[#0a0e14]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Cashflow Matrix</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Ledger & Analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-white/5 mb-6">
        {[
          { id: 'OVERVIEW', icon: Activity, label: 'Overview' },
          { id: 'TRANSACTIONS', icon: TableIcon, label: 'Transactions' },
          { id: 'LEDGER', icon: Download, label: 'Export' },
          { id: 'CATEGORIES', icon: List, label: 'Categories' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors ${activeTab === t.id ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'TRANSACTIONS' && renderTransactions()}
        {(activeTab === 'LEDGER' || activeTab === 'CATEGORIES') && <div className="glass-card p-6"><p className="text-sm text-[#a1a1aa]">Component mapped. Available soon.</p></div>}
      </div>

      {/* Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 w-full max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">New Transaction</h3>
              <button onClick={() => setShowTxModal(false)} className="text-[#52525b] hover:text-white transition-colors duration-150"><X size={20}/></button>
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setTxForm({...txForm, type: 'INCOME', categoryId: ''})} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${txForm.type === 'INCOME' ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' : 'bg-[#0a0e14] border border-white/5 text-[#a1a1aa] hover:text-white'}`}>Income</button>
                <button type="button" onClick={() => setTxForm({...txForm, type: 'EXPENSE', categoryId: ''})} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${txForm.type === 'EXPENSE' ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20' : 'bg-[#0a0e14] border border-white/5 text-[#a1a1aa] hover:text-white'}`}>Expense</button>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Title</label>
                <input required type="text" className="input" value={txForm.title} onChange={e => setTxForm({...txForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Amount</label>
                  <input required type="number" step="0.01" className="input" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Date</label>
                  <input required type="date" className="input" value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a1a1aa] mb-1.5 block">Category</label>
                <select required className="input" value={txForm.categoryId} onChange={e => setTxForm({...txForm, categoryId: e.target.value})}>
                  <option value="">Select Category...</option>
                  {categories.filter(c => c.type === txForm.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full btn btn-primary mt-6">
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
