// app/(tabs)/team.tsx
// Team management screen — Displays employees list, schedules, and active statuses.
// Only accessible to OWNER and ADMIN roles.
// Currently a placeholder with a professional coming-soon layout.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Search, UserCheck, Clock, CheckCircle, AlertCircle, Award, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { apiGet } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function TeamScreen(): React.JSX.Element {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [performance, setPerformance] = useState<Record<string, unknown> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchTodayLogs = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await apiGet<Record<string, unknown>[]>(`/attendance?startDate=${today}&endDate=${today}`);
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (e) {
      console.warn('Team fetch fail:', e);
    }
  }, []);

  useEffect(() => {
    fetchTodayLogs().finally(() => setLoading(false));
    const interval = setInterval(fetchTodayLogs, 90000);
    return () => clearInterval(interval);
  }, [fetchTodayLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodayLogs();
    setRefreshing(false);
  }, [fetchTodayLogs]);

  useEffect(() => {
    if (selectedUser && bottomSheetVisible) {
      async function loadDetails() {
         setLoadingDetails(true);
         const month = new Date().toISOString().slice(0, 7);
         try {
            const [sumRes, perfRes] = await Promise.all([
               apiGet<Record<string, unknown>>(`/attendance/monthly-summary/${selectedUser?.userId}?month=${month}`),
               apiGet<Record<string, unknown>>(`/attendance/performance/${selectedUser?.userId}?month=${month}`)
            ]);
            setSummary(sumRes.success && sumRes.data ? sumRes.data : null);
            setPerformance(perfRes.success && perfRes.data ? perfRes.data : null);
         } catch (e) {
            setSummary(null);
            setPerformance(null);
         } finally {
            setLoadingDetails(false);
         }
      }
      loadDetails();
    }
  }, [selectedUser, bottomSheetVisible]);

  const formatTimeStr = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const openUserSheet = (log: Record<string, unknown>) => {
    setSelectedUser(log);
    setBottomSheetVisible(true);
    setSummary(null);
    setPerformance(null);
  };

  const closeUserSheet = () => {
    setBottomSheetVisible(false);
    setSelectedUser(null);
  };
  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />
        }
      >
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
              Today's Board
            </Text>
            <Text className="text-slate-50 text-2xl font-bold mt-1">
              Live Attendance
            </Text>
          </View>
          <View className="bg-blue-600/10 border border-blue-600/20 rounded-full p-2">
            <Users size={20} color="#60a5fa" />
          </View>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#60a5fa" />
          </View>
        ) : logs.length === 0 ? (
          <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-8 items-center mt-4">
            <View className="bg-blue-900/30 rounded-2xl p-4 mb-4">
              <Users size={40} color="#60a5fa" />
            </View>
            <Text className="text-slate-50 font-semibold text-lg mb-2">
              No Logs Found
            </Text>
            <Text className="text-slate-400 text-sm text-center leading-5">
              No employees have checked in today yet.
            </Text>
          </View>
        ) : (
          logs.map((log: Record<string, unknown>) => {
            const isLate = Number(log.lateMinutes || 0) > 0;
            const isCheckedOut = !!log.checkOutTime;
            const statusDotColor = isLate ? 'bg-amber-500' : 'bg-emerald-500';

            return (
              <TouchableOpacity
                key={String(log.id)}
                activeOpacity={0.7}
                onPress={() => openUserSheet(log)}
                className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-3 shadow"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-2.5 h-2.5 rounded-full ${statusDotColor} mr-3`} />
                    <View className="flex-1 pr-2">
                      <Text className="text-slate-50 font-bold text-base" numberOfLines={1}>
                        {((log.user as Record<string, unknown>)?.fullName as string) || `User #${log.userId}`}
                      </Text>
                      <View className="bg-slate-700/50 self-start px-2 py-0.5 rounded-md mt-1">
                        <Text className="text-slate-300 text-[10px] uppercase font-medium">Employee</Text>
                      </View>
                    </View>
                  </View>
                  {isLate && (
                    <View className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
                      <Text className="text-amber-400 text-xs font-semibold">{Number(log.lateMinutes)}m Late</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row justify-between pt-3 border-t border-slate-700/50">
                  <View className="flex-row items-center">
                    <Clock size={14} color="#94a3b8" />
                    <Text className="text-slate-300 text-xs ml-1.5 font-medium">In: {formatTimeStr(log.checkInTime as string | null)}</Text>
                  </View>
                  <View className="flex-row items-center">
                    {isCheckedOut ? (
                      <>
                        <CheckCircle size={14} color="#64748b" />
                        <Text className="text-slate-400 text-xs ml-1.5 font-medium">Out: {formatTimeStr(log.checkOutTime as string | null)}</Text>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} color="#22c55e" />
                        <Text className="text-emerald-400 text-xs ml-1.5 font-medium">Active</Text>
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View className="h-6" />
      </ScrollView>

      {/* Employee Detail Bottom Sheet Modal */}
      <Modal visible={bottomSheetVisible} transparent={true} animationType="slide" onRequestClose={closeUserSheet}>
        <View className="flex-1 justify-end bg-black/60">
          <TouchableOpacity className="flex-1" onPress={closeUserSheet} activeOpacity={1} />
          
          <View className="bg-[#0f172a] rounded-t-3xl border-t border-[#334155] p-5 pb-8 max-h-[85%]">
            {/* Handle Bar */}
            <View className="w-12 h-1.5 bg-slate-600 rounded-full self-center mb-5" />

            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-slate-50 font-bold text-xl">{((selectedUser?.user as Record<string, unknown>)?.fullName as string) || 'Employee'}</Text>
                <Text className="text-slate-400 text-sm mt-1">Performance Details (This Month)</Text>
              </View>
              <TouchableOpacity onPress={closeUserSheet} className="bg-slate-800 rounded-full p-2">
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loadingDetails ? (
                <View className="py-10 items-center">
                  <ActivityIndicator color="#60a5fa" />
                </View>
              ) : (
                <>
                  {/* Summary Section */}
                  <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-4">
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
                      Attendance Summary
                    </Text>
                    {summary ? (
                      <View>
                        <View className="flex-row justify-between mb-4">
                          <View className="items-center flex-1">
                            <Text className="text-slate-400 text-[10px] uppercase mb-1">Present</Text>
                            <Text className="text-slate-50 font-bold text-lg">{Number(summary.presentDays || 0)}</Text>
                          </View>
                          <View className="items-center flex-1 border-x border-slate-700/50">
                            <Text className="text-slate-400 text-[10px] uppercase mb-1">Absent</Text>
                            <Text className="text-slate-50 font-bold text-lg">{Number(summary.absentDays || 0)}</Text>
                          </View>
                          <View className="items-center flex-1">
                            <Text className="text-slate-400 text-[10px] uppercase mb-1">Late Days</Text>
                            <Text className="text-amber-400 font-bold text-lg">{Number(summary.lateDays || 0)}</Text>
                          </View>
                        </View>
                        <View className="bg-slate-800/50 rounded-lg p-3">
                          <View className="flex-row justify-between mb-2">
                            <Text className="text-slate-400 text-xs font-medium">On-Time Percentage</Text>
                            <Text className="text-slate-200 font-bold text-xs">{Number(summary.onTimePercentage || 0)}%</Text>
                          </View>
                          <View className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden mb-3">
                            <View className="h-full bg-blue-500 rounded-full" style={{ width: `${Number(summary.onTimePercentage || 0)}%` }} />
                          </View>
                          <Text className="text-amber-500 text-xs text-center font-medium">{Number(summary.lateMinutes || 0)} mins late this month</Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="text-slate-500 text-center text-sm py-4">No summary data available</Text>
                    )}
                  </View>

                  {/* Performance Section */}
                  <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-4">
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
                      Performance Report (Read-Only)
                    </Text>
                    {performance ? (
                      <View>
                        <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
                          <View className="flex-row items-center">
                            <Award size={20} color={Number(performance.disciplineScore || 0) > 85 ? '#22c55e' : Number(performance.disciplineScore || 0) >= 70 ? '#eab308' : '#ef4444'} />
                            <Text className="text-slate-200 font-medium ml-2">Discipline Score</Text>
                          </View>
                          <Text className={`font-bold text-lg ${Number(performance.disciplineScore || 0) > 85 ? 'text-green-400' : Number(performance.disciplineScore || 0) >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Number(performance.disciplineScore || 0)}/100
                          </Text>
                        </View>
                        
                        <View className="mb-2.5 flex-row justify-between items-center">
                          <Text className="text-slate-400 text-sm">Base Salary</Text>
                          <Text className="text-slate-300 text-sm font-medium">₹ {Number(performance.baseSalary || 0).toLocaleString('en-IN')}</Text>
                        </View>

                        {(Number(performance.deductionAmount || 0) > 0) && (
                          <View className="mb-2.5 flex-row justify-between items-center">
                            <View className="flex-row items-center">
                              <TrendingDown size={14} color="#ef4444" className="mr-1.5" />
                              <Text className="text-red-400 text-sm">Deductions</Text>
                            </View>
                            <Text className="text-red-400 text-sm font-medium">- ₹ {Number(performance.deductionAmount || 0).toLocaleString('en-IN')}</Text>
                          </View>
                        )}

                        {(Number(performance.bonusAmount || 0) > 0) && (
                          <View className="mb-2.5 flex-row justify-between items-center">
                            <View className="flex-row items-center">
                              <TrendingUp size={14} color="#22c55e" className="mr-1.5" />
                              <Text className="text-green-400 text-sm">Bonuses</Text>
                            </View>
                            <Text className="text-green-400 text-sm font-medium">+ ₹ {Number(performance.bonusAmount || 0).toLocaleString('en-IN')}</Text>
                          </View>
                        )}

                        <View className="mt-2 pt-4 border-t border-slate-700/50 flex-row justify-between items-center bg-slate-800/30 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                          <Text className="text-slate-200 font-bold text-base">Final Salary</Text>
                          <Text className="text-white font-bold text-xl">₹ {Number(performance.finalSalary || 0).toLocaleString('en-IN')}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="text-slate-500 text-center text-sm py-4">Report not generated yet</Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
