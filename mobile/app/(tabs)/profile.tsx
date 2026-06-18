// app/(tabs)/profile.tsx
// Profile tab screen — displays the current user's profile information
// and provides a logout button. Shows user details from AuthContext:
// full name, username, email, phone, role, and account status.

import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Phone,
  Shield,
  LogOut,
  ChevronRight,
  Bell,
  Settings,
  HelpCircle,
  Info,
  ChevronLeft,
  Calendar,
  Award,
  TrendingDown,
  TrendingUp,
  FileText,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import LoadingOverlay from '../../components/LoadingOverlay';
import { apiGet } from '../../services/api';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quotation {
  id: string;
  clientName: string;
  grandTotal: number;
  status: string;
  items?: QuotationItem[];
  subtotal?: number;
  tax?: number;
}

// ─── Profile Row Component ─────────────────────────────────────────────────────

interface ProfileRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ProfileRow({ icon, label, value }: ProfileRowProps): React.JSX.Element {
  return (
    <View className="flex-row items-center py-3 border-b border-[#334155]">
      <View className="mr-4">{icon}</View>
      <View className="flex-1">
        <Text className="text-slate-400 text-xs mb-0.5">{label}</Text>
        <Text className="text-slate-50 text-base">{value}</Text>
      </View>
    </View>
  );
}

