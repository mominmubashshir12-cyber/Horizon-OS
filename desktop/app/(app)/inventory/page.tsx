'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Boxes, PackageOpen, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiGet, apiPut } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types';

interface ProductsStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalMargin: number;
  averageMargin: number;
}

interface SaleHistory {
  createdAt: string;
  user?: { fullName: string };
  product?: { name: string };
  quantity: number;
  unitPrice: number;
  marginAmount: number;
  marginPercent: number;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'products' | 'analytics'>('products');

  // --- Products Tab State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [productStats, setProductStats] = useState<ProductsStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [editingPricesProduct, setEditingPricesProduct] = useState<Product | null>(null);
  const [priceFormData, setPriceFormData] = useState({ purchasePrice: 0, minSellingPrice: 0, maxSellingPrice: 0, customerPrice: 0 });

  const [adjustStockProduct, setAdjustStockProduct] = useState<Product | null>(null);
  const [stockFormData, setStockFormData] = useState({ currentStock: 0, reason: '' });

  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // --- Analytics Tab State ---
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date().getMonth() + 1);
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [dailySales, setDailySales] = useState<{ day: string; revenue: number }[]>([]);
  const [topProduct, setTopProduct] = useState<{ name: string; revenue: number } | null>(null);
  const [topEmployee, setTopEmployee] = useState<{ name: string; revenue: number } | null>(null);
  const [salesList, setSalesList] = useState<SaleHistory[]>([]);

  const fetchProductsData = useCallback(async () => {
    try {
      const [statsRes, catRes, prodRes] = await Promise.all([
        apiGet<ProductsStats>('/products/stats'),
        apiGet<string[]>('/products/categories'),
        apiGet<Product[]>('/products')
      ]);
      if (statsRes.success) setProductStats(statsRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (prodRes.success) setProducts(prodRes.data);
    } catch (err: unknown) {
      toast.error('Failed to load products data');
    }
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const qs = `?month=${analyticsMonth}&year=${analyticsYear}`;
      const [statsRes, dailyRes, topProdRes, topEmpRes, listRes] = await Promise.all([
        apiGet<SalesStats>(`/sales/stats${qs}`),
        apiGet<{ day: string; revenue: number }[]>(`/sales/daily${qs}`),
        apiGet<{ name: string; revenue: number }>(`/sales/top-product${qs}`),
        apiGet<{ name: string; revenue: number }>(`/sales/top-employee${qs}`),
        apiGet<SaleHistory[]>(`/sales/list${qs}`)
      ]);
      if (statsRes.success) setSalesStats(statsRes.data);
      if (dailyRes.success) setDailySales(dailyRes.data);
      if (topProdRes.success) setTopProduct(topProdRes.data);
      if (topEmpRes.success) setTopEmployee(topEmpRes.data);
      if (listRes.success) setSalesList(listRes.data);
    } catch (err: unknown) {
      toast.error('Failed to load analytics data');
    }
  }, [analyticsMonth, analyticsYear]);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProductsData();
    } else {
      fetchAnalyticsData();
    }
  }, [activeTab, fetchProductsData, fetchAnalyticsData]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.sku.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchCat = selectedCategory ? p.category === selectedCategory : true;
      const matchStock = inStockOnly ? p.currentStock > 0 : true;
      const matchLowStock = showLowStockOnly ? p.currentStock <= p.reorderLevel : true;
      return matchSearch && matchCat && matchStock && matchLowStock;
    });
  }, [products, debouncedSearch, selectedCategory, inStockOnly, showLowStockOnly]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const getStockColorClass = (stock: number, reorder: number) => {
    if (stock > reorder) return 'text-emerald-400';
    if (stock === reorder) return 'text-orange-400';
    return 'text-red-400';
  };

  const handleEditPricesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPricesProduct) return;
    if (priceFormData.minSellingPrice >= priceFormData.maxSellingPrice) {
      toast.error('Min price must be less than max price');
      return;
    }
    if (priceFormData.customerPrice < priceFormData.minSellingPrice || priceFormData.customerPrice > priceFormData.maxSellingPrice) {
      if (!window.confirm('Customer price is outside the Min-Max range. Are you sure?')) {
        return;
      }
    }
    
    try {
      const res = await apiPut(`/products/${editingPricesProduct.id}/prices`, priceFormData);
      if (res.success) {
        toast.success('Prices updated');
        setEditingPricesProduct(null);
        fetchProductsData();
      }
    } catch (err: unknown) {
      toast.error('Failed to update prices');
    }
  };

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStockProduct) return;
    if (!stockFormData.reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    try {
      const res = await apiPut(`/products/${adjustStockProduct.id}/stock`, stockFormData);
      if (res.success) {
        toast.success('Stock adjusted');
        setAdjustStockProduct(null);
        fetchProductsData();
      }
    } catch (err: unknown) {
      toast.error('Failed to adjust stock');
    }
  };

  const exportSalesCSV = () => {
    const header = ['Date', 'Employee', 'Product', 'Quantity', 'Sale Price', 'Margin', 'Margin %'];
    const rows = salesList.map(s => [
      new Date(s.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      s.user?.fullName || '',
      s.product?.name || '',
      s.quantity,
      s.unitPrice,
      s.marginAmount,
      s.marginPercent
    ]);
    const csvContent = [header, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_export_${analyticsYear}_${analyticsMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const productColumns: Column<Product>[] = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'purchasePrice', label: 'Purchase (₹)', render: (val) => formatCurrency(val as number), sortable: true },
    { key: 'minSellingPrice', label: 'Min (₹)', render: (val) => formatCurrency(val as number), sortable: true },
    { key: 'maxSellingPrice', label: 'Max (₹)', render: (val) => formatCurrency(val as number), sortable: true },
    { key: 'customerPrice', label: 'Customer (₹)', render: (val) => formatCurrency(val as number), sortable: true },
    { 
      key: 'currentStock', 
      label: 'Stock', 
      render: (val, row) => (
        <span className={`font-bold ${getStockColorClass(val as number, row.reorderLevel)}`}>
          {val as number}
        </span>
      ),
      sortable: true
    },
    { key: 'reorderLevel', label: 'Reorder Level', sortable: true },
    { key: 'shelfLocation', label: 'Shelf', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          {isOwnerAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingPricesProduct(row); setPriceFormData({ purchasePrice: row.purchasePrice, minSellingPrice: row.minSellingPrice, maxSellingPrice: row.maxSellingPrice, customerPrice: row.customerPrice }); }}
              className="text-xs text-blue-400 hover:underline"
            >
              Edit Prices
            </button>
          )}
          {isOwnerAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setAdjustStockProduct(row); setStockFormData({ currentStock: row.currentStock, reason: '' }); }}
              className="text-xs text-orange-400 hover:underline"
            >
              Adjust Stock
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setViewProduct(row); }}
            className="text-xs text-slate-300 hover:underline"
          >
            View
          </button>
        </div>
      )
    }
  ];

  const salesColumns: Column<SaleHistory>[] = [
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
    { key: 'user', label: 'Employee', render: (_, row) => row.user?.fullName },
    { key: 'product', label: 'Product', render: (_, row) => row.product?.name },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitPrice', label: 'Sale Price (₹)', render: (val) => formatCurrency(val as number) },
    { key: 'marginAmount', label: 'Margin (₹)', render: (val) => formatCurrency(val as number) },
    { key: 'marginPercent', label: 'Margin %', render: (val) => `${Number(val).toFixed(2)}%` },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader
        title="Inventory & Sales Analytics"
        subtitle="Manage products and view sales performance"
        actionLabel={isOwnerAdmin ? "+ Add Product" : undefined}
        onAction={() => { /* Implement Add Product */ }}
      />

      <div className="mb-6 flex gap-4 border-b border-[#334155] pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 font-semibold ${activeTab === 'products' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-semibold ${activeTab === 'analytics' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Sales Analytics
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="animate-fade-in space-y-6">
          {productStats && productStats.lowStockCount > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-orange-500/20 border border-orange-500/50 p-4">
              <div className="flex items-center gap-3 text-orange-400">
                <AlertTriangle size={24} />
                <span>
                  <strong>Attention:</strong> {productStats.lowStockCount} products are running low on stock.
                </span>
              </div>
              <button
                onClick={() => setShowLowStockOnly(true)}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                View Low Stock
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-slate-400">Total Products</p>
              <p className="mt-2 text-3xl font-bold">{productStats?.totalProducts || 0}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-slate-400">Total Stock Value</p>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(productStats?.totalStockValue || 0)}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-orange-400">Low Stock</p>
              <p className="mt-2 text-3xl font-bold text-orange-400">{productStats?.lowStockCount || 0}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-red-400">Out of Stock</p>
              <p className="mt-2 text-3xl font-bold text-red-400">{productStats?.outOfStockCount || 0}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="flex flex-1 items-center gap-4">
              <input
                type="text"
                placeholder="Search SKU or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-blue-500"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="rounded bg-[#0f172a] border-[#334155]" />
                In Stock Only
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} className="rounded bg-[#0f172a] border-[#334155]" />
                Low Stock Only
              </label>
            </div>
          </div>

          <DataTable columns={productColumns} data={filteredProducts} emptyMessage="No products found." />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex items-center gap-4">
            <select
              value={analyticsMonth}
              onChange={(e) => setAnalyticsMonth(parseInt(e.target.value))}
              className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={analyticsYear}
              onChange={(e) => setAnalyticsYear(parseInt(e.target.value))}
              className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-blue-500"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-slate-400">Total Sales</p>
              <p className="mt-2 text-3xl font-bold">{salesStats?.totalSales || 0}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-slate-400">Total Revenue</p>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(salesStats?.totalRevenue || 0)}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-emerald-400">Total Margin</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{formatCurrency(salesStats?.totalMargin || 0)}</p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <p className="text-sm text-emerald-400">Avg Margin %</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{Number(salesStats?.averageMargin || 0).toFixed(2)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-[#334155] bg-[#1e293b] p-6">
              <h3 className="mb-4 text-sm font-bold tracking-wide text-[#f8fafc]">Daily Sales Revenue</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySales}>
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `₹${value}`} />
                    <Tooltip cursor={{ fill: '#334155' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} formatter={(val: number) => formatCurrency(val)} />
                    <Bar dataKey="revenue" fill="#0088ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6 flex-1 flex flex-col justify-center items-center">
                <PackageOpen size={48} className="text-blue-500/50 mb-4" />
                <p className="text-sm text-slate-400">Top Selling Product</p>
                <p className="text-xl font-bold text-center mt-2">{topProduct?.name || 'N/A'}</p>
                {topProduct && <p className="text-sm text-emerald-400 mt-1">{formatCurrency(topProduct.revenue)}</p>}
              </div>
              <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6 flex-1 flex flex-col justify-center items-center">
                <TrendingUp size={48} className="text-purple-500/50 mb-4" />
                <p className="text-sm text-slate-400">Top Employee</p>
                <p className="text-xl font-bold text-center mt-2">{topEmployee?.name || 'N/A'}</p>
                {topEmployee && <p className="text-sm text-emerald-400 mt-1">{formatCurrency(topEmployee.revenue)}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold tracking-wide text-[#f8fafc]">Sales History</h3>
              <button onClick={exportSalesCSV} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                Export CSV
              </button>
            </div>
            <DataTable columns={salesColumns} data={salesList} emptyMessage="No sales found for this month." />
          </div>
        </div>
      )}

      <Modal isOpen={!!editingPricesProduct} onClose={() => setEditingPricesProduct(null)} title="Edit Prices">
        <form onSubmit={handleEditPricesSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Purchase Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.purchasePrice} onChange={(e) => setPriceFormData({ ...priceFormData, purchasePrice: Number(e.target.value) })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Customer Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.customerPrice} onChange={(e) => setPriceFormData({ ...priceFormData, customerPrice: Number(e.target.value) })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Min Selling Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.minSellingPrice} onChange={(e) => setPriceFormData({ ...priceFormData, minSellingPrice: Number(e.target.value) })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Max Selling Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.maxSellingPrice} onChange={(e) => setPriceFormData({ ...priceFormData, maxSellingPrice: Number(e.target.value) })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" required />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setEditingPricesProduct(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-[#334155]">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Prices</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!adjustStockProduct} onClose={() => setAdjustStockProduct(null)} title="Adjust Stock">
        <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">New Stock Level</label>
            <input type="number" value={stockFormData.currentStock} onChange={(e) => setStockFormData({ ...stockFormData, currentStock: Number(e.target.value) })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Reason</label>
            <textarea value={stockFormData.reason} onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white min-h-[80px]" required placeholder="e.g. Received new shipment, Damaged item" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setAdjustStockProduct(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-[#334155]">Cancel</button>
            <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">Adjust Stock</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)} title="Product Details">
        {viewProduct && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-400 block">Name:</span> {viewProduct.name}</div>
              <div><span className="text-slate-400 block">SKU:</span> {viewProduct.sku}</div>
              <div><span className="text-slate-400 block">Category:</span> {viewProduct.category}</div>
              <div><span className="text-slate-400 block">Shelf:</span> {viewProduct.shelfLocation || 'N/A'}</div>
              <div><span className="text-slate-400 block">Current Stock:</span> <span className={getStockColorClass(viewProduct.currentStock, viewProduct.reorderLevel)}>{viewProduct.currentStock}</span></div>
              <div><span className="text-slate-400 block">Reorder Level:</span> {viewProduct.reorderLevel}</div>
            </div>
            <div className="pt-4 border-t border-[#334155]">
              <h4 className="font-semibold mb-2">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-slate-400 block">Purchase:</span> {formatCurrency(viewProduct.purchasePrice)}</div>
                <div><span className="text-slate-400 block">Customer:</span> {formatCurrency(viewProduct.customerPrice)}</div>
                <div><span className="text-slate-400 block">Min Selling:</span> {formatCurrency(viewProduct.minSellingPrice)}</div>
                <div><span className="text-slate-400 block">Max Selling:</span> {formatCurrency(viewProduct.maxSellingPrice)}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
