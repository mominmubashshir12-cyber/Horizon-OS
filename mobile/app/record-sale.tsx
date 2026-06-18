import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { addToSyncQueue } from '../services/db';
import { apiGet } from '../services/api';
import type { Product } from '../types';

export default function RecordSaleScreen(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await apiGet<Product[]>('/products');
        if (res.success) setProducts(res.data);
      } catch (err) {
        console.error('Failed to fetch products', err);
      }
    }
    fetchProducts();
  }, []);

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => p.id.toString() === id);
    if (prod) {
      setUnitPrice(prod.customerPrice.toString());
    }
  };

  const handleSave = async () => {
    if (!selectedProductId || !quantity || !unitPrice) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    try {
      const payload = {
        productId: parseInt(selectedProductId, 10),
        quantity: parseInt(quantity, 10),
        unitPrice: parseFloat(unitPrice),
      };
      
      const entityId = Date.now().toString(); // simple unique id for queue
      await addToSyncQueue('sale', entityId, 'CREATE', payload);
      
      Alert.alert('Success', 'Sale recorded offline! It will sync when connected.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to save sale to offline queue.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-[#334155]">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#f8fafc]">Record Sale</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Product</Text>
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] mb-6 overflow-hidden">
          {products.map(p => (
            <TouchableOpacity
              key={p.id}
              className={`p-4 border-b border-[#334155] ${selectedProductId === p.id.toString() ? 'bg-blue-900/30' : ''}`}
              onPress={() => handleProductSelect(p.id.toString())}
            >
              <Text className="text-slate-50 font-semibold">{p.name}</Text>
              <Text className="text-slate-400 text-xs">Retail: ₹{p.customerPrice} | Stock: {p.currentStock}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quantity</Text>
        <TextInput
          className="bg-[#1e293b] rounded-xl border border-[#334155] px-4 py-3 text-[#f8fafc] mb-6"
          keyboardType="numeric"
          value={quantity}
          onChangeText={setQuantity}
        />

        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Unit Price (₹)</Text>
        <TextInput
          className="bg-[#1e293b] rounded-xl border border-[#334155] px-4 py-3 text-[#f8fafc] mb-8"
          keyboardType="numeric"
          value={unitPrice}
          onChangeText={setUnitPrice}
        />

        <TouchableOpacity
          className="bg-[#2563eb] rounded-xl py-4 items-center flex-row justify-center"
          onPress={handleSave}
        >
          <CheckCircle2 color="white" size={20} className="mr-2" />
          <Text className="text-white font-bold text-base">Save Sale Offline</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