// ─── Menu Item Component ───────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
}: MenuItemProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center py-3.5 border-b border-[#334155]"
    >
      <View className="mr-4">{icon}</View>
      <Text
        className={`flex-1 text-base ${
          danger ? 'text-red-400' : 'text-slate-50'
        }`}
      >
        {label}
      </Text>
      <ChevronRight size={18} color={danger ? '#f87171' : '#64748b'} />
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen(): React.JSX.Element {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Any unsynced changes will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [logout]);

  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
    : 'Unknown';

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [performance, setPerformance] = useState<Record<string, unknown> | null>(null);
  const [myQuotations, setMyQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // @ts-ignore
  const minDate = user?.employmentStart ? new Date(user.employmentStart) : new Date(new Date().getFullYear(), 0, 1);
  const isPrevDisabled = selectedMonth.getFullYear() <= minDate.getFullYear() && selectedMonth.getMonth() <= minDate.getMonth();
  const maxDate = new Date();
  const isNextDisabled = selectedMonth.getFullYear() >= maxDate.getFullYear() && selectedMonth.getMonth() >= maxDate.getMonth();

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      setLoadingData(true);
      
      const tzOffset = new Date().getTimezoneOffset() * 60000; 
      const localISOTime = (new Date(selectedMonth.getTime() - tzOffset)).toISOString().slice(0, -1);
      const monthStr = localISOTime.slice(0, 7);

      try {
        const [sumRes, perfRes, quotRes] = await Promise.all([
          apiGet<Record<string, unknown>>(`/attendance/monthly-summary/${user.id}?month=${monthStr}`),
          apiGet<Record<string, unknown>>(`/attendance/performance/${user.id}?month=${monthStr}`),
          apiGet<Quotation[]>('/quotations')
        ]);
        
        if (sumRes.success && sumRes.data) setSummary(sumRes.data);
        else setSummary(null);

        if (perfRes.success && perfRes.data) setPerformance(perfRes.data);
        else setPerformance(null);

        if (quotRes.success && quotRes.data) {
          setMyQuotations(quotRes.data.slice(0, 5));
        } else {
          setMyQuotations([]);
        }
      } catch (e) {
        setSummary(null);
        setPerformance(null);
        setMyQuotations([]);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [selectedMonth, user?.id]);

  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
    : 'Unknown';

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      <LoadingOverlay visible={isLoggingOut} message="Signing out..." />

      <ScrollView className="flex-1 px-4 pt-4">
        {/* ── Avatar & Name Header ────────────────────────────── */}
        <View className="items-center mb-6">
          {/* Avatar Circle */}
          <View className="bg-blue-600 rounded-full w-20 h-20 items-center justify-center mb-3">
            <Text className="text-white font-bold text-2xl">
              {user?.fullName
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) ?? 'U'}
            </Text>
          </View>

          <Text className="text-slate-50 font-bold text-xl">
            {user?.fullName ?? 'User'}
          </Text>
          <Text className="text-slate-400 text-sm mt-1">
            @{user?.username ?? 'unknown'}
          </Text>

          {/* Role Badge */}
          <View className="bg-blue-900/40 rounded-full px-4 py-1 mt-2">
            <Text className="text-blue-400 text-xs font-semibold">
              {roleLabel}
            </Text>
          </View>
        </View>

        {/* ── Account Details Card ────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] px-4 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider py-3">
            Account Details
          </Text>

          <ProfileRow
            icon={<User size={18} color="#94a3b8" />}
            label="Full Name"
            value={user?.fullName ?? '—'}
          />
          <ProfileRow
            icon={<Mail size={18} color="#94a3b8" />}
            label="Email"
            value={user?.email ?? '—'}
          />
          <ProfileRow
            icon={<Phone size={18} color="#94a3b8" />}
            label="Phone"
            value={user?.phone ?? '—'}
          />
          <ProfileRow
            icon={<Shield size={18} color="#94a3b8" />}
            label="Role"
            value={roleLabel}
          />
        </View>

        {/* ── Month Selector ──────────────────────────────────── */}
        <View className="flex-row items-center justify-between bg-[#1e293b] rounded-xl border border-[#334155] p-3 mb-4">
          <TouchableOpacity onPress={handlePrevMonth} disabled={isPrevDisabled} className={`p-2 ${isPrevDisabled ? 'opacity-30' : ''}`}>
            <ChevronLeft size={20} color="#94a3b8" />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <Calendar size={16} color="#60a5fa" className="mr-2" />
            <Text className="text-slate-50 font-bold text-base">
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={handleNextMonth} disabled={isNextDisabled} className={`p-2 ${isNextDisabled ? 'opacity-30' : ''}`}>
            <ChevronRight size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* ── Attendance Summary ──────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Attendance Summary
          </Text>
          {loadingData ? (
            <ActivityIndicator color="#60a5fa" />
          ) : summary ? (
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

        {/* ── Performance Report ──────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-6">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Performance Report
          </Text>
          {loadingData ? (
             <ActivityIndicator color="#60a5fa" />
          ) : performance ? (
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
            <Text className="text-slate-500 text-center text-sm py-8 font-medium">Report not generated yet</Text>
          )}
        </View>

        {/* ── My Quotations ────────────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
            My Quotations (Last 5)
          </Text>
          {loadingData ? (
             <ActivityIndicator color="#60a5fa" />
          ) : myQuotations.length > 0 ? (
            myQuotations.map((q) => (
              <TouchableOpacity
                key={q.id}
                onPress={() => setSelectedQuotation(q)}
                className="flex-row items-center justify-between py-3 border-b border-slate-700/50 last:border-0"
              >
                <View className="flex-row items-center flex-1">
                  <View className="bg-blue-500/10 p-2 rounded-full mr-3">
                    <FileText size={16} color="#60a5fa" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-200 font-medium text-sm mb-0.5">{q.clientName}</Text>
                    <Text className="text-slate-400 text-[10px]">ID: {q.id.substring(0, 8)} • {q.status}</Text>
                  </View>
                </View>
                <Text className="text-emerald-400 font-bold text-sm">
                  ₹{Number(q.grandTotal || 0).toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-slate-500 text-center text-sm py-4 font-medium">No quotations found</Text>
          )}
        </View>

        {/* ── Settings Menu ───────────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] px-4 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider py-3">
            Settings
          </Text>

          <MenuItem
            icon={<Bell size={18} color="#94a3b8" />}
            label="Notifications"
          />
          <MenuItem
            icon={<Settings size={18} color="#94a3b8" />}
            label="Preferences"
          />
          <MenuItem
            icon={<HelpCircle size={18} color="#94a3b8" />}
            label="Help & Support"
          />
          <MenuItem
            icon={<Info size={18} color="#94a3b8" />}
            label="About Horizon OS"
          />
        </View>

        {/* ── Logout ──────────────────────────────────────────── */}
        <View className="bg-[#1e293b] rounded-xl border border-[#334155] px-4 mb-4">
          <MenuItem
            icon={<LogOut size={18} color="#f87171" />}
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* ── Version Footer ──────────────────────────────────── */}
        <Text className="text-slate-500 text-xs text-center mt-4 mb-6">
          Horizon OS Mobile v1.0.0
        </Text>
      </ScrollView>

      {/* Quotation Details Bottom Sheet */}
      <Modal
        visible={!!selectedQuotation}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedQuotation(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#0f172a] rounded-t-3xl min-h-[50%] p-5 border-t border-slate-700">
            <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-slate-800">
              <View>
                <Text className="text-slate-50 font-bold text-lg">{selectedQuotation?.clientName}</Text>
                <Text className="text-slate-400 text-xs mt-1">Status: {selectedQuotation?.status}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedQuotation(null)} className="p-2 bg-slate-800 rounded-full">
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4 max-h-[300px]">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Items</Text>
              {selectedQuotation?.items?.map((item, idx) => (
                <View key={idx} className="flex-row justify-between py-2 border-b border-slate-800/50">
                  <View className="flex-1">
                    <Text className="text-slate-300 text-sm">{item.description || 'Item'}</Text>
                    <Text className="text-slate-500 text-xs">{item.quantity} x ₹{Number(item.unitPrice).toLocaleString('en-IN')}</Text>
                  </View>
                  <Text className="text-slate-300 text-sm">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</Text>
                </View>
              ))}
              {!selectedQuotation?.items?.length && (
                <Text className="text-slate-500 text-sm py-2">No items listed.</Text>
              )}
            </ScrollView>

            <View className="border-t border-slate-800 pt-4 space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-slate-400 text-sm">Subtotal</Text>
                <Text className="text-slate-300 text-sm">₹{Number(selectedQuotation?.subtotal || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View className="flex-row justify-between mt-1">
                <Text className="text-slate-400 text-sm">Tax</Text>
                <Text className="text-slate-300 text-sm">₹{Number(selectedQuotation?.tax || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View className="flex-row justify-between mt-2 pt-2 border-t border-slate-800">
                <Text className="text-slate-50 font-bold text-lg">Grand Total</Text>
                <Text className="text-emerald-400 font-bold text-lg">₹{Number(selectedQuotation?.grandTotal || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
