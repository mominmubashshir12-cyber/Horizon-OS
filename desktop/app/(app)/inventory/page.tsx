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
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
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

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '', unit: '', currentStock: 0, reorderLevel: 0,
    purchasePrice: 0, minSellingPrice: 0, maxSellingPrice: 0, customerPrice: 0,
    category: '', shelfLocation: ''
  });

  // --- Analytics Tab State ---
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date().getMonth() + 1);
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [dailySales, setDailySales] = useState<{ day: string; revenue: number }[]>([]);
  const [topProduct, setTopProduct] = useState<{ name: string; revenue: number } | null>(null);
  const [topEmployee, setTopEmployee] = useState<{ name: string; revenue: number } | null>(null);
  const [salesList, setSalesList] = useState<SaleHistory[]>([]);
  const [currentSalesPage, setCurrentSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);

  const fetchProductsData = useCallback(async () => {
    try {
      const [statsRes, catRes, prodRes] = await Promise.all([
        apiGet<ProductsStats>('/products/stats'),
        apiGet<string[]>('/products/categories'),
        apiGet<any>(`/products?page=${currentProductPage}&limit=50`)
      ]);
      if (statsRes.success) setProductStats(statsRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (prodRes.success) {
        setProducts(prodRes.data.data || []);
        setProductTotalPages(prodRes.data.totalPages || 1);
      }
    } catch (err: unknown) {
      toast.error('Failed to load products data');
    }
  }, [currentProductPage]);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const qsStats = `?month=${analyticsMonth}&year=${analyticsYear}`;
      const startDate = new Date(analyticsYear, analyticsMonth - 1, 1).toISOString();
      const endDate = new Date(analyticsYear, analyticsMonth, 0, 23, 59, 59, 999).toISOString();
      const qsSales = `?startDate=${startDate}&endDate=${endDate}&page=${currentSalesPage}&limit=50`;

      const [statsRes, dailyRes, topProdRes, topEmpRes, listRes] = await Promise.all([
        apiGet<SalesStats>(`/sales/stats${qsStats}`),
        apiGet<{ day: string; revenue: number }[]>(`/sales/daily${qsStats}`).catch(() => ({ success: false, data: [] })),
        apiGet<{ name: string; revenue: number }>(`/sales/top-product${qsStats}`).catch(() => ({ success: false, data: null })),
        apiGet<{ name: string; revenue: number }>(`/sales/top-employee${qsStats}`).catch(() => ({ success: false, data: null })),
        apiGet<any>(`/sales${qsSales}`)
      ]);
      if (statsRes.success) setSalesStats(statsRes.data);
      if (dailyRes.success) setDailySales(dailyRes.data);
      if (topProdRes.success && topProdRes.data) setTopProduct(topProdRes.data);
      if (topEmpRes.success && topEmpRes.data) setTopEmployee(topEmpRes.data);
      if (listRes.success) {
        setSalesList(listRes.data.data || []);
        setSalesTotalPages(listRes.data.totalPages || 1);
      }
    } catch (err: unknown) {
      toast.error('Failed to load analytics data');
    }
  }, [analyticsMonth, analyticsYear, currentSalesPage]);

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

  const formatCurrency = (val: any) => `₹${val.toLocaleString('en-IN')}`;

  const getStockColorClass = (stock: number, reorder: number) => {
    if (stock > reorder) return 'text-[#22c55e]';
    if (stock === reorder) return 'text-[#f59e0b]';
    return 'text-[#ef4444]';
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

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProductData.minSellingPrice >= newProductData.maxSellingPrice) {
      toast.error('Min selling price must be less than max selling price');
      return;
    }
    if (newProductData.customerPrice < newProductData.minSellingPrice || newProductData.customerPrice > newProductData.maxSellingPrice) {
      if (!window.confirm('Customer price is outside the Min-Max range. Are you sure?')) {
        return;
      }
    }
    try {
      const { apiPost } = await import('@/services/api');
      const res = await apiPost('/products', newProductData);
      if (res.success) {
        toast.success('Product created successfully');
        setIsAddProductModalOpen(false);
        setNewProductData({ name: '', unit: '', currentStock: 0, reorderLevel: 0, purchasePrice: 0, minSellingPrice: 0, maxSellingPrice: 0, customerPrice: 0, category: '', shelfLocation: '' });
        fetchProductsData();
      }
    } catch (err: unknown) {
      toast.error('Failed to create product');
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

  const inputClasses = "input";

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
        <span className={`font-semibold ${getStockColorClass(val as number, row.reorderLevel)}`}>
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
              className="text-xs font-medium text-[#0070f3] hover:text-white transition-colors"
            >
              Edit Prices
            </button>
          )}
          {isOwnerAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setAdjustStockProduct(row); setStockFormData({ currentStock: row.currentStock, reason: '' }); }}
              className="text-xs font-medium text-[#f59e0b] hover:text-white transition-colors"
            >
              Adjust Stock
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setViewProduct(row); }}
            className="text-xs font-medium text-[#a1a1aa] hover:text-white transition-colors"
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
    <div className="flex-1 overflow-auto p-8">
      <PageHeader
        title="Inventory & Sales Analytics"
        subtitle="Manage products and view sales performance"
        actionLabel={isOwnerAdmin ? "+ Add Product" : undefined}
        onAction={() => setIsAddProductModalOpen(true)}
      />

      <div className="mb-6 flex gap-6 border-b border-white/5">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'products' ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'border-b-2 border-[#0070f3] text-white' : 'border-b-2 border-transparent text-[#a1a1aa] hover:text-white'}`}
        >
          Sales Analytics
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          {productStats && productStats.lowStockCount > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-4">
              <div className="flex items-center gap-3 text-[#f59e0b]">
                <AlertTriangle size={20} />
                <span className="text-sm">
                  <strong className="font-semibold">Attention:</strong> {productStats.lowStockCount} products are running low on stock.
                </span>
              </div>
              <button
                onClick={() => setShowLowStockOnly(true)}
                className="btn btn-primary bg-[#f59e0b] hover:bg-[#d97706]"
              >
                View Low Stock
              </button>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Products</p>
              <p className="mt-2 text-2xl font-semibold text-white">{productStats?.totalProducts || 0}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Stock Value</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(productStats?.totalStockValue || 0)}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide text-[#f59e0b]">Low Stock</p>
              <p className="mt-2 text-2xl font-semibold text-[#f59e0b]">{productStats?.lowStockCount || 0}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide text-[#ef4444]">Out of Stock</p>
              <p className="mt-2 text-2xl font-semibold text-[#ef4444]">{productStats?.outOfStockCount || 0}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-1 gap-4">
              <input
                type="text"
                placeholder="Search SKU or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClasses} max-w-xs`}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${inputClasses} max-w-xs`}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="rounded border-white/5 bg-[#0a0e14] text-[#0070f3] focus:ring-[#0070f3]" />
                In Stock Only
              </label>
              <label className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                <input type="checkbox" checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} className="rounded border-white/5 bg-[#0a0e14] text-[#0070f3] focus:ring-[#0070f3]" />
                Low Stock Only
              </label>
            </div>
          </div>

          <DataTable 
            columns={productColumns} 
            data={filteredProducts} 
            emptyMessage="No products found." 
            pagination={{
              currentPage: currentProductPage,
              totalPages: productTotalPages,
              onPageChange: setCurrentProductPage
            }}
          />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <select
              value={analyticsMonth}
              onChange={(e) => setAnalyticsMonth(parseInt(e.target.value))}
              className={`${inputClasses} w-auto`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={analyticsYear}
              onChange={(e) => setAnalyticsYear(parseInt(e.target.value))}
              className={`${inputClasses} w-auto`}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Sales</p>
              <p className="mt-2 text-2xl font-semibold text-white">{salesStats?.totalSales || 0}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(salesStats?.totalRevenue || 0)}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide text-[#22c55e]">Total Margin</p>
              <p className="mt-2 text-2xl font-semibold text-[#22c55e]">{formatCurrency(salesStats?.totalMargin || 0)}</p>
            </div>
            <div className="glass-card p-6 hover:border-[#3a3a3a] transition-colors duration-200">
              <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide text-[#22c55e]">Avg Margin %</p>
              <p className="mt-2 text-2xl font-semibold text-[#22c55e]">{Number(salesStats?.averageMargin || 0).toFixed(2)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 glass-card p-6">
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider mb-6">Daily Sales Revenue</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySales}>
                    <XAxis dataKey="day" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                    <Tooltip cursor={{ fill: '#1f1f1f' }} contentStyle={{ backgroundColor: '#111111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} formatter={(val: any) => formatCurrency(val)} />
                    <Bar dataKey="revenue" fill="#0070f3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="glass-card p-6 flex-1 flex flex-col justify-center items-center">
                <div className="bg-[#0070f3]/10 p-3 rounded-lg mb-4">
                  <PackageOpen size={24} className="text-[#0070f3]" />
                </div>
                <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Top Selling Product</p>
                <p className="text-lg font-semibold text-white text-center mt-2">{topProduct?.name || 'N/A'}</p>
                {topProduct && <p className="text-sm font-medium text-[#22c55e] mt-1">{formatCurrency(topProduct.revenue)}</p>}
              </div>
              <div className="glass-card p-6 flex-1 flex flex-col justify-center items-center">
                <div className="bg-[#a855f7]/10 p-3 rounded-lg mb-4">
                  <TrendingUp size={24} className="text-[#a855f7]" />
                </div>
                <p className="text-xs font-medium text-[#52525b] uppercase tracking-wide">Top Employee</p>
                <p className="text-lg font-semibold text-white text-center mt-2">{topEmployee?.name || 'N/A'}</p>
                {topEmployee && <p className="text-sm font-medium text-[#22c55e] mt-1">{formatCurrency(topEmployee.revenue)}</p>}
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/5">
              <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">Sales History</h3>
              <button onClick={exportSalesCSV} className="btn btn-secondary text-xs px-3 py-1.5">
                Export CSV
              </button>
            </div>
            <DataTable 
              columns={salesColumns} 
              data={salesList} 
              emptyMessage="No sales found for this month." 
              pagination={{
                currentPage: currentSalesPage,
                totalPages: salesTotalPages,
                onPageChange: setCurrentSalesPage
              }}
            />
          </div>
        </div>
      )}

      <Modal isOpen={!!editingPricesProduct} onClose={() => setEditingPricesProduct(null)} title="Edit Prices">
        <form onSubmit={handleEditPricesSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Purchase Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.purchasePrice} onChange={(e) => setPriceFormData({ ...priceFormData, purchasePrice: Number(e.target.value) })} className={inputClasses} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Customer Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.customerPrice} onChange={(e) => setPriceFormData({ ...priceFormData, customerPrice: Number(e.target.value) })} className={inputClasses} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Min Selling Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.minSellingPrice} onChange={(e) => setPriceFormData({ ...priceFormData, minSellingPrice: Number(e.target.value) })} className={inputClasses} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Max Selling Price (₹)</label>
              <input type="number" step="0.01" value={priceFormData.maxSellingPrice} onChange={(e) => setPriceFormData({ ...priceFormData, maxSellingPrice: Number(e.target.value) })} className={inputClasses} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setEditingPricesProduct(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Prices</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!adjustStockProduct} onClose={() => setAdjustStockProduct(null)} title="Adjust Stock">
        <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">New Stock Level</label>
            <input type="number" value={stockFormData.currentStock} onChange={(e) => setStockFormData({ ...stockFormData, currentStock: Number(e.target.value) })} className={inputClasses} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Reason</label>
            <textarea value={stockFormData.reason} onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })} className={`${inputClasses} min-h-[80px]`} required placeholder="e.g. Received new shipment, Damaged item" />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setAdjustStockProduct(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary bg-[#f59e0b] hover:bg-[#d97706]">Adjust Stock</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)} title="Product Details">
        {viewProduct && (
          <div className="space-y-6 text-sm text-[#a1a1aa]">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Name</span> <span className="text-white">{viewProduct.name}</span></div>
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">SKU</span> <span className="text-white">{viewProduct.sku}</span></div>
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Category</span> <span className="text-white">{viewProduct.category}</span></div>
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Shelf</span> <span className="text-white">{viewProduct.shelfLocation || 'N/A'}</span></div>
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Current Stock</span> <span className={`font-semibold ${getStockColorClass(viewProduct.currentStock, viewProduct.reorderLevel)}`}>{viewProduct.currentStock}</span></div>
              <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Reorder Level</span> <span className="text-white">{viewProduct.reorderLevel}</span></div>
            </div>
            <div className="pt-6 border-t border-white/5">
              <h4 className="text-sm font-medium text-white mb-4">Pricing</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Purchase</span> <span className="text-white">{formatCurrency(viewProduct.purchasePrice)}</span></div>
                <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Customer</span> <span className="text-white">{formatCurrency(viewProduct.customerPrice)}</span></div>
                <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Min Selling</span> <span className="text-white">{formatCurrency(viewProduct.minSellingPrice)}</span></div>
                <div><span className="text-[#52525b] uppercase tracking-wide text-xs block mb-1">Max Selling</span> <span className="text-white">{formatCurrency(viewProduct.maxSellingPrice)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
