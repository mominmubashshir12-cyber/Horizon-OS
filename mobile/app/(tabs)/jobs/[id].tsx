// app/(tabs)/jobs/[id].tsx
// Job Card Detail screen — displays full job parameters, location verification, and completion workflow.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MapPin,
  Phone,
  Calendar,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  ClipboardCheck,
  CheckCircle,
  Wrench,
  Package,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import StatusBadge from '../../../components/StatusBadge';
import { useAuth } from '../../../contexts/AuthContext';
import { useNetwork } from '../../../contexts/NetworkContext';
import { apiGet, apiPut } from '../../../services/api';
import { getOffline, saveOffline } from '../../../services/offline';
import type { JobCard as JobCardType } from '../../../types';

export default function JobDetailsScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  
  const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [job, setJob] = useState<JobCardType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completion Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workSummary, setWorkSummary] = useState('');
  const [issuesFound, setIssuesFound] = useState('');
  const [nextVisitNeeded, setNextVisitNeeded] = useState(false);

  // Tools & Materials State
  const [issuedTools, setIssuedTools] = useState<any[]>([]);
  const [materialLogs, setMaterialLogs] = useState<any[]>([]);
  
  // Tool Return Modal State
  const [activeTool, setActiveTool] = useState<any | null>(null);
  const [toolCondition, setToolCondition] = useState<'GOOD' | 'DAMAGED' | 'LOST'>('GOOD');

  // Material Return Modal State
  const [activeMaterial, setActiveMaterial] = useState<any | null>(null);
  const [matQtyUsed, setMatQtyUsed] = useState('');
  const [matQtyReturned, setMatQtyReturned] = useState('');
  const [matNotes, setMatNotes] = useState('');

  // ─── Fetch Job Details ───────────────────────────────────────────────────────

  const loadJobDetail = useCallback(async () => {
    setIsLoading(true);
    if (isOnline) {
      try {
        const res = await apiGet<JobCardType>(`/jobcards/${id}`);
        if (res.success) {
          setJob(res.data);
          // Cache individual job offline
          await saveOffline(`job_${id}`, res.data);
        }

        try {
          const toolsRes = await apiGet<any>(`/tools/my-tools?jobCardId=${id}`);
          if (toolsRes.success) setIssuedTools(toolsRes.data || []);
          const matsRes = await apiGet<any>(`/materials/usage/my-active?jobCardId=${id}`);
          if (matsRes.success) setMaterialLogs(matsRes.data || []);
        } catch (e) {
          console.warn('[JobDetail] Failed to fetch tools/materials', e);
        }
      } catch (err: any) {
        console.warn('[JobDetail] Online fetch failed, checking cache:', err);
        await loadFromCache();
      }
    } else {
      await loadFromCache();
    }
    setIsLoading(false);
  }, [id, isOnline]);

  const loadFromCache = async () => {
    const cached = await getOffline<JobCardType>(`job_${id}`);
    if (cached && cached.data) {
      setJob(cached.data);
    } else {
      // Fallback: look through cached jobs list
      const cachedList = await getOffline<JobCardType[]>('jobs');
      if (cachedList && cachedList.data) {
        const matched = cachedList.data.find((j) => String(j.id) === id);
        if (matched) setJob(matched);
      }
    }
  };

  useEffect(() => {
    loadJobDetail();
  }, [loadJobDetail, isOnline]);

  useEffect(() => {
    if (activeMaterial && matQtyUsed !== '') {
      const used = Number(matQtyUsed);
      if (!isNaN(used)) {
        setMatQtyReturned(String(Math.max(0, activeMaterial.quantityTaken - used)));
      }
    }
  }, [matQtyUsed, activeMaterial]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const formatIST = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCall = () => {
    if (job?.clientPhone) {
      Linking.openURL(`tel:${job.clientPhone}`);
    }
  };

  const handleOpenMaps = () => {
    if (job?.mapsLink) {
      Linking.openURL(job.mapsLink);
    } else if (job?.siteAddress) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.siteAddress)}`);
    }
  };

  // ─── Location & Transition Handlers ──────────────────────────────────────────

  const transitionStatus = async (nextStatus: string, bodyPayload: Record<string, unknown> = {}) => {
    if (!isOnline) {
      Alert.alert(
        'Offline',
        'Status updates require an active internet connection to ensure team coordinates and notifications dispatches sync correctly.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiPut<JobCardType>(`/jobcards/${id}/status`, {
        status: nextStatus,
        ...bodyPayload,
      });

      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Status Updated',
          text2: res.message,
        });
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkArrived = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to submit site arrival coordinates.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Request location permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert(
            'GPS Permission Required',
            'This application requires site coordinates to verify you have arrived on location. Please enable location permissions in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Capture GPS coordinates
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      await transitionStatus('ARRIVED', { lat, lng });
    } catch (err: any) {
      Alert.alert('Location Error', 'Unable to fetch device GPS coordinates. Please make sure location is enabled.');
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to verify completed work.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiPut<JobCardType>(`/jobcards/${id}/verify`);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Verified',
          text2: res.message,
        });
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to verify job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletionSubmit = async () => {
    if (!workSummary.trim()) {
      Alert.alert('Required', 'Please enter a work summary.');
      return;
    }

    setIsModalOpen(false);
    await transitionStatus('COMPLETED', {
      workSummary,
      issuesFound: issuesFound.trim() || undefined,
      nextVisitNeeded,
    });
  };

  const handleReturnToolSubmit = async () => {
    if (!activeTool) return;
    try {
      setIsSubmitting(true);
      const res = await apiPut(`/tools/issuances/${activeTool.id}/return`, {
        returnCondition: toolCondition,
      });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Tool Returned' });
        setActiveTool(null);
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to return tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaterialReturnSubmit = async () => {
    if (!activeMaterial) return;
    try {
      setIsSubmitting(true);
      const res = await apiPut(`/materials/usage/${activeMaterial.id}/complete`, {
        quantityUsed: Number(matQtyUsed),
        quantityReturned: Number(matQtyReturned),
        notes: matNotes,
      });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Material Log Completed' });
        setActiveMaterial(null);
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to complete material log');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Button Renderer ──────────────────────────────────────────────────────────

  const renderActionButton = () => {
    if (!job) return null;

    switch (job.status) {
      case 'ASSIGNED':
        return (
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => transitionStatus('EN_ROUTE')}
            className="bg-blue-600 rounded-xl py-4 items-center justify-center shadow"
          >
            <Text className="text-white font-bold text-base">Start Journey</Text>
          </TouchableOpacity>
        );

      case 'EN_ROUTE':
        return (
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={handleMarkArrived}
            className="bg-amber-600 rounded-xl py-4 items-center justify-center shadow"
          >
            <Text className="text-white font-bold text-base">Mark Arrived</Text>
          </TouchableOpacity>
        );

      case 'ARRIVED':
        return (
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => transitionStatus('IN_PROGRESS')}
            className="bg-purple-600 rounded-xl py-4 items-center justify-center shadow"
          >
            <Text className="text-white font-bold text-base">Start Work</Text>
          </TouchableOpacity>
        );

      case 'IN_PROGRESS':
        return (
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => {
              setWorkSummary('');
              setIssuesFound('');
              setNextVisitNeeded(false);
              setIsModalOpen(true);
            }}
            className="bg-green-600 rounded-xl py-4 items-center justify-center shadow"
          >
            <Text className="text-white font-bold text-base">Complete Job</Text>
          </TouchableOpacity>
        );

      case 'COMPLETED':
        if (isOwnerAdmin) {
          return (
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleVerify}
              className="bg-emerald-600 rounded-xl py-4 items-center justify-center shadow"
            >
              <Text className="text-white font-bold text-base">Verify Job</Text>
            </TouchableOpacity>
          );
        }
        return (
          <View className="bg-slate-800 rounded-xl p-4 border border-slate-700 items-center">
            <CheckCircle size={24} color="#10b981" />
            <Text className="text-slate-300 font-semibold text-sm mt-1.5">
              Completed — Pending owner verification
            </Text>
          </View>
        );

      case 'VERIFIED':
        return (
          <View className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-900/30 items-center">
            <CheckCircle size={24} color="#10b981" />
            <Text className="text-emerald-400 font-semibold text-sm mt-1.5">
              Job Card Verified
            </Text>
          </View>
        );

      case 'CANCELLED':
        return (
          <View className="bg-red-950/20 rounded-xl p-4 border border-red-900/20 items-center">
            <Text className="text-red-400 font-semibold text-sm">
              Job Card Cancelled
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f172a] items-center justify-center">
        <Text className="text-slate-400 text-sm">Loading details...</Text>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f172a] items-center justify-center px-6">
        <Text className="text-slate-200 font-bold text-lg text-center mb-1">
          Job Card Not Found
        </Text>
        <Text className="text-slate-400 text-sm text-center mb-4">
          This record might not exist or has been removed.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 rounded-lg px-4 py-2"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const jobTypeLabel = job.jobType
    ? job.jobType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Job';

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
      <ScrollView className="flex-1 px-4 py-4">
        {/* Header section */}
        <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-[#334155]/60">
          <View>
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Job Card
            </Text>
            <Text className="text-blue-400 font-bold text-xl mt-0.5">
              {job.jobNumber}
            </Text>
          </View>
          <StatusBadge status={job.status} />
        </View>

        {/* Section 1: Client Info */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-4 shadow">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-2">
            Client Information
          </Text>
          <Text className="text-slate-50 font-bold text-xl">{job.clientName}</Text>
          
          {job.clientPhone ? (
            <TouchableOpacity
              onPress={handleCall}
              activeOpacity={0.7}
              className="flex-row items-center mt-3 bg-[#0f172a] rounded-xl px-4 py-3 border border-[#334155]"
            >
              <Phone size={16} color="#60a5fa" />
              <Text className="text-blue-400 font-semibold text-sm ml-2.5">
                {job.clientPhone}
              </Text>
            </TouchableOpacity>
          ) : null}

          {job.siteAddress ? (
            <View className="flex-row mt-3 items-start">
              <MapPin size={18} color="#94a3b8" className="mt-0.5 flex-shrink-0" />
              <Text className="text-slate-300 text-sm ml-2 flex-1">
                {job.siteAddress}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleOpenMaps}
            activeOpacity={0.7}
            className="flex-row items-center justify-center mt-4 bg-slate-800 rounded-xl py-3 border border-[#334155]"
          >
            <Text className="text-slate-300 font-semibold text-xs uppercase tracking-wider mr-1.5">
              Open Map Location
            </Text>
            <ExternalLink size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Section 2: Job Info */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-4 shadow">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Job Details
          </Text>

          <View className="space-y-3">
            {/* Job Type */}
            <View className="flex-row items-center">
              <ClipboardCheck size={16} color="#94a3b8" />
              <Text className="text-slate-300 text-sm ml-3 flex-1">
                Job Type: {jobTypeLabel}
              </Text>
            </View>

            {/* Scheduled */}
            <View className="flex-row items-center">
              <Calendar size={16} color="#94a3b8" />
              <Text className="text-slate-300 text-sm ml-3 flex-1">
                Scheduled: {formatIST(job.scheduledDate)}
              </Text>
            </View>

            {/* Est Duration */}
            {job.estimatedDuration ? (
              <View className="flex-row items-center">
                <Clock size={16} color="#94a3b8" />
                <Text className="text-slate-300 text-sm ml-3 flex-1">
                  Est. Duration: {job.estimatedDuration} minutes
                </Text>
              </View>
            ) : null}

            {/* Assigned to */}
            <View className="flex-row items-center">
              <User size={16} color="#94a3b8" />
              <Text className="text-slate-300 text-sm ml-3 flex-1">
                Assigned employee: {job.assignedTo?.fullName || 'Unassigned'}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {job.notes ? (
            <View className="mt-4 pt-4 border-t border-[#334155]/60">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Notes / Instructions
              </Text>
              <Text className="text-slate-300 text-sm leading-5">{job.notes}</Text>
            </View>
          ) : null}

          {/* Equipment Notes */}
          {job.equipmentNotes ? (
            <View className="mt-3">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Equipment Info
              </Text>
              <Text className="text-slate-300 text-sm leading-5">{job.equipmentNotes}</Text>
            </View>
          ) : null}

          {/* Work Completion Details */}
          {job.workSummary ? (
            <View className="mt-4 pt-4 border-t border-[#334155]/60">
              <Text className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">
                Completion Summary
              </Text>
              <Text className="text-slate-300 text-sm leading-5">{job.workSummary}</Text>
              {job.issuesFound ? (
                <View className="mt-2">
                  <Text className="text-red-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                    Issues Identified
                  </Text>
                  <Text className="text-slate-300 text-sm">{job.issuesFound}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Section 3: Status Action Buttons */}
        <View className="mb-4">{renderActionButton()}</View>

        {/* Section 4: Tools & Materials */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-10 shadow">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Tools & Materials for this Job
          </Text>

          {/* Tools */}
          <Text className="text-slate-300 text-sm font-semibold mb-2">Issued Tools</Text>
          {issuedTools.length === 0 ? (
            <Text className="text-slate-500 text-sm italic mb-4">No tools issued.</Text>
          ) : (
            <View className="mb-4 space-y-3">
              {issuedTools.map(tool => (
                <View key={tool.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-2">
                    <Wrench size={16} color="#94a3b8" />
                    <Text className="text-slate-200 text-sm ml-2" numberOfLines={1}>
                      {tool.tool?.name || 'Unknown Tool'} ({tool.tool?.toolCode})
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTool(tool);
                      setToolCondition('GOOD');
                    }}
                    className="bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-600/30"
                  >
                    <Text className="text-blue-400 text-xs font-bold">Return</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Materials */}
          <Text className="text-slate-300 text-sm font-semibold mb-2 mt-2">Material Usage</Text>
          {materialLogs.length === 0 ? (
            <Text className="text-slate-500 text-sm italic mb-2">No materials active.</Text>
          ) : (
            <View className="space-y-3">
              {materialLogs.map(log => (
                <View key={log.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center mb-1">
                      <Package size={16} color="#94a3b8" />
                      <Text className="text-slate-200 text-sm ml-2 font-medium" numberOfLines={1}>
                        {log.material?.name || 'Unknown Material'}
                      </Text>
                    </View>
                    <Text className="text-slate-400 text-xs ml-6">
                      Taken: {log.quantityTaken} {log.material?.unit}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveMaterial(log);
                      setMatQtyUsed(String(log.quantityTaken));
                      setMatQtyReturned('0');
                      setMatNotes('');
                    }}
                    className="bg-green-600/20 px-3 py-1.5 rounded-lg border border-green-600/30"
                  >
                    <Text className="text-green-400 text-xs font-bold">Complete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Completion Dialog Form Modal */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">
              Complete Job Card
            </Text>

            <ScrollView className="space-y-4 max-h-[350px]">
              {/* Work Summary */}
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Work Summary <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  value={workSummary}
                  onChangeText={setWorkSummary}
                  placeholder="Enter details of work performed..."
                  placeholderTextColor="#64748b"
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>

              {/* Issues Found */}
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Issues Identified (Optional)
                </Text>
                <TextInput
                  multiline
                  numberOfLines={2}
                  value={issuesFound}
                  onChangeText={setIssuesFound}
                  placeholder="Describe any unresolved issues..."
                  placeholderTextColor="#64748b"
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>

              {/* Next Visit Needed */}
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-slate-300 text-sm font-semibold">
                  Follow-up Visit Required?
                </Text>
                <Switch
                  value={nextVisitNeeded}
                  onValueChange={setNextVisitNeeded}
                  trackColor={{ false: '#0f172a', true: '#2563eb' }}
                  thumbColor={nextVisitNeeded ? '#f8fafc' : '#94a3b8'}
                />
              </View>
            </ScrollView>

            {/* Modal Controls */}
            <View className="flex-row mt-6">
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCompletionSubmit}
                className="flex-1 bg-green-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Submit Completion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tool Return Modal */}
      <Modal
        visible={!!activeTool}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveTool(null)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">
              Return Tool
            </Text>
            <Text className="text-slate-300 text-center mb-6">
              {activeTool?.tool?.name} ({activeTool?.tool?.toolCode})
            </Text>
            
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              Condition
            </Text>
            <View className="flex-row space-x-2 mb-6">
              {['GOOD', 'DAMAGED', 'LOST'].map((cond) => (
                <TouchableOpacity
                  key={cond}
                  onPress={() => setToolCondition(cond as any)}
                  className={`flex-1 py-2.5 rounded-lg items-center border ${
                    toolCondition === cond
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-slate-800 border-slate-600'
                  }`}
                >
                  <Text className={`text-xs font-bold ${
                    toolCondition === cond ? 'text-white' : 'text-slate-400'
                  }`}>
                    {cond}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row mt-2">
              <TouchableOpacity
                onPress={() => setActiveTool(null)}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReturnToolSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Confirm Return</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Material Return Modal */}
      <Modal
        visible={!!activeMaterial}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveMaterial(null)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">
              Complete Material Usage
            </Text>
            <Text className="text-slate-300 text-center mb-6">
              {activeMaterial?.material?.name} (Taken: {activeMaterial?.quantityTaken} {activeMaterial?.material?.unit})
            </Text>

            <ScrollView className="space-y-4 max-h-[350px]">
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Quantity Used <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={matQtyUsed}
                  onChangeText={setMatQtyUsed}
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Quantity Returned <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={matQtyReturned}
                  onChangeText={setMatQtyReturned}
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Notes (Optional)
                </Text>
                <TextInput
                  value={matNotes}
                  onChangeText={setMatNotes}
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>
            </ScrollView>

            <View className="flex-row mt-6">
              <TouchableOpacity
                onPress={() => setActiveMaterial(null)}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleMaterialReturnSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
