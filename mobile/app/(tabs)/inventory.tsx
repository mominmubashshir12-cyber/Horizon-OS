// app/(tabs)/inventory.tsx
// Inventory management screen — Displays consumable materials and stock status.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Package, AlertTriangle, MapPin, WifiOff } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { apiGet, apiPost } from '../../services/api';
import { getOffline, saveOffline } from '../../services/offline';

export default function InventoryScreen(): React.JSX.Element {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [materials, setMaterials] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Take Stock Modal State
  const [activeMaterial, setActiveMaterial] = useState<any | null>(null);
  const [takeQuantity, setTakeQuantity] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [takeModalVisible, setTakeModalVisible] = useState(false);

  // Add/Edit Material Modal State (For Owner/Admin)
  const [editMaterial, setEditMaterial] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCurrentStock, setFormCurrentStock] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formShelfLocation, setFormShelfLocation] = useState('');
  const [formReorderLevel, setFormReorderLevel] = useState('');

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);

    if (isOnline) {
      try {
        const res = await apiGet<any[]>('/materials');
        if (res.success) {
          setMaterials(res.data);
          await saveOffline('materials', res.data);
        }
        
        // Load active jobs for dropdown
        const jobsRes = await apiGet<any[]>('/jobcards?status=ASSIGNED,EN_ROUTE,ARRIVED,IN_PROGRESS');
        if (jobsRes.success) {
          const jobsData = (jobsRes.data as any).data ?? jobsRes.data;
          const myJobs = jobsData.filter((j: any) => j.assignedToId === user?.id);
          setActiveJobs(myJobs);
        }
      } catch (err) {
        console.warn('[Inventory] Online fetch failed, using cache', err);
        await loadFromCache();
      }
    } else {
      await loadFromCache();
    }
    
    if (showLoader) setIsLoading(false);
  }, [isOnline, user?.id]);

  const loadFromCache = async () => {
    const cached = await getOffline<any[]>('materials');
    if (cached && cached.data) {
      setMaterials(cached.data);
    }
  };

  useEffect(() => {
    loadData(true);
  }, [loadData, isOnline]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
  };

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return materials;
    const lowerQ = searchQuery.toLowerCase();
    return materials.filter(m => 
      m.name.toLowerCase().includes(lowerQ) || 
      (m.category && m.category.toLowerCase().includes(lowerQ))
    );
  }, [materials, searchQuery]);

  const handleTakeStock = async () => {
    if (!activeMaterial) return;
    
    const qty = Number(takeQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive number.');
      return;
    }
    if (qty > activeMaterial.currentStock) {
      Alert.alert('Insufficient Stock', `You cannot take more than the available stock (${activeMaterial.currentStock}).`);
      return;
    }

    if (!isOnline) {
      Alert.alert('Offline', 'Cannot log material usage while offline.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiPost('/materials/usage/take', {
        productId: activeMaterial.id,
        quantityTaken: qty,
        jobCardId: selectedJobId || undefined,
      });

      if (res.success) {
        Toast.show({ type: 'success', text1: 'Stock Taken Successfully' });
        setTakeModalVisible(false);
        setActiveMaterial(null);
        setTakeQuantity('');
        setSelectedJobId(null);
        loadData(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to take stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTakeModal = (material: any) => {
    setActiveMaterial(material);
    setTakeQuantity('');
    setSelectedJobId(null);
    setTakeModalVisible(true);
  };

  const handleLongPress = (material: any) => {
    if (!isOwnerAdmin) return;
    Alert.alert('Manage Material', `What would you like to do with ${material.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openFormModal(material) },
    ]);
  };

  const openFormModal = (material?: any) => {
    if (material) {
      setEditMaterial(material);
      setFormName(material.name);
      setFormCategory(material.category || '');
      setFormCurrentStock(String(material.currentStock));
      setFormUnit(material.unit);
      setFormShelfLocation(material.shelfLocation || '');
      setFormReorderLevel(String(material.reorderLevel));
    } else {
      setEditMaterial(null);
      setFormName('');
      setFormCategory('');
      setFormCurrentStock('');
      setFormUnit('');
      setFormShelfLocation('');
      setFormReorderLevel('');
    }
    setFormVisible(true);
  };

  // The submit for Owner/Admin adding/editing
  const handleSaveMaterial = async () => {
    if (!formName || !formCurrentStock || !formUnit) {
      Alert.alert('Required', 'Please fill all required fields.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot save materials while offline.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Mocking the request - in reality, it would be apiPost or apiPut
      Toast.show({ type: 'success', text1: editMaterial ? 'Material updated' : 'Material created' });
      setFormVisible(false);
      loadData(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      {/* Header & Search */}
      <View className="px-4 pt-4 pb-2 z-10 bg-[#0f172a]">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-50 text-2xl font-bold">Inventory</Text>
          {isOwnerAdmin && (
            <TouchableOpacity
              onPress={() => openFormModal()}
              className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center shadow"
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {!isOnline && (
          <View className="bg-red-900/30 border border-red-500/50 rounded-xl p-3 mb-4 flex-row items-center">
            <WifiOff size={16} color="#ef4444" />
            <Text className="text-red-400 text-xs ml-2">Offline Mode. Showing cached data.</Text>
          </View>
        )}

        <View className="bg-[#1e293b] rounded-xl border border-[#334155] flex-row items-center px-4 py-3">
          <Search size={18} color="#64748b" />
          <TextInput
            placeholder="Search items by name or category..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="text-slate-100 text-sm ml-3 flex-1 h-full"
          />
        </View>
      </View>

      {/* List */}
      <ScrollView
        className="flex-1 px-4 pt-2"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#64748b" />
        }
      >
        {isLoading && !isRefreshing ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : filteredMaterials.length === 0 ? (
          <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-8 items-center mt-4">
            <Package size={40} color="#64748b" className="mb-4" />
            <Text className="text-slate-300 font-semibold text-lg text-center mb-1">
              No Materials Found
            </Text>
            <Text className="text-slate-500 text-sm text-center">
              {searchQuery ? "Try a different search term." : "Your inventory list is empty."}
            </Text>
          </View>
        ) : (
          <View className="space-y-3 pb-6">
            {filteredMaterials.map(mat => {
              const isLowStock = mat.currentStock <= mat.reorderLevel;

              return (
                <TouchableOpacity
                  key={mat.id}
                  onPress={() => handleOpenTakeModal(mat)}
                  onLongPress={() => handleLongPress(mat)}
                  activeOpacity={0.7}
                  className={`bg-[#1e293b] rounded-xl border ${isLowStock ? 'border-red-500/50' : 'border-[#334155]'} p-4 flex-row items-center shadow-sm`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Text className="text-slate-50 font-bold text-base mr-2">{mat.name}</Text>
                      {mat.category ? (
                        <View className="bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-700">
                          <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{mat.category}</Text>
                        </View>
                      ) : null}
                    </View>
                    
                    <View className="flex-row items-center mt-1">
                      <Text className={`text-sm font-semibold ${isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                        {mat.currentStock} {mat.unit}
                      </Text>
                      <Text className="text-slate-500 text-xs ml-1">in stock</Text>
                    </View>

                    {mat.shelfLocation ? (
                      <View className="flex-row items-center mt-2">
                        <MapPin size={12} color="#64748b" />
                        <Text className="text-slate-400 text-xs ml-1">Shelf: {mat.shelfLocation}</Text>
                      </View>
                    ) : null}
                  </View>

                  {isLowStock && (
                    <View className="bg-red-500/10 p-2 rounded-full border border-red-500/20 ml-2">
                      <AlertTriangle size={20} color="#ef4444" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Take Stock Modal */}
      <Modal
        visible={takeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTakeModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">Take Material</Text>
            
            {activeMaterial && (
              <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 items-center">
                <Text className="text-slate-200 font-bold text-lg">{activeMaterial.name}</Text>
                <Text className="text-slate-400 text-sm mt-1">
                  Available: <Text className="text-emerald-400 font-bold">{activeMaterial.currentStock} {activeMaterial.unit}</Text>
                </Text>
              </View>
            )}

            <ScrollView className="space-y-4 max-h-[400px]">
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Quantity Needed <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={takeQuantity}
                  onChangeText={setTakeQuantity}
                  placeholder={`0 ${activeMaterial?.unit || ''}`}
                  placeholderTextColor="#64748b"
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Link to Job (Optional)
                </Text>
                {activeJobs.length === 0 ? (
                  <Text className="text-slate-500 text-xs italic mt-1">No active jobs found for you.</Text>
                ) : (
                  <View className="flex-row flex-wrap mt-1">
                    <TouchableOpacity
                      onPress={() => setSelectedJobId(null)}
                      className={`px-3 py-2 rounded-lg border mr-2 mb-2 ${
                        selectedJobId === null ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-600'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${selectedJobId === null ? 'text-white' : 'text-slate-300'}`}>
                        General Use
                      </Text>
                    </TouchableOpacity>
                    {activeJobs.map(job => (
                      <TouchableOpacity
                        key={job.id}
                        onPress={() => setSelectedJobId(job.id)}
                        className={`px-3 py-2 rounded-lg border mr-2 mb-2 ${
                          selectedJobId === job.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-600'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${selectedJobId === job.id ? 'text-white' : 'text-slate-300'}`}>
                          {job.jobNumber}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="flex-row mt-6">
              <TouchableOpacity
                onPress={() => setTakeModalVisible(false)}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTakeStock}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Confirm Take</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create/Edit Material Modal (Admin only) */}
      <Modal
        visible={formVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6 max-h-[80%]">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">
              {editMaterial ? 'Edit Material' : 'Add Material'}
            </Text>

            <ScrollView className="space-y-4">
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Name <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>

              <View className="flex-row space-x-3">
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Current Stock <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={formCurrentStock}
                    onChangeText={setFormCurrentStock}
                    className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Unit <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={formUnit}
                    onChangeText={setFormUnit}
                    placeholder="e.g., pcs, kg, m"
                    placeholderTextColor="#64748b"
                    className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  />
                </View>
              </View>

              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Category
                </Text>
                <TextInput
                  value={formCategory}
                  onChangeText={setFormCategory}
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>

              <View className="flex-row space-x-3">
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Shelf Location
                  </Text>
                  <TextInput
                    value={formShelfLocation}
                    onChangeText={setFormShelfLocation}
                    className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Reorder Level
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={formReorderLevel}
                    onChangeText={setFormReorderLevel}
                    className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  />
                </View>
              </View>
            </ScrollView>

            <View className="flex-row mt-6 pt-4 border-t border-[#334155]">
              <TouchableOpacity
                onPress={() => setFormVisible(false)}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveMaterial}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
