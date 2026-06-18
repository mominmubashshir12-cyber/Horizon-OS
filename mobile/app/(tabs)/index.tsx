// app/(tabs)/index.tsx
// Home tab screen — main dashboard landing page for Horizon OS.
// Integrates welcome headers, quick stats counters, and daily Attendance check-in / check-out tracker.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Briefcase,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Camera,
  MapPin,
  LogOut,
  Check,
  FileText,
  Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { apiGet, apiPost } from '../../services/api';
import { getOffline, saveOffline } from '../../services/offline';
import type { JobCard } from '../../types';

// ─── Quick Stat Component ──────────────────────────────────────────────────────

interface QuickStatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function QuickStat({ label, value, icon }: QuickStatProps): React.JSX.Element {
  return (
    <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 flex-1 mr-3 last:mr-0">
      <View className="flex-row items-center justify-between mb-2">
        {icon}
        <Text className="text-slate-50 font-bold text-lg">{value}</Text>
      </View>
      <Text className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">{label}</Text>
    </View>
  );
}

// ─── HomeScreen Screen Component ────────────────────────────────────────────────

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
    : '';

  // Attendance Status States
  const [attendance, setAttendance] = useState<{
    checkedIn: boolean;
    checkedOut: boolean;
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string | null;
  } | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Job Stats Counter States
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [completedJobsCount, setCompletedJobsCount] = useState<number>(0);

  // Attendance Summary States
  const [summary, setSummary] = useState<{
    presentDays?: number;
    lateDays?: number;
    absentDays?: number;
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Today's Sales States
  const [todaySales, setTodaySales] = useState<{
    count: number;
    revenue: number;
  } | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);

  // ─── Fetch Attendance Status ──────────────────────────────────────────────────

  const loadAttendanceStatus = useCallback(async () => {
    setLoadingAttendance(true);
    if (isOnline) {
      try {
        const res = await apiGet<any>('/attendance/status');
        if (res.success) {
          setAttendance(res.data);
          await saveOffline('attendance_status', res.data);
        }
      } catch (err) {
        console.warn('[Home] Failed to load attendance, checking cache:', err);
        await loadAttendanceFromCache();
      }
    } else {
      await loadAttendanceFromCache();
    }
    setLoadingAttendance(false);
  }, [isOnline]);

  const loadAttendanceFromCache = async () => {
    const cached = await getOffline<any>('attendance_status');
    if (cached && cached.data) {
      setAttendance(cached.data);
    } else {
      setAttendance(null);
    }
  };

  // ─── Fetch Job Metrics ───────────────────────────────────────────────────────

  const loadJobMetrics = useCallback(async () => {
    if (!isOnline) {
      // Load offline jobs cache to count status
      const cached = await getOffline<JobCard[]>('jobs');
      if (cached && cached.data) {
        setActiveJobsCount(cached.data.filter((j) => ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)).length);
        setCompletedJobsCount(cached.data.filter((j) => ['COMPLETED', 'VERIFIED'].includes(j.status)).length);
      }
      return;
    }
    try {
      const res = await apiGet<JobCard[]>('/jobcards');
      if (res.success) {
        setActiveJobsCount(res.data.filter((j) => ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)).length);
        setCompletedJobsCount(res.data.filter((j) => ['COMPLETED', 'VERIFIED'].includes(j.status)).length);
      }
    } catch (err) {
      console.warn('[Home] Job count fetch fail:', err);
    }
  }, [isOnline]);

  // ─── Fetch Attendance Summary ──────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    if (!user?.id) return;
    setLoadingSummary(true);
    const month = new Date().toISOString().slice(0, 7);
    
    try {
      const cached = await getOffline<Record<string, unknown>>('attendance_summary_current');
      if (cached && cached.data) setSummary(cached.data as { presentDays?: number, lateDays?: number, absentDays?: number });

      if (isOnline) {
        const res = await apiGet<Record<string, unknown>>(`/attendance/monthly-summary/${user.id}?month=${month}`);
        if (res.success && res.data) {
          setSummary(res.data as { presentDays?: number, lateDays?: number, absentDays?: number });
          await saveOffline('attendance_summary_current', res.data);
        }
      }
    } catch (err) {
      console.warn('[Home] Summary fetch fail:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [user?.id, isOnline]);

  // ─── Fetch Today's Sales ───────────────────────────────────────────────────────
  const loadTodaySales = useCallback(async () => {
    setLoadingSales(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    
    try {
      const cached = await getOffline<{ count: number; revenue: number }>('today_sales_cache');
      if (cached && cached.data) setTodaySales(cached.data);

      if (isOnline) {
        const res = await apiGet<{ count: number; revenue: number }>(`/sales/my-sales?startDate=${todayStr}&endDate=${todayStr}`);
        if (res.success && res.data) {
          setTodaySales(res.data);
          await saveOffline('today_sales_cache', res.data);
        }
      }
    } catch (err) {
      console.warn('[Home] Sales fetch fail:', err);
    } finally {
      setLoadingSales(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadAttendanceStatus();
    loadJobMetrics();
    loadSummary();
    loadTodaySales();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadAttendanceStatus();
        loadSummary();
        loadTodaySales();
      }
    });
    
    return () => subscription.remove();
  }, [loadAttendanceStatus, loadJobMetrics, loadSummary, loadTodaySales]);

  // ─── Check-In Handler ────────────────────────────────────────────────────────

  const handleCheckIn = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to check in and verify your shift location.');
      return;
    }

    try {
      setIsActionLoading(true);

      // 1. Camera Permissions & Selfie Capture
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPerm.status !== 'granted') {
        Alert.alert('Camera Required', 'Selfie verification photo is required to log check-in.');
        setIsActionLoading(false);
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.3,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.base64) {
        setIsActionLoading(false);
        return;
      }

      const base64Photo = `data:image/jpeg;base64,${pickerResult.assets[0].base64}`;

      // 2. GPS Location Coordinates
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Location Required', 'Location coordinate verification is required to log check-in.');
        setIsActionLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // 3. Dispatch check-in to API
      const res = await apiPost<any>('/attendance/checkin', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo: base64Photo,
      });

      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Check-In Success',
          text2: res.message,
        });
        loadAttendanceStatus();
      }
    } catch (err: any) {
      Alert.alert('Check-In Error', err.response?.data?.message || 'Failed to complete check-in');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ─── Check-Out Handler ───────────────────────────────────────────────────────

  const handleCheckOut = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to check out.');
      return;
    }

    Alert.alert(
      'Confirm Check-Out',
      'Are you sure you want to check out and complete your shift today?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          onPress: async () => {
            try {
              setIsActionLoading(true);
              const res = await apiPost<any>('/attendance/checkout');
              if (res.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Checked Out',
                  text2: res.message,
                });
                loadAttendanceStatus();
              }
            } catch (err: any) {
              Alert.alert('Check-Out Error', err.response?.data?.message || 'Failed to complete check-out');
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── Format Time ─────────────────────────────────────────────────────────────

  const formatTimeStr = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      <ScrollView className="flex-1 px-4 pt-4">
        {/* ── Welcome Header ──────────────────────────────────── */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
              Horizon IT Solutions
            </Text>
            <Text className="text-slate-50 text-2xl font-bold mt-1">
              {user?.fullName ?? 'User'}
            </Text>
            <View className="flex-row items-center mt-1.5">
              <View className="bg-blue-900/40 rounded-full px-3 py-0.5">
                <Text className="text-blue-400 text-xs font-semibold uppercase">
                  {roleLabel}
                </Text>
              </View>
            </View>
          </View>
          <View className="bg-blue-600/10 border border-blue-600/20 rounded-full p-2">
            <Clock size={20} color="#60a5fa" />
          </View>
        </View>

        {/* ── Attendance check-in / check-out widget ──────────────────── */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-5 shadow-lg">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Shift Attendance Tracker
          </Text>

          {loadingAttendance ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-slate-400 text-xs mt-2">Loading shift status...</Text>
            </View>
          ) : !attendance?.checkedIn ? (
            // State 1: Not Checked In
            <View className="items-center py-4">
              <View className="bg-red-500/10 rounded-full p-3 mb-3">
                <AlertCircle size={28} color="#ef4444" />
              </View>
              <Text className="text-slate-50 font-bold text-base mb-1">
                Not Checked In Today
              </Text>
              <Text className="text-slate-400 text-xs text-center mb-5 px-6 leading-4">
                Please complete selfie verification and log coordinates to mark your shift start.
              </Text>

              <TouchableOpacity
                disabled={isActionLoading}
                onPress={handleCheckIn}
                activeOpacity={0.7}
                className="w-full bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center shadow"
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Camera size={16} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Start Shift (Check In)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : !attendance.checkedOut ? (
            // State 2: Checked In, Pending Check-Out
            <View className="py-2">
              <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
                <View className="flex-row items-center">
                  <CheckCircle size={18} color="#22c55e" />
                  <Text className="text-slate-50 font-bold text-sm ml-2">
                    Shift Active
                  </Text>
                </View>
                <Text className="text-slate-400 text-xs font-medium">
                  In at: {formatTimeStr(attendance.checkInTime)}
                </Text>
              </View>

              <Text className="text-slate-300 text-xs leading-4 mb-5 text-center px-4">
                Your coordinates and selfie logs were uploaded successfully. Remember to log your check-out once your shift is complete.
              </Text>

              <TouchableOpacity
                disabled={isActionLoading}
                onPress={handleCheckOut}
                activeOpacity={0.7}
                className="w-full bg-amber-600 rounded-xl py-3.5 flex-row items-center justify-center shadow"
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <LogOut size={16} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      End Shift (Check Out)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // State 3: Shift Completed (Checked Out)
            <View className="items-center py-4">
              <View className="bg-emerald-500/10 rounded-full p-3 mb-3">
                <Check size={28} color="#10b981" />
              </View>
              <Text className="text-emerald-400 font-bold text-base mb-1">
                Shift Completed
              </Text>
              <Text className="text-slate-400 text-xs text-center mb-4 leading-4">
                Thank you. Your shift details have been successfully recorded.
              </Text>

              <View className="w-full bg-[#0f172a] rounded-xl px-4 py-3 border border-slate-800 flex-row justify-between mt-1">
                <View className="items-center flex-1">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase">Check In</Text>
                  <Text className="text-slate-200 font-bold text-sm mt-0.5">
                    {formatTimeStr(attendance.checkInTime)}
                  </Text>
                </View>
                <View className="w-[1] bg-slate-800 h-full" />
                <View className="items-center flex-1">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase">Check Out</Text>
                  <Text className="text-slate-200 font-bold text-sm mt-0.5">
                    {formatTimeStr(attendance.checkOutTime)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── My Attendance This Month ──────────────────────── */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-5 shadow-lg">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-4">
            My Attendance This Month
          </Text>
          {loadingSummary && !summary ? (
            <View className="flex-row justify-between">
              <View className="h-16 w-[30%] bg-slate-800 rounded-xl animate-pulse" />
              <View className="h-16 w-[30%] bg-slate-800 rounded-xl animate-pulse" />
              <View className="h-16 w-[30%] bg-slate-800 rounded-xl animate-pulse" />
            </View>
          ) : (
            <View className="flex-row justify-between">
              <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex-1 mr-2 items-center">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Present</Text>
                <Text className="text-emerald-400 font-bold text-xl">{summary?.presentDays ?? 0}</Text>
              </View>
              <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex-1 mx-1 items-center">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Late</Text>
                <Text className="text-amber-400 font-bold text-xl">{summary?.lateDays ?? 0}</Text>
              </View>
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex-1 ml-2 items-center">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Absent</Text>
                <Text className="text-red-400 font-bold text-xl">{summary?.absentDays ?? 0}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Today's Sales ──────────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-5 shadow-lg">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-4">
            Today's Sales
          </Text>
          {loadingSales && !todaySales ? (
            <View className="flex-row justify-between">
              <View className="h-16 w-[48%] bg-slate-800 rounded-xl animate-pulse" />
              <View className="h-16 w-[48%] bg-slate-800 rounded-xl animate-pulse" />
            </View>
          ) : todaySales?.count === 0 ? (
            <Text className="text-slate-400 text-sm text-center py-2 font-medium">No sales recorded today</Text>
          ) : (
            <View className="flex-row justify-between">
              <View className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex-1 mr-2 items-center">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Sales Count</Text>
                <Text className="text-blue-400 font-bold text-xl">{todaySales?.count ?? 0}</Text>
              </View>
              <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex-1 ml-2 items-center">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Revenue</Text>
                <Text className="text-emerald-400 font-bold text-xl">
                  ₹{(todaySales?.revenue ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Quick Stats Row ─────────────────────────────────── */}
        <View className="flex-row mb-4">
          <QuickStat
            label="Active Jobs"
            value={String(activeJobsCount)}
            icon={<Briefcase size={16} color="#60a5fa" />}
          />
          <QuickStat
            label="Completed"
            value={String(completedJobsCount)}
            icon={<CheckCircle size={16} color="#4ade80" />}
          />
        </View>

        {/* ── Coming Soon Highlights (Standard stubs) ────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <View className="bg-purple-900/20 rounded-lg p-2 mr-3">
              <TrendingUp size={18} color="#a78bfa" />
            </View>
            <View>
              <Text className="text-slate-50 font-semibold text-sm">Monthly Metrics</Text>
              <Text className="text-slate-400 text-xs">Performance highlights coming soon</Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <View className="mb-4">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Quick Actions
          </Text>
          <View className="flex-row justify-between">
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/quotation/new')}
              className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 flex-1 items-center mr-2 shadow-sm"
            >
              <View className="bg-blue-500/10 p-2 rounded-full mb-2">
                <FileText size={20} color="#60a5fa" />
              </View>
              <Text className="text-slate-200 text-xs font-semibold text-center">New Quotation</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/jobs')}
              className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 flex-1 items-center mx-1 shadow-sm"
            >
              <View className="bg-emerald-500/10 p-2 rounded-full mb-2">
                <Briefcase size={20} color="#34d399" />
              </View>
              <Text className="text-slate-200 text-xs font-semibold text-center">My Jobs</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/prices')}
              className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 flex-1 items-center ml-2 shadow-sm"
            >
              <View className="bg-amber-500/10 p-2 rounded-full mb-2">
                <Search size={20} color="#fbbf24" />
              </View>
              <Text className="text-slate-200 text-xs font-semibold text-center">Price Lookup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacer */}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
