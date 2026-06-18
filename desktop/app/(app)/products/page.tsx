'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types';

export default function ProductsPage() {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    purchasePrice: 0,
    minSellingPrice: 0,
    maxSellingPrice: 0,
    customerPrice: 0,
    currentStock: 0,
    reorderLevel: 0,
    unit: 'PCS',
  });

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiGet<Product[]>('/products');
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreateModal = () => {
    setFormMode('create');
    setFormData({
      name: '',
      sku: '',
      category: '',
      purchasePrice: 0,
      minSellingPrice: 0,
      maxSellingPrice: 0,
      customerPrice: 0,
      currentStock: 0,
      reorderLevel: 0,
      unit: 'PCS',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setFormMode('edit');
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      purchasePrice: product.purchasePrice,
      minSellingPrice: product.minSellingPrice,
      maxSellingPrice: product.maxSellingPrice,
      customerPrice: product.customerPrice,
      currentStock: product.currentStock,
      reorderLevel: product.reorderLevel,
      unit: product.unit,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      // Convert strings to numbers if needed, though input type="number" helps
      const payload = {
        ...formData,
        purchasePrice: Number(formData.purchasePrice),
        minSellingPrice: Number(formData.minSellingPrice),
        maxSellingPrice: Number(formData.maxSellingPrice),
        customerPrice: Number(formData.customerPrice),
        currentStock: Number(formData.currentStock),
        reorderLevel: Number(formData.reorderLevel),
      };

      if (formMode === 'create') {
        res = await apiPost<Product>('/products', payload);
      } else {
        res = await apiPut<Product>(`/products/${selectedProduct!.id}`, payload);
      }

      if (res.success) {
        toast.success(res.message);
        setIsModalOpen(false);
        fetchProducts();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to disable this product?')) return;
    try {
      const res = await apiDelete(`/products/${id}`);
      if (res.success) {
        toast.success(res.message);
        fetchProducts();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const columns: Column<Product>[] = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'currentStock', label: 'Stock', sortable: true, render: (val, row) => `${val} ${row.unit}` },
    { key: 'customerPrice', label: 'Retail Price', sortable: true, render: (val) => `₹${val}` },
    { key: 'minSellingPrice', label: 'Min Price', sortable: true, render: (val) => `₹${val}` },
  ];

  if (isOwnerAdmin) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(row)} className="text-slate-400 hover:text-white">
            <Edit2 size={16} />
          </button>
          <button onClick={() => handleDelete(row.id)} className="text-red-400 hover:text-red-300">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    });
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-[#f8fafc]">
      <PageHeader
        title="Products Catalog"
        subtitle="Manage inventory, pricing, and stock levels"
        actionLabel={isOwnerAdmin ? 'Add Product' : undefined}
        onAction={isOwnerAdmin ? openCreateModal : undefined}
      />

      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading products...</div>
      ) : (
        <DataTable columns={columns} data={products} emptyMessage="No products found." />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formMode === 'create' ? 'Add Product' : 'Edit Product'}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">SKU</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Category</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Current Stock</label>
              <input
                type="number"
                required
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Purchase Price</label>
              <input
                type="number"
                required
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Min Selling Price</label>
              <input
                type="number"
                required
                value={formData.minSellingPrice}
                onChange={(e) => setFormData({ ...formData, minSellingPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Customer Retail Price</label>
              <input
                type="number"
                required
                value={formData.customerPrice}
                onChange={(e) => setFormData({ ...formData, customerPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-[#2563eb]"
              />
            </div>
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
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
