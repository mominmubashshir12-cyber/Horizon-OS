// app/(tabs)/jobs.tsx
// Jobs list screen — displays filterable job cards with pull-to-refresh and offline caching.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList, WifiOff } from 'lucide-react-native';
import JobCard from '../../components/JobCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { apiGet } from '../../services/api';
import { saveOffline, getOffline } from '../../services/offline';
import type { JobCard as JobCardType } from '../../types';

export default function JobsScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [jobs, setJobs] = useState<JobCardType[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobCardType[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineData, setIsOfflineData] = useState(false);
  
  // Filter state for Owner/Admin view: 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // ─── Fetch Jobs Data ─────────────────────────────────────────────────────────

  const loadJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    if (isOnline) {
      try {
        const res = await apiGet<JobCardType[]>('/jobcards');
        if (res.success) {
          setJobs(res.data);
          setIsOfflineData(false);
          // Cache to offline storage
          await saveOffline('jobs', res.data);
        }
      } catch (err) {
        console.warn('[JobsList] Online fetch failed, trying cache:', err);
        await loadFromCache();
      }
    } else {
      await loadFromCache();
    }
    
    if (isRefresh) setRefreshing(false);
  }, [isOnline]);

  const loadFromCache = async () => {
    const cached = await getOffline<JobCardType[]>('jobs');
    if (cached && cached.data) {
      setJobs(cached.data);
      setIsOfflineData(true);
    } else {
      setJobs([]);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [loadJobs, isOnline]);

  // ─── Apply Tab Filtering ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOwnerAdmin) {
      // Employees see their own list sorted
      setFilteredJobs(jobs);
      return;
    }

    if (filterTab === 'ALL') {
      setFilteredJobs(jobs);
    } else if (filterTab === 'ACTIVE') {
      setFilteredJobs(
        jobs.filter((j) =>
          ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)
        )
      );
    } else if (filterTab === 'COMPLETED') {
      setFilteredJobs(
        jobs.filter((j) => ['COMPLETED', 'VERIFIED'].includes(j.status))
      );
    }
  }, [jobs, filterTab, isOwnerAdmin]);

  const handleCardPress = (id: number) => {
    // Navigate to dynamic jobs/[id] route
    router.push({
      pathname: '/(tabs)/jobs/[id]',
      params: { id: String(id) },
    });
  };

  // ─── Render Subcomponents ────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: JobCardType }) => (
    <JobCard
      job={item}
      onPress={() => handleCardPress(item.id)}
      showAssignee={isOwnerAdmin}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      {/* Offline Status Badge */}
      {isOfflineData && (
        <View className="bg-slate-800 border-b border-slate-700 py-1.5 px-4 flex-row items-center justify-center">
          <WifiOff size={14} color="#94a3b8" />
          <Text className="text-slate-400 text-xs font-semibold ml-1.5">
            Viewing cached offline data
          </Text>
        </View>
      )}

      {/* Owner/Admin Filter Tab Bar */}
      {isOwnerAdmin && (
        <View className="flex-row border-b border-[#334155] bg-[#0f172a] p-2">
          {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((tab) => {
            const isActive = filterTab === tab;
            return (
              <View
                key={tab}
                className={`flex-1 rounded-lg py-2.5 mx-1 items-center justify-center ${
                  isActive ? 'bg-[#2563eb]' : 'bg-[#1e293b]'
                }`}
                style={{ elevation: isActive ? 2 : 0 }}
                onTouchEnd={() => setFilterTab(tab)}
              >
                <Text
                  className={`text-xs font-bold ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {tab}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Jobs FlatList */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadJobs(true)}
            tintColor="#2563eb"
            colors={['#2563eb']}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-8">
            <View className="bg-slate-800 rounded-full p-4 mb-4">
              <ClipboardList size={36} color="#64748b" />
            </View>
            <Text className="text-slate-50 font-semibold text-lg text-center mb-1">
              No jobs assigned
            </Text>
            <Text className="text-slate-400 text-sm text-center">
              Pull down to refresh or check back later.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
