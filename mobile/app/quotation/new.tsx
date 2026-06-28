import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Trash2, Save, Send } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '../../contexts/NetworkContext';
import { apiPost, apiPut } from '../../services/api';
import CheckInGuard from '../../components/CheckInGuard';

export default function NewQuotationScreen(): React.JSX.Element {
  const router = useRouter();
  const { isOnline } = useNetwork();
  
  const [clientName, setClientName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [validityDays, setValidityDays] = useState<string>('15');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<{ id: string; desc: string; qty: string; unitPrice: string }[]>([
    { id: Date.now().toString(), desc: '', qty: '1', unitPrice: '0' }
  ]);
  
  const [loading, setLoading] = useState<boolean>(false);

  const addItem = (): void => {
    setItems([...items, { id: Date.now().toString(), desc: '', qty: '1', unitPrice: '0' }]);
  };
  
  const removeItem = (id: string): void => {
    if (items.length === 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, field: string, value: string): void => {
    setItems(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0), 0);
  const tax = subtotal * 0.18;
  const grandTotal = subtotal + tax;

  const handleSave = async (status: 'DRAFT' | 'SENT'): Promise<void> => {
    if (!clientName.trim()) {
      Alert.alert('Validation Error', 'Client Name is required.');
      return;
    }
    
    const quotationData = {
      clientName,
      phone,
      address,
      validityDays: parseInt(validityDays, 10) || 15,
      notes,
      items: items.map((it) => ({
        description: it.desc,
        quantity: parseFloat(it.qty) || 0,
        unitPrice: parseFloat(it.unitPrice) || 0,
      })),
      subtotal,
      tax,
      grandTotal,
      status,
      createdAt: new Date().toISOString(),
    };

    setLoading(true);

    try {
      if (!isOnline) {
        const pendingStr = await AsyncStorage.getItem('pending_quotations');
        const pending: unknown[] = pendingStr ? JSON.parse(pendingStr) as unknown[] : [];
        pending.push({ ...quotationData, id: `temp_${Date.now()}` });
        await AsyncStorage.setItem('pending_quotations', JSON.stringify(pending));
        
        Toast.show({ type: 'success', text1: `Offline: Quotation saved as ${status}` });
        router.back();
        return;
      }

      const res = await apiPost<{ id: string }>('/quotations', { ...quotationData, status: 'DRAFT' });
      if (res.success && res.data && status === 'SENT') {
        const putRes = await apiPut<unknown>(`/quotations/${res.data.id}/status`, { status: 'SENT' });
        if (!putRes.success) throw new Error('Failed to send quotation');
      }

      Toast.show({ type: 'success', text1: `Quotation ${status === 'SENT' ? 'Sent' : 'Drafted'} successfully` });
      router.back();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CheckInGuard>
      <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <ChevronLeft size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text className="flex-1 text-slate-50 text-lg font-bold">New Quotation</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" automaticallyAdjustKeyboardInsets>
        
        {/* Client Details */}
        <View className="bg-[#1e293b] p-4 rounded-xl mb-4 border border-slate-800">
          <Text className="text-blue-400 font-bold text-xs uppercase mb-3">Client Details</Text>
          
          <Text className="text-slate-400 text-xs mb-1">Client Name *</Text>
          <TextInput
            value={clientName}
            onChangeText={setClientName}
            placeholder="Enter client name"
            placeholderTextColor="#64748b"
            className="bg-[#0f172a] text-slate-50 p-3 rounded-lg border border-slate-700 mb-3"
          />

          <Text className="text-slate-400 text-xs mb-1">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            className="bg-[#0f172a] text-slate-50 p-3 rounded-lg border border-slate-700 mb-3"
          />

          <Text className="text-slate-400 text-xs mb-1">Address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            placeholderTextColor="#64748b"
            className="bg-[#0f172a] text-slate-50 p-3 rounded-lg border border-slate-700 mb-3"
            multiline
          />

          <Text className="text-slate-400 text-xs mb-1">Validity (Days)</Text>
          <TextInput
            value={validityDays}
            onChangeText={setValidityDays}
            placeholder="15"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            className="bg-[#0f172a] text-slate-50 p-3 rounded-lg border border-slate-700"
          />
        </View>

        {/* Line Items */}
        <View className="bg-[#1e293b] p-4 rounded-xl mb-4 border border-slate-800">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-blue-400 font-bold text-xs uppercase">Line Items</Text>
            <TouchableOpacity onPress={addItem} className="flex-row items-center bg-blue-600/20 px-2 py-1 rounded">
              <Plus size={14} color="#60a5fa" />
              <Text className="text-blue-400 text-xs ml-1 font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={item.id} className="mb-4 bg-[#0f172a] p-3 rounded-lg border border-slate-700">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-300 font-bold text-sm">Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                value={item.desc}
                onChangeText={(val) => updateItem(item.id, 'desc', val)}
                placeholder="Description"
                placeholderTextColor="#64748b"
                className="bg-[#1e293b] text-slate-50 p-2 rounded border border-slate-600 mb-2 text-sm"
              />
              
              <View className="flex-row space-x-2">
                <View className="flex-1 mr-2">
                  <TextInput
                    value={item.qty}
                    onChangeText={(val) => updateItem(item.id, 'qty', val)}
                    placeholder="Qty"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    className="bg-[#1e293b] text-slate-50 p-2 rounded border border-slate-600 text-sm"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    value={item.unitPrice}
                    onChangeText={(val) => updateItem(item.id, 'unitPrice', val)}
                    placeholder="Price"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    className="bg-[#1e293b] text-slate-50 p-2 rounded border border-slate-600 text-sm"
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Totals */}
          <View className="mt-2 border-t border-slate-700 pt-3 space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-slate-400 text-sm">Subtotal</Text>
              <Text className="text-slate-300 text-sm font-semibold">₹{subtotal.toLocaleString('en-IN')}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-slate-400 text-sm">Tax (18%)</Text>
              <Text className="text-slate-300 text-sm font-semibold">₹{tax.toLocaleString('en-IN')}</Text>
            </View>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-slate-700">
              <Text className="text-slate-100 font-bold text-base">Grand Total</Text>
              <Text className="text-blue-400 font-bold text-lg">₹{grandTotal.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View className="bg-[#1e293b] p-4 rounded-xl mb-6 border border-slate-800">
          <Text className="text-blue-400 font-bold text-xs uppercase mb-3">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes for client..."
            placeholderTextColor="#64748b"
            className="bg-[#0f172a] text-slate-50 p-3 rounded-lg border border-slate-700 min-h-[80px]"
            multiline
            textAlignVertical="top"
          />
        </View>

      </ScrollView>

      {/* Action Buttons */}
      <View className="p-4 bg-[#1e293b] border-t border-slate-800 flex-row">
        <TouchableOpacity
          disabled={loading}
          onPress={() => handleSave('DRAFT')}
          className="flex-1 bg-slate-700 rounded-xl py-3.5 flex-row items-center justify-center mr-2 shadow-sm"
        >
          <Save size={18} color="#f8fafc" />
          <Text className="text-slate-50 font-bold ml-2">Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={loading}
          onPress={() => handleSave('SENT')}
          className="flex-1 bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center ml-2 shadow-sm"
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Send size={18} color="#f8fafc" />
              <Text className="text-white font-bold ml-2">Submit</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  </CheckInGuard>
  );
}
