// app/(tabs)/index.tsx
// Home tab screen — main dashboard landing page for Horizon OS.
// Integrates welcome headers, quick stats counters, and daily Attendance check-in / check-out tracker.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  TextInput,
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
  Utensils,
  AlertTriangle,
  Info
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { apiGet, apiPost, apiPut } from '../../services/api';
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
    isCheckedIn: boolean;
    isOnLunch: boolean;
    isCheckedOut: boolean;
    lunchStartTime: string | null;
    lunchEndTime: string | null;
    lunchDurationMins: number;
    lunchFlag: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    checkoutAuto: boolean;
    pendingCorrectionRequest: boolean;
    isMultiDay?: boolean;
    expectedCheckoutDate?: string | null;
  } | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Lunch Timer
  const [lunchSeconds, setLunchSeconds] = useState(0);
  const lunchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [checkoutCooldown, setCheckoutCooldown] = useState(true);
  
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionType, setCorrectionType] = useState('UNDO_CHECKOUT');
  const [correctionReason, setCorrectionReason] = useState('');

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

  // Incoming Tool Transfers
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);

  // Early Job Completion Check
  const [hasEarlyCompletedJob, setHasEarlyCompletedJob] = useState(false);

  // ─── Fetch Attendance Status ──────────────────────────────────────────────────

  const loadAttendanceStatus = useCallback(async () => {
    setLoadingAttendance(true);
    if (isOnline) {
      try {
        const res = await apiGet<any>('/attendance/today-status');
        if (res.success) {
          setAttendance(res.data);
          await saveOffline('attendance_today_status', res.data);
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
    const cached = await getOffline<any>('attendance_today_status');
    if (cached && cached.data) {
      setAttendance(cached.data);
    } else {
      setAttendance(null);
    }
  };

  // Lunch Timer Effect
  useEffect(() => {
    if (attendance?.isOnLunch && attendance.lunchStartTime) {
      const startMs = new Date(attendance.lunchStartTime).getTime();
      
      const updateTimer = () => {
        const nowMs = Date.now();
        setLunchSeconds(Math.floor((nowMs - startMs) / 1000));
      };
      
      updateTimer();
      lunchTimerRef.current = setInterval(updateTimer, 1000);
    } else {
      setLunchSeconds(0);
      if (lunchTimerRef.current) clearInterval(lunchTimerRef.current);
    }

    return () => {
      if (lunchTimerRef.current) clearInterval(lunchTimerRef.current);
    };
  }, [attendance?.isOnLunch, attendance?.lunchStartTime]);

  // ─── Fetch Job Metrics ───────────────────────────────────────────────────────

  const loadJobMetrics = useCallback(async () => {
    if (!isOnline) {
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
        const jobs = ((res.data as any).data ?? res.data) as JobCard[];
        setActiveJobsCount(jobs.filter((j) => ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)).length);
        setCompletedJobsCount(jobs.filter((j) => ['COMPLETED', 'VERIFIED'].includes(j.status)).length);

        setHasEarlyCompletedJob(jobs.some((j) => ['COMPLETED', 'VERIFIED'].includes(j.status)));
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

  // ─── Fetch Incoming Transfers ────────────────────────────────────────────────
  const loadTransfers = useCallback(async () => {
    if (!isOnline) return;
    setLoadingTransfers(true);
    try {
      const res = await apiGet<any[]>('/tools/transfers/incoming');
      if (res.success) setIncomingTransfers(res.data);
    } catch (err) {
      console.warn('[Home] Transfers fetch fail:', err);
    } finally {
      setLoadingTransfers(false);
    }
  }, [isOnline]);

  const handleRespondTransfer = async (transferId: number, action: 'accept' | 'decline', condition: 'GOOD' | 'DAMAGED' = 'GOOD') => {
    try {
      setIsActionLoading(true);
      const endpoint = `/tools/transfers/${transferId}/${action}`;
      const payload = action === 'accept' ? { receivedCondition: condition, note: `Accepted from Home screen` } : {};
      
      const res = await (action === 'accept' ? apiPut(endpoint, payload) : apiPut(endpoint));
      if ((res as any).success) {
        Toast.show({ type: 'success', text1: `Transfer ${action}ed successfully.` });
        loadTransfers();
      }
    } catch (err: any) {
      console.error('[Home] Transfer error:', err);
      Alert.alert('Error', err.response?.data?.message || err.message || `Failed to ${action} transfer`);
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceStatus();
    loadJobMetrics();
    loadSummary();
    loadTodaySales();
    loadTransfers();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadAttendanceStatus();
        loadSummary();
        loadTodaySales();
        loadTransfers();
      }
    });
    
    return () => subscription.remove();
  }, [loadAttendanceStatus, loadJobMetrics, loadSummary, loadTodaySales, loadTransfers]);

  // ─── Check-In Handler ────────────────────────────────────────────────────────

  const handleCheckIn = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to check in and verify your shift location.');
      return;
    }

    try {
      setIsActionLoading(true);

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

      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Location Required', 'Location coordinate verification is required to log check-in.');
        setIsActionLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

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

  // ─── Lunch Handlers ─────────────────────────────────────────────────────────
  const handleLunchStart = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required.');
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await apiPost<any>('/attendance/lunch-start');
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Lunch Break Started' });
        loadAttendanceStatus();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to start lunch break');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLunchEnd = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required.');
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await apiPost<any>('/attendance/lunch-end');
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Welcome Back from Lunch' });
        loadAttendanceStatus();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to end lunch break');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ─── Check-Out Handlers ──────────────────────────────────────────────────────

  const openCheckoutConfirm = () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to check out.');
      return;
    }
    setShowCheckoutConfirm(true);
    setCheckoutCooldown(true);
    setTimeout(() => {
      setCheckoutCooldown(false);
    }, 2000);
  };

  const handleCheckOut = async () => {
    try {
      setIsActionLoading(true);
      setShowCheckoutConfirm(false);
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
  };

  // ─── Correction Request Handler ─────────────────────────────────────────────
  
  const submitCorrectionRequest = async () => {
    if (correctionReason.length < 10) {
      Alert.alert('Validation Error', 'Reason must be at least 10 characters long.');
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await apiPost<any>('/attendance/correction-request', {
        requestType: correctionType,
        reason: correctionReason,
      });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Correction request submitted. Awaiting owner approval.' });
        setShowCorrectionModal(false);
        setCorrectionReason('');
        loadAttendanceStatus();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsActionLoading(false);
    }
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

  const formatDuration = (startTime: string | null) => {
    if (!startTime) return '0h 0m';
    const diff = Date.now() - new Date(startTime).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const lunchTimerColor = lunchSeconds >= 5400 ? '#ef4444' : lunchSeconds >= 3600 ? '#f59e0b' : '#10b981';

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
        {attendance?.pendingCorrectionRequest && (
           <View className="bg-blue-900/40 border border-blue-600/50 rounded-xl p-3 mb-4 flex-row items-center">
             <Info size={16} color="#60a5fa" />
             <Text className="text-blue-300 text-xs ml-2 font-medium flex-1">
               Correction request pending owner approval
             </Text>
           </View>
        )}

        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-5 shadow-lg">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Shift Attendance Tracker
          </Text>

          {loadingAttendance ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-slate-400 text-xs mt-2">Loading shift status...</Text>
            </View>
          ) : !attendance?.isCheckedIn ? (
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
          ) : attendance?.isOnLunch ? (
            // State 3: On Lunch Break
            <View className="items-center py-4">
              <View className="bg-orange-500/10 rounded-full p-3 mb-3">
                <Utensils size={28} color={lunchTimerColor} />
              </View>
              <Text style={{ color: lunchTimerColor }} className="font-bold text-2xl mb-1">
                Lunch: {formatTimer(lunchSeconds)}
              </Text>
              
              {lunchSeconds >= 5400 && (
                <Text className="text-red-400 text-xs font-bold mb-4">Lunch overtime — return immediately</Text>
              )}
              {lunchSeconds < 5400 && (
                <Text className="text-slate-400 text-xs mb-4">Enjoy your meal.</Text>
              )}

              <TouchableOpacity
                disabled={isActionLoading}
                onPress={handleLunchEnd}
                activeOpacity={0.7}
                className="w-full bg-emerald-600 rounded-xl py-3.5 flex-row items-center justify-center shadow"
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <CheckCircle size={16} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Back from Lunch
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : !attendance.isCheckedOut ? (
            // State 2: Checked In, Pending Check-Out
            <View className="py-2">
              <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
                <View className="flex-row items-center">
                  {attendance.isMultiDay ? (
                    <MapPin size={18} color="#c084fc" />
                  ) : (
                    <CheckCircle size={18} color="#22c55e" />
                  )}
                  <Text className="text-slate-50 font-bold text-sm ml-2">
                    {attendance.isMultiDay ? 'FIELD DEPLOYMENT' : 'Shift Active'}
                  </Text>
                </View>
                <Text className="text-slate-400 text-xs font-medium">
                  {attendance.isMultiDay && attendance.checkInTime 
                    ? `Day ${Math.ceil((Date.now() - new Date(attendance.checkInTime).getTime()) / 86400000)} of deployment` 
                    : `${formatDuration(attendance.checkInTime)} working`}
                </Text>
              </View>

              <Text className="text-slate-300 text-xs leading-4 mb-2 text-center px-4">
                In at: {formatTimeStr(attendance.checkInTime)}
              </Text>

              {attendance.isMultiDay && attendance.expectedCheckoutDate ? (
                <>
                  <Text className="text-purple-300 text-xs leading-4 mb-5 text-center px-4 font-medium">
                    Expected return: {new Date(attendance.expectedCheckoutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + new Date(attendance.expectedCheckoutDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </Text>
                  
                  {new Date(attendance.expectedCheckoutDate).getTime() - Date.now() > 0 && 
                   new Date(attendance.expectedCheckoutDate).getTime() - Date.now() <= 4 * 60 * 60 * 1000 && (
                    <View className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 mx-2 flex-row items-center">
                      <AlertTriangle size={16} color="#f59e0b" />
                      <Text className="text-orange-400 text-xs ml-2 font-medium flex-1">
                        Deployment ending soon — contact manager to extend if needed
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View className="mb-3" />
              )}

              {attendance.isMultiDay && hasEarlyCompletedJob && (
                <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 mx-2 flex-col items-center">
                  <View className="flex-row items-center mb-3">
                    <AlertCircle size={16} color="#eab308" />
                    <Text className="text-yellow-400 text-xs ml-2 font-bold flex-1 text-center">
                      Your job is marked complete. Please check out if you are done.
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={isActionLoading}
                    onPress={openCheckoutConfirm}
                    activeOpacity={0.7}
                    className="w-full bg-yellow-600 rounded-lg py-2.5 flex-row items-center justify-center shadow"
                  >
                    <LogOut size={14} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Check Out Now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View className="flex-row justify-between">
                <TouchableOpacity
                  disabled={isActionLoading}
                  onPress={handleLunchStart}
                  activeOpacity={0.7}
                  className="flex-1 bg-orange-600 rounded-xl py-3.5 flex-row items-center justify-center shadow mr-2"
                >
                  <Utensils size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm ml-2">
                    Lunch Break
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isActionLoading}
                  onPress={openCheckoutConfirm}
                  activeOpacity={0.7}
                  className="flex-1 bg-red-600 rounded-xl py-3.5 flex-row items-center justify-center shadow ml-2"
                >
                  <LogOut size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm ml-2">
                    Check Out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // State 4: Shift Completed (Checked Out)
            <View className="py-2">
              <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
                <View className="flex-row items-center justify-center mb-3">
                  <Check size={24} color="#10b981" />
                  <Text className="text-emerald-400 font-bold text-lg ml-2">Shift Completed</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-400 text-xs">Check In:</Text>
                  <Text className="text-slate-200 text-xs font-bold">{formatTimeStr(attendance.checkInTime)}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-400 text-xs">Check Out:</Text>
                  <Text className="text-slate-200 text-xs font-bold">{formatTimeStr(attendance.checkOutTime)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs">Total Duration:</Text>
                  <Text className="text-slate-200 text-xs font-bold">
                    {attendance.checkInTime && attendance.checkOutTime ? (
                      `${Math.floor((new Date(attendance.checkOutTime).getTime() - new Date(attendance.checkInTime).getTime()) / 3600000)}h ${Math.floor(((new Date(attendance.checkOutTime).getTime() - new Date(attendance.checkInTime).getTime()) % 3600000) / 60000)}m`
                    ) : '—'}
                  </Text>
                </View>
              </View>

              {attendance.checkoutAuto && (
                <View className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 mb-4 flex-row items-center">
                  <AlertTriangle size={14} color="#f59e0b" />
                  <Text className="text-orange-400 text-[11px] ml-2 font-medium flex-1">
                    Auto checkout was applied at 9:00 PM
                  </Text>
                </View>
              )}

              {!attendance.pendingCorrectionRequest && (
                <TouchableOpacity
                  onPress={() => setShowCorrectionModal(true)}
                  className="bg-slate-800 rounded-lg py-2 items-center border border-slate-700"
                >
                  <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">Report Issue</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── Incoming Tool Transfers ────────────────────────── */}
        {incomingTransfers.length > 0 && (
          <View className="mb-5">
            <Text className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider mb-2">
              Incoming Tool Transfers ({incomingTransfers.length})
            </Text>
            {incomingTransfers.map((transfer: any) => (
              <View key={transfer.id} className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-2xl p-4 mb-3 shadow-sm">
                <View className="flex-row items-start mb-3">
                  <View className="bg-[#f59e0b]/20 p-2 rounded-full mr-3 mt-1">
                    <AlertTriangle size={18} color="#f59e0b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-sm mb-0.5">
                      {transfer.tool?.name} ({transfer.tool?.toolCode})
                    </Text>
                    <Text className="text-slate-300 text-xs leading-4">
                      <Text className="text-slate-400">From: </Text>
                      {transfer.fromUser?.fullName}
                    </Text>
                    {transfer.jobCard && (
                      <Text className="text-slate-400 text-xs leading-4 mt-0.5">
                        For Job: {transfer.jobCard.jobNumber}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="flex-row space-x-3 gap-2">
                  <TouchableOpacity
                    disabled={isActionLoading}
                    onPress={() => handleRespondTransfer(transfer.id, 'decline')}
                    className="flex-1 bg-transparent border border-red-500/50 rounded-xl py-2.5 items-center justify-center"
                  >
                    <Text className="text-red-400 font-bold text-xs">Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isActionLoading}
                    onPress={() => handleRespondTransfer(transfer.id, 'accept')}
                    className="flex-1 bg-[#f59e0b] rounded-xl py-2.5 items-center justify-center"
                  >
                    <Text className="text-slate-900 font-bold text-xs">Accept (Good)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

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
              onPress={() => router.push('/products')}
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

      {/* ── MODALS ─────────────────────────────────────────── */}
      
      {/* Checkout Confirm Modal */}
      <Modal visible={showCheckoutConfirm} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl p-6 pb-10">
            <Text className="text-slate-50 text-lg font-bold mb-2">Confirm Check Out</Text>
            <Text className="text-slate-300 text-sm mb-6">
              Are you sure you want to check out? You will need owner approval to undo this.
            </Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setShowCheckoutConfirm(false)}
                className="flex-1 bg-slate-700 rounded-xl py-3.5 mr-2 items-center"
              >
                <Text className="text-slate-200 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={checkoutCooldown || isActionLoading}
                onPress={handleCheckOut}
                className={`flex-1 rounded-xl py-3.5 ml-2 items-center ${checkoutCooldown ? 'bg-red-900/50' : 'bg-red-600'}`}
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text className={`font-bold ${checkoutCooldown ? 'text-red-300/50' : 'text-white'}`}>
                    Yes, Check Out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Correction Request Modal */}
      <Modal visible={showCorrectionModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl p-6 pb-10 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-slate-50 text-lg font-bold">Report Issue</Text>
              <TouchableOpacity onPress={() => setShowCorrectionModal(false)}>
                <Text className="text-slate-400 font-bold">Close</Text>
              </TouchableOpacity>
            </View>
            
            <Text className="text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">Request Type</Text>
            <View className="flex-row bg-slate-800 rounded-xl p-1 mb-4">
              {['UNDO_CHECKOUT', 'CORRECT_CHECKOUT_TIME', 'CORRECT_CHECKIN_TIME'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setCorrectionType(type)}
                  className={`flex-1 py-2 rounded-lg items-center ${correctionType === type ? 'bg-blue-600' : 'bg-transparent'}`}
                >
                  <Text className={`text-[10px] font-bold text-center ${correctionType === type ? 'text-white' : 'text-slate-400'}`}>
                    {type.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">Reason</Text>
            <TextInput
              className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 mb-2 h-24"
              placeholderTextColor="#64748b"
              placeholder="Why do you need this correction? (Min 10 chars)"
              multiline
              textAlignVertical="top"
              value={correctionReason}
              onChangeText={setCorrectionReason}
            />
            <Text className={`text-xs text-right mb-6 ${correctionReason.length < 10 ? 'text-red-400' : 'text-emerald-400'}`}>
              {correctionReason.length} chars
            </Text>

            <TouchableOpacity
              disabled={isActionLoading || correctionReason.length < 10}
              onPress={submitCorrectionRequest}
              className={`w-full rounded-xl py-4 items-center ${correctionReason.length < 10 ? 'bg-blue-900/50' : 'bg-blue-600'}`}
            >
              {isActionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-bold ${correctionReason.length < 10 ? 'text-blue-300/50' : 'text-white'}`}>
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
