import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, CheckCircle, XCircle, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { apiGet, apiPost } from '../../services/api';
import { useNetwork } from '../../contexts/NetworkContext';
import { getOffline, saveOffline } from '../../services/offline';
import type { Product } from '../../types';
import CheckInGuard from '../../components/CheckInGuard';

export default function ProductsScreen(): React.JSX.Element {
  const { isOnline } = useNetwork();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bottom Sheet State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saleQuantity, setSaleQuantity] = useState<string>('1');
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (isOnline) {
      try {
        const res = await apiGet<string[]>('/products/categories');
        if (res.success) {
          setCategories(res.data);
          await saveOffline('product_categories_cache', res.data);
        }
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    } else {
      const cached = await getOffline<string[]>('product_categories_cache');
      if (cached?.data) {
        setCategories(cached.data);
      }
    }
  }, [isOnline]);

  const fetchProducts = useCallback(async () => {
    if (isOnline) {
      try {
        const res = await apiGet<Product[]>('/products');
        if (res.success) {
          setProducts(res.data);
          await saveOffline('products_cache', res.data);
        }
      } catch (err) {
        console.error('Failed to fetch products', err);
      }
    } else {
      const cached = await getOffline<Product[]>('products_cache');
      if (cached?.data) {
        setProducts(cached.data);
      }
    }
  }, [isOnline]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchProducts()]);
    setRefreshing(false);
  }, [fetchCategories, fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const openSaleSheet = (product: Product) => {
    setSelectedProduct(product);
    setSaleQuantity('1');
    setSalePrice(String(product.customerPrice));
    setSaleNotes('');
  };

  const closeSaleSheet = () => {
    setSelectedProduct(null);
  };

  const handleSaleSubmit = async () => {
    if (!selectedProduct) return;
    
    const qty = parseInt(saleQuantity, 10);
    const price = parseFloat(salePrice);
    
    if (isNaN(qty) || qty <= 0 || qty > selectedProduct.currentStock) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity up to current stock.');
      return;
    }
    
    if (isNaN(price) || price < selectedProduct.minSellingPrice || price > selectedProduct.customerPrice) {
      Alert.alert('Invalid Price', `Price must be between ₹${selectedProduct.minSellingPrice} and ₹${selectedProduct.customerPrice}.`);
      return;
    }

    if (!isOnline) {
      Alert.alert('Offline', 'Cannot record sale while offline.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiPost('/sales', {
        productId: selectedProduct.id,
        quantity: qty,
        unitPrice: price,
        notes: saleNotes
      });
      
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Sale Recorded',
          text2: 'Successfully recorded the sale.'
        });
        closeSaleSheet();
        fetchProducts(); // Refresh stock
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Price validation
  const parsedPrice = parseFloat(salePrice);
  const isPriceValid = !isNaN(parsedPrice) && 
                       selectedProduct && 
                       parsedPrice >= selectedProduct.minSellingPrice && 
                       parsedPrice <= selectedProduct.customerPrice;

  return (
    <CheckInGuard>
      <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      {!isOnline && (
        <View className="bg-red-500/20 px-4 py-2 flex-row items-center justify-center">
          <Text className="text-red-400 text-xs font-bold uppercase tracking-wider">
            Offline Mode - Browsing Cached Products
          </Text>
        </View>
      )}
      
      <View className="px-4 pt-4 pb-2 space-y-3">
        {/* Search Bar - Always Visible */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] flex-row items-center px-4 py-3">
          <Search size={18} color="#64748b" />
          <TextInput
            className="text-slate-50 text-base ml-3 flex-1"
            placeholder="Search products..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 flex-row">
          <TouchableOpacity
            onPress={() => setSelectedCategory('All')}
            className={`px-4 py-2 rounded-full border mr-2 ${selectedCategory === 'All' ? 'bg-blue-600 border-blue-500' : 'bg-[#1e293b] border-[#334155]'}`}
          >
            <Text className={`font-bold ${selectedCategory === 'All' ? 'text-white' : 'text-slate-400'}`}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full border mr-2 ${selectedCategory === cat ? 'bg-blue-600 border-blue-500' : 'bg-[#1e293b] border-[#334155]'}`}
            >
              <Text className={`font-bold ${selectedCategory === cat ? 'text-white' : 'text-slate-400'}`}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4 mt-2"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
      >
        {filteredProducts.map(product => {
          let stockColor = 'text-green-400';
          if (product.currentStock < product.reorderLevel) stockColor = 'text-red-400';
          else if (product.currentStock === product.reorderLevel) stockColor = 'text-orange-400';

          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.7}
              onPress={() => openSaleSheet(product)}
              className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-3 shadow-sm"
            >
              <View className="flex-row justify-between mb-2">
                <Text className="text-white font-bold text-lg flex-1 mr-2" numberOfLines={1}>
                  {product.name}
                </Text>
                <View className="bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 items-center justify-center">
                  <Text className="text-slate-300 text-xs font-bold">{product.category}</Text>
                </View>
              </View>
              
              <View className="flex-row items-center mb-3">
                <MapPin size={14} color="#64748b" />
                <Text className="text-slate-400 text-xs ml-1 flex-1">
                  {product.shelfLocation || 'No Location'}
                </Text>
                <Text className={`font-bold text-sm text-right ${stockColor}`}>
                  {product.currentStock} {product.unit}
                </Text>
              </View>

              <View className="bg-[#0f172a] rounded-lg p-2 flex-row justify-between items-center border border-[#334155]">
                <Text className="text-slate-400 text-xs">Price Range</Text>
                <Text className="text-blue-400 font-bold text-sm">
                  ₹{product.minSellingPrice.toLocaleString('en-IN')} — ₹{product.maxSellingPrice.toLocaleString('en-IN')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View className="h-20" />
      </ScrollView>

      {/* Sale Bottom Sheet (Modal) */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={closeSaleSheet}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/60"
        >
          {selectedProduct && (
            <View className="bg-[#1e293b] rounded-t-3xl p-6 border-t border-[#334155]">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-white font-bold text-xl">{selectedProduct.name}</Text>
                  <Text className="text-slate-400 text-sm mt-1">
                    Current Stock: {selectedProduct.currentStock} {selectedProduct.unit}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeSaleSheet} className="bg-[#0f172a] p-2 rounded-full border border-[#334155]">
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View className="bg-blue-500/10 rounded-xl p-3 mb-4 border border-blue-500/20 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <CheckCircle size={16} color="#60a5fa" />
                  <Text className="text-slate-300 text-xs ml-2">Allowed Price Range</Text>
                </View>
                <Text className="text-blue-400 font-bold text-sm">
                  ₹{selectedProduct.minSellingPrice.toLocaleString('en-IN')} — ₹{selectedProduct.customerPrice.toLocaleString('en-IN')}
                </Text>
              </View>

              <View className="flex-row mb-4">
                <View className="flex-1 pr-2">
                  <Text className="text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">Quantity</Text>
                  <TextInput
                    className="bg-[#0f172a] border border-[#334155] rounded-xl text-white font-bold text-base px-4 py-3"
                    keyboardType="numeric"
                    value={saleQuantity}
                    onChangeText={setSaleQuantity}
                    placeholder="1"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View className="flex-1 pl-2">
                  <Text className="text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">Unit Price (₹)</Text>
                  <View className="relative justify-center">
                    <TextInput
                      className={`bg-[#0f172a] border rounded-xl text-white font-bold text-base px-4 py-3 pr-10 ${
                        salePrice === '' ? 'border-[#334155]' : isPriceValid ? 'border-green-500/50' : 'border-red-500/50'
                      }`}
                      keyboardType="numeric"
                      value={salePrice}
                      onChangeText={setSalePrice}
                      placeholder={String(selectedProduct.customerPrice)}
                      placeholderTextColor="#64748b"
                    />
                    {salePrice !== '' && (
                      <View className="absolute right-3">
                        {isPriceValid ? (
                          <CheckCircle size={18} color="#22c55e" />
                        ) : (
                          <XCircle size={18} color="#ef4444" />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {salePrice !== '' && !isPriceValid && (
                <Text className="text-red-400 text-xs font-bold mb-4">
                  Price must be between ₹{selectedProduct.minSellingPrice.toLocaleString('en-IN')} and ₹{selectedProduct.customerPrice.toLocaleString('en-IN')}
                </Text>
              )}

              <Text className="text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">Notes (Optional)</Text>
              <TextInput
                className="bg-[#0f172a] border border-[#334155] rounded-xl text-white text-sm px-4 py-3 mb-6"
                placeholder="Add sale notes..."
                placeholderTextColor="#64748b"
                value={saleNotes}
                onChangeText={setSaleNotes}
                multiline
              />

              <TouchableOpacity
                disabled={!isOnline || isSubmitting || !isPriceValid || saleQuantity === '' || parseInt(saleQuantity, 10) > selectedProduct.currentStock}
                onPress={handleSaleSubmit}
                className={`w-full rounded-xl py-4 items-center flex-row justify-center shadow-lg ${
                  (!isOnline || !isPriceValid || saleQuantity === '' || parseInt(saleQuantity, 10) > selectedProduct.currentStock) 
                    ? 'bg-slate-700' 
                    : 'bg-blue-600'
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    {!isOnline ? 'Offline - Cannot Submit' : 'Submit Sale'}
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Extra spacing for iOS bottom area */}
              <View className="h-4" />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  </CheckInGuard>
  );
}
