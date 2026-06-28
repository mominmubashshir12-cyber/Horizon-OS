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
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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
  X,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import StatusBadge from '../../../components/StatusBadge';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useNetwork } from '../../../contexts/NetworkContext';
import { apiGet, apiPut, apiPost } from '../../../services/api';
import { getOffline, saveOffline } from '../../../services/offline';
import type { JobCard as JobCardType } from '../../../types';
import CheckInGuard from '../../../components/CheckInGuard';

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

  // Derived filtered states for current user
  const myIssuedTools = issuedTools.filter((t: any) => t.userId === user?.id && !['RETURNED', 'RETURN_VERIFIED'].includes(t.status));
  const myMaterialLogs = materialLogs.filter((m: any) => m.userId === user?.id && !m.completedAt);
  
  // Tool Return Modal State
  const [activeTool, setActiveTool] = useState<any | null>(null);
  const [toolCondition, setToolCondition] = useState<'GOOD' | 'DAMAGED' | 'LOST'>('GOOD');

  // Tool Transfer Modal State
  const [transferTool, setTransferTool] = useState<any | null>(null);
  const [transferUsers, setTransferUsers] = useState<any[]>([]);
  const [selectedTransferUserId, setSelectedTransferUserId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Material Return Modal State
  const [activeMaterial, setActiveMaterial] = useState<any | null>(null);
  const [matQtyUsed, setMatQtyUsed] = useState('');
  const [matQtyReturned, setMatQtyReturned] = useState('');
  const [matNotes, setMatNotes] = useState('');

  // Quick Issue State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueTarget, setIssueTarget] = useState<{ type: 'tool' | 'material'; id: number; name: string; requiredQty?: number } | null>(null);
  const [issueQty, setIssueQty] = useState('');
  
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [qualityRating, setQualityRating] = useState<'GOOD'|'SATISFACTORY'|'POOR'|'NOT_DONE'>('SATISFACTORY');

  // Job Request State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');

  // Addon Request State
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [addonType, setAddonType] = useState<'TOOL' | 'MATERIAL'>('TOOL');
  const [addonItemId, setAddonItemId] = useState<number | null>(null);
  const [addonQuantity, setAddonQuantity] = useState('1');
  const [addonReason, setAddonReason] = useState('');
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);

  // EN_ROUTE Block State
  const [isEnRouteBlockModalOpen, setIsEnRouteBlockModalOpen] = useState(false);
  const [missingEnRouteItems, setMissingEnRouteItems] = useState<{ tools: string[], materials: string[] }>({ tools: [], materials: [] });

  // ─── Fetch Job Details ───────────────────────────────────────────────────────

  const loadJobDetail = useCallback(async () => {
    setIsLoading(true);
    if (isOnline) {
      try {
        const res = await apiGet<JobCardType>(`/jobcards/${id}`);
        if (res.success) {
          setJob(res.data);
          await saveOffline(`job_${id}`, res.data);
        }

        try {
          // Fetch TEAM issuances (pending + approved) for this job
          const toolsRes = await apiGet<any>(`/tools/issuances/for-job/${id}`);
          if (toolsRes.success) setIssuedTools(toolsRes.data || []);
          const matsRes = await apiGet<any>(`/materials/usage/for-job/${id}`);
          if (matsRes.success) setMaterialLogs(matsRes.data || []);
        } catch (e) {
          console.warn('[JobDetail] Failed to fetch issuances:', e);
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

  useFocusEffect(
    useCallback(() => {
      loadJobDetail();
    }, [loadJobDetail, isOnline])
  );

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
    setIsVerifyModalOpen(true);
  };

  const submitVerify = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiPut(`/jobcards/${id}/verify`, { qualityRating });
      if (res.success) {
        setIsVerifyModalOpen(false);
        Toast.show({ type: 'success', text1: 'Job card verified' });
        loadJobDetail();
      } else {
        Alert.alert('Error', res.message || 'Failed to verify');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to verify job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPhoto = async (phase: 'ARRIVAL' | 'COMPLETION') => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsSubmitting(true);
        const photoString = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const res = await apiPost(`/jobcards/${id}/photos`, { phase, photoUrl: photoString });
        if (res.success) {
          Toast.show({ type: 'success', text1: 'Photo uploaded successfully' });
          loadJobDetail();
        } else {
          Alert.alert('Error', res.message || 'Failed to upload photo');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to upload photo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartWork = async () => {
    await transitionStatus('IN_PROGRESS');
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

  const handleJobRequestSubmit = async () => {
    if (!requestReason.trim()) {
      Alert.alert('Required', 'Please enter a reason.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Offline', 'Internet connection is required to submit requests.');
      return;
    }

    try {
      setIsSubmitting(true);
      const requestedJobId = job?.status === 'UNASSIGNED' ? job.id : null;

      const res = await apiPost<any>('/jobcards/requests', {
        reason: requestReason,
        requestedJobId: requestedJobId,
      });

      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Request Submitted',
          text2: res.message,
        });
        setIsRequestModalOpen(false);
        setRequestReason('');
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
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

  const openTransferModal = async (tool: any) => {
    setTransferTool(tool);
    setSelectedTransferUserId(null);
    try {
      const res = await apiGet<any[]>('/users/peers/available');
      if (res.success) {
        setTransferUsers(res.data.filter((u: any) => u.id !== user?.id && u.role !== 'OWNER'));
      }
    } catch (err) {
      console.warn('Failed to fetch users for transfer', err);
    }
  };

  const fetchAddonOptions = async () => {
    try {
      const tRes = await apiGet<any>('/tools');
      if (tRes.success) {
        setAvailableTools(tRes.data.filter((t: any) => t.condition === 'GOOD' && t.currentHolderId === null));
      }
      const mRes = await apiGet<any>('/products/lookup?inStock=true');
      if (mRes.success) {
        setAvailableMaterials(mRes.data);
      }
    } catch (e) {
      console.warn('Failed to fetch addon options', e);
    }
  };

  const handleOpenAddonModal = () => {
    setIsAddonModalOpen(true);
    fetchAddonOptions();
  };

  const handleAddonSubmit = async () => {
    if (!addonItemId) {
      Alert.alert('Required', 'Please select an item');
      return;
    }
    const qty = parseFloat(addonQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = addonType === 'TOOL' 
        ? { tools: [{ toolId: addonItemId, reason: addonReason }] }
        : { materials: [{ materialId: addonItemId, quantityRequested: qty, reason: addonReason }] };

      const res = await apiPost(`/jobcards/${id}/request-addon`, payload);
      if (res.success) {
        Alert.alert('Success', 'Addon request submitted successfully.');
        setIsAddonModalOpen(false);
        setAddonItemId(null);
        setAddonReason('');
      } else {
        Alert.alert('Error', res.message || 'Failed to submit addon request');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Network or server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferTool || !selectedTransferUserId) return;
    try {
      setIsTransferring(true);
      const res = await apiPost('/tools/transfers', {
        toolId: transferTool.toolId,
        toUserId: selectedTransferUserId,
        jobCardId: id
      });
      if ((res as any).success) {
        Toast.show({ type: 'success', text1: 'Transfer Request Sent' });
        setTransferTool(null);
        loadJobDetail();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send transfer request');
    } finally {
      setIsTransferring(false);
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

  // ─── Quick Issue Handler ──────────────────────────────────────────────────────

  const handleQuickIssue = async () => {
    if (!issueTarget) return;
    try {
      setIsSubmitting(true);
      if (issueTarget.type === 'tool') {
        await apiPost(`/tools/${issueTarget.id}/issue`, { jobCardId: id });
      } else {
        const qty = parseFloat(issueQty);
        if (isNaN(qty) || qty <= 0) {
          Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
          setIsSubmitting(false);
          return;
        }
        await apiPost('/materials/usage/take', { productId: issueTarget.id, jobCardId: id, quantityTaken: qty });
      }
      Toast.show({ type: 'success', text1: 'Requested!', text2: `${issueTarget.name} has been requested. Pending admin approval.` });
      setIsIssueModalOpen(false);
      setIssueTarget(null);
      setIssueQty('');
      loadJobDetail();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Button Renderer ──────────────────────────────────────────────────────────

  const renderActionButton = () => {
    if (!job) return null;

    switch (job.status) {
      case 'UNASSIGNED':
        if (isOwnerAdmin) {
          return (
            <View className="bg-slate-800 rounded-xl p-4 border border-slate-700 items-center">
              <Text className="text-slate-300 font-semibold text-sm">
                Unassigned — Assign to an employee in the desktop app
              </Text>
            </View>
          );
        }
        const hasPendingRequest = job.requestedBy?.some(req => req.userId === user?.id && req.status === 'PENDING');
        
        if (hasPendingRequest) {
          return (
            <View className="bg-slate-800 rounded-xl py-4 items-center justify-center border border-slate-700">
              <Text className="text-slate-400 font-bold text-base">Request Pending</Text>
            </View>
          );
        }

        return (
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => setIsRequestModalOpen(true)}
            className="bg-blue-600 rounded-xl py-4 items-center justify-center shadow"
          >
            <Text className="text-white font-bold text-base">Request Job</Text>
          </TouchableOpacity>
        );

      case 'ASSIGNED': {
        const pendingTools = (job.requiredTools || []).filter((rt: any) => !rt.isIssuedToMe);
        const pendingMaterials = (job.requiredMaterials || []).filter((rm: any) => !rm.isTakenByMe);
        const allApproved = pendingTools.length === 0 && pendingMaterials.length === 0;
        const hasRequiredItems = (job.requiredTools?.length ?? 0) > 0 || (job.requiredMaterials?.length ?? 0) > 0;

        const handleStartJourney = () => {
          if (pendingTools.length > 0 || pendingMaterials.length > 0) {
            setMissingEnRouteItems({
              tools: pendingTools.map((t: any) => t.tool?.name || 'Unknown Tool'),
              materials: pendingMaterials.map((m: any) => m.product?.name || 'Unknown Material')
            });
            setIsEnRouteBlockModalOpen(true);
          } else {
            transitionStatus('EN_ROUTE');
          }
        };

        return (
          <View style={{ gap: 12 }}>
            {/* Required Items Issue Section */}
            {hasRequiredItems && (
              <View className="bg-amber-950/30 rounded-2xl border border-amber-800/40 p-4">
                <Text className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  {allApproved ? '✓ All Items Approved' : '⚠ Action Required: Missing or Pending Items'}
                </Text>
                <Text className="text-slate-500 text-xs mb-3">
                  Any team member can issue an item. They are personally responsible for what they take.
                </Text>

                {/* Required Tools */}
                {(job.requiredTools || []).map((rt: any) => {
                  const issuance = issuedTools.find((t: any) => Number(t.toolId) === Number(rt.toolId) && t.status !== 'RETURN_VERIFIED' && t.status !== 'RETURNED');
                  const isApproved = issuance?.isApproved;
                  const issuedByMe = issuance?.userId === user?.id;
                  const issuedByOther = issuance && !issuedByMe;
                  return (
                    <View key={rt.id} className="mb-2 bg-slate-800/60 rounded-xl p-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Wrench size={14} color={isApproved ? '#22c55e' : '#f59e0b'} />
                          <Text className="text-slate-200 text-sm ml-2 flex-1" numberOfLines={1}>
                            {rt.tool?.name || 'Unknown Tool'}
                          </Text>
                        </View>
                        {issuance ? (
                          <View className={`px-2 py-1 rounded-lg border ${isApproved ? 'bg-green-900/40 border-green-700/40' : 'bg-amber-900/40 border-amber-700/40'}`}>
                            <Text className={`text-xs font-bold ${isApproved ? 'text-green-400' : 'text-amber-400'}`}>
                              {isApproved ? '✓ Taken' : 'Pending'}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              setIssueTarget({ type: 'tool', id: rt.toolId, name: rt.tool?.name || 'Tool' });
                              setIssueQty('');
                              setIsIssueModalOpen(true);
                            }}
                            className="bg-amber-600 px-3 py-1 rounded-lg"
                          >
                            <Text className="text-white text-xs font-bold">I'll Take It</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {issuance && (
                        <Text className="text-xs mt-1 ml-6" style={{ color: issuedByMe ? '#60a5fa' : '#94a3b8' }}>
                          {issuedByMe ? 'You are responsible for this tool' : `Taken by ${issuance.user?.fullName || 'teammate'}`}
                        </Text>
                      )}
                    </View>
                  );
                })}

                {/* Required Materials */}
                {(job.requiredMaterials || []).map((rm: any) => {
                  const usageLog = materialLogs.find((m: any) => m.productId === rm.productId);
                  const isApproved = usageLog?.isApproved;
                  const issuedByMe = myMaterialLogs.some((m: any) => m.productId === rm.productId);
                  return (
                    <View key={rm.id} className="mb-2 bg-slate-800/60 rounded-xl p-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Package size={14} color={isApproved ? '#22c55e' : '#f59e0b'} />
                          <Text className="text-slate-200 text-sm ml-2 flex-1" numberOfLines={1}>
                            {rm.product?.name || 'Unknown'} × {rm.quantity} {rm.product?.unit}
                          </Text>
                        </View>
                        {usageLog ? (
                          <View className={`px-2 py-1 rounded-lg border ${isApproved ? 'bg-green-900/40 border-green-700/40' : 'bg-amber-900/40 border-amber-700/40'}`}>
                            <Text className={`text-xs font-bold ${isApproved ? 'text-green-400' : 'text-amber-400'}`}>
                              {isApproved ? '✓ Taken' : 'Pending'}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              setIssueTarget({ type: 'material', id: rm.productId, name: rm.product?.name || 'Material', requiredQty: rm.quantity });
                              setIssueQty(String(rm.quantity));
                              setIsIssueModalOpen(true);
                            }}
                            className="bg-amber-600 px-3 py-1 rounded-lg"
                          >
                            <Text className="text-white text-xs font-bold">I'll Take It</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {usageLog && (
                        <Text className="text-xs mt-1 ml-6" style={{ color: issuedByMe ? '#60a5fa' : '#94a3b8' }}>
                          {issuedByMe ? `You took ${usageLog.quantityTaken} ${usageLog.product?.unit}` : `Taken by ${usageLog.user?.fullName || 'teammate'} (${usageLog.quantityTaken} ${usageLog.product?.unit})`}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}


            {/* Start Journey Button */}
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleStartJourney}
              className="rounded-xl py-4 items-center justify-center shadow bg-blue-600"
            >
              <Text className="font-bold text-base text-white">
                Start Journey
              </Text>
            </TouchableOpacity>

            {!isOwnerAdmin && (
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={() => setIsRequestModalOpen(true)}
                className="bg-slate-700 rounded-xl py-4 items-center justify-center border border-slate-600"
              >
                <Text className="text-slate-300 font-bold text-base">Request Different Job</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

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
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={() => handleUploadPhoto('ARRIVAL')}
              className="bg-slate-700 rounded-xl py-4 items-center justify-center border border-slate-600 shadow"
            >
              <Text className="text-slate-200 font-bold text-base">Add Arrival Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleStartWork}
              className="bg-purple-600 rounded-xl py-4 items-center justify-center shadow"
            >
              <Text className="text-white font-bold text-base">Start Work</Text>
            </TouchableOpacity>
          </View>
        );

      case 'IN_PROGRESS':
        return (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={() => handleUploadPhoto('COMPLETION')}
              className="bg-slate-700 rounded-xl py-4 items-center justify-center border border-slate-600 shadow"
            >
              <Text className="text-slate-200 font-bold text-base">Add Completion Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleOpenAddonModal}
              className="bg-blue-600 rounded-xl py-4 items-center justify-center shadow"
            >
              <Text className="text-white font-bold text-base">Request Addons</Text>
            </TouchableOpacity>
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
          </View>
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
    <CheckInGuard>
      <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['bottom']}>
        <ScrollView 
          className="flex-1 px-4 py-4"
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadJobDetail}
              tintColor="#3b82f6"
            />
          }
        >
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
          <View className="flex-row gap-2 mt-1">
            <StatusBadge status={job.status} />
            {job.isOverdue && job.status !== 'COMPLETED' && job.status !== 'VERIFIED' && (
              <StatusBadge status="OVERDUE" />
            )}
          </View>
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
                Assigned employee: {job.assignedEmployees?.[0]?.fullName || 'Unassigned'}
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

        {/* Required Items */}
        {((job.requiredTools?.length ?? 0) > 0 || (job.requiredMaterials?.length ?? 0) > 0) && (
          <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-4 shadow">
            <Text className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider mb-3">
              Required Items (Recommended by Admin)
            </Text>
            {(job.requiredTools?.length ?? 0) > 0 && (
              <View className="mb-3">
                <Text className="text-slate-300 text-sm font-semibold mb-1">Tools:</Text>
                {job.requiredTools!.map((t: any) => (
                  <Text key={t.id} className="text-slate-400 text-xs ml-2">• {t.tool?.name || 'Unknown'}</Text>
                ))}
              </View>
            )}
            {(job.requiredMaterials?.length ?? 0) > 0 && (
              <View>
                <Text className="text-slate-300 text-sm font-semibold mb-1">Materials:</Text>
                {job.requiredMaterials!.map((m: any) => (
                  <Text key={m.id} className="text-slate-400 text-xs ml-2">• {m.product?.name || 'Unknown'} - {m.quantity} {m.product?.unit}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Section 4: Tools & Materials */}
        <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-10 shadow">
          <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
            Your Issued Tools & Materials
          </Text>

          {/* Tools */}
          <Text className="text-slate-300 text-sm font-semibold mb-2">Issued Tools</Text>
          {myIssuedTools.length === 0 ? (
            <Text className="text-slate-500 text-sm italic mb-4">No tools issued.</Text>
          ) : (
            <View className="mb-4 space-y-3">
              {myIssuedTools.map(tool => (
                <View key={tool.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center mb-1">
                        <Wrench size={16} color="#94a3b8" />
                        <Text className="text-slate-200 text-sm ml-2 font-medium" numberOfLines={1}>
                          {tool.tool?.name || 'Unknown Tool'} ({tool.tool?.toolCode})
                        </Text>
                      </View>
                      <Text className="text-slate-400 text-xs ml-6">
                        Status: {tool.transferredTo ? '🔄 Transferred' : ['RETURNED', 'RETURN_VERIFIED'].includes(tool.status) ? '✅ Returned' : tool.isApproved ? '🔵 Issued' : '🟡 Pending Approval'}
                      </Text>
                      {tool.transferredTo ? (
                        <Text className="text-amber-400 text-xs ml-6">
                          Transferred to: {tool.transferredTo.fullName}
                        </Text>
                      ) : ['RETURNED', 'RETURN_VERIFIED'].includes(tool.status) && (
                        <Text className="text-slate-500 text-xs ml-6">
                          Condition: {tool.returnCondition || 'N/A'} · Returned by: {tool.user?.fullName}
                        </Text>
                      )}
                    </View>
                    {tool.isApproved && !['RETURNED', 'RETURN_VERIFIED'].includes(tool.status) && (
                      <View className="flex-row gap-2">
                        {(tool.userId === user?.id || user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                          <TouchableOpacity
                            onPress={() => openTransferModal(tool)}
                            className="bg-[#f59e0b]/20 px-3 py-1.5 rounded-lg border border-[#f59e0b]/30"
                          >
                            <Text className="text-[#f59e0b] text-xs font-bold">Transfer</Text>
                          </TouchableOpacity>
                        )}
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
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Materials */}
          <Text className="text-slate-300 text-sm font-semibold mb-2 mt-2">Material Usage</Text>
          {myMaterialLogs.length === 0 ? (
            <Text className="text-slate-500 text-sm italic mb-2">No materials active.</Text>
          ) : (
            <View className="space-y-3">
              {myMaterialLogs.map(log => (
                <View key={log.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center mb-1">
                        <Package size={16} color="#94a3b8" />
                        <Text className="text-slate-200 text-sm ml-2 font-medium" numberOfLines={1}>
                          {log.product?.name || 'Unknown Material'}
                        </Text>
                      </View>
                      <Text className="text-slate-400 text-xs ml-6">
                        Taken: {log.quantityTaken} {log.product?.unit}
                      </Text>
                      <Text className="text-slate-400 text-xs ml-6">
                        Status: {log.completedAt ? '✅ Completed' : log.isApproved ? '🔵 Approved' : '🟡 Pending Approval'}
                      </Text>
                      {log.completedAt && (
                        <>
                          <Text className="text-slate-500 text-xs ml-6">
                            Used: {log.quantityUsed} {log.product?.unit} · Returned: {log.quantityReturned} {log.product?.unit}
                          </Text>
                          {log.overuseFlag && (
                            <Text className="text-red-400 text-xs ml-6">⚠ Overuse flagged</Text>
                          )}
                        </>
                      )}
                    </View>
                    {log.isApproved && !log.completedAt && (
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
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section 5: Photos */}
        {((job.photos?.length || 0) > 0) && (
          <View className="bg-[#1e293b] rounded-2xl border border-[#334155] p-5 mb-10 shadow">
            <Text className="text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-4">
              Job Photos
            </Text>
            
            {/* Arrival Photos */}
            {(job.photos || []).filter((p: any) => p.phase === 'ARRIVAL').length > 0 && (
              <View className="mb-4">
                <Text className="text-slate-300 text-sm font-semibold mb-2">Arrival Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {(job.photos || []).filter((p: any) => p.phase === 'ARRIVAL').map((photo: any) => (
                    <View key={photo.id} className="mr-3 items-center">
                      <Image source={{ uri: photo.photoUrl }} className="w-24 h-24 rounded-xl bg-slate-800" />
                      <Text className="text-xs text-slate-500 mt-1">{photo.takenBy?.fullName?.split(' ')[0]}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Completion Photos */}
            {(job.photos || []).filter((p: any) => p.phase === 'COMPLETION').length > 0 && (
              <View>
                <Text className="text-slate-300 text-sm font-semibold mb-2">Completion Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {(job.photos || []).filter((p: any) => p.phase === 'COMPLETION').map((photo: any) => (
                    <View key={photo.id} className="mr-3 items-center">
                      <Image source={{ uri: photo.photoUrl }} className="w-24 h-24 rounded-xl bg-slate-800" />
                      <Text className="text-xs text-slate-500 mt-1">{photo.takenBy?.fullName?.split(' ')[0]}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Quick Issue Modal */}
      <Modal
        visible={isIssueModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsIssueModalOpen(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-1 text-center">
              Issue {issueTarget?.type === 'tool' ? 'Tool' : 'Material'}
            </Text>
            <Text className="text-slate-400 text-sm text-center mb-5">
              {issueTarget?.name}
            </Text>

            {issueTarget?.type === 'material' && (
              <View className="mb-4">
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                  Quantity to Take {issueTarget.requiredQty ? `(Required: ${issueTarget.requiredQty})` : ''}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={issueQty}
                  onChangeText={setIssueQty}
                  placeholder={`Enter quantity...`}
                  placeholderTextColor="#64748b"
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                />
              </View>
            )}

            <Text className="text-slate-500 text-xs text-center mb-5">
              This will send an approval request to the admin. You can start your journey once submitted.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setIsIssueModalOpen(false); setIssueTarget(null); }}
                className="flex-1 bg-slate-700 rounded-xl py-3.5 items-center border border-slate-600"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={handleQuickIssue}
                className="flex-1 bg-amber-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Verify Job Modal */}
      <Modal
        visible={isVerifyModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsVerifyModalOpen(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-2 text-center">
              Verify Job Card
            </Text>
            <Text className="text-slate-400 text-sm text-center mb-6">
              Rate the quality of the work. This will affect employee discipline scores.
            </Text>

            <ScrollView className="space-y-4 max-h-[400px]">
              {['GOOD', 'SATISFACTORY', 'POOR', 'NOT_DONE'].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  onPress={() => setQualityRating(rating as any)}
                  className={`p-4 rounded-xl border flex-row items-center justify-between ${
                    qualityRating === rating
                      ? rating === 'NOT_DONE' || rating === 'POOR' 
                        ? 'bg-red-900/30 border-red-500/50'
                        : 'bg-green-900/30 border-green-500/50'
                      : 'bg-[#0f172a] border-[#334155]'
                  }`}
                >
                  <View>
                    <Text className={`font-bold ${qualityRating === rating ? 'text-white' : 'text-slate-300'}`}>
                      {rating.replace('_', ' ')}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1">
                      {rating === 'GOOD' && '+5 Discipline Score'}
                      {rating === 'SATISFACTORY' && 'No change to score'}
                      {rating === 'POOR' && '-5 Discipline Score'}
                      {rating === 'NOT_DONE' && '-15 Score & Revert to Assigned'}
                    </Text>
                  </View>
                  <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    qualityRating === rating
                      ? rating === 'NOT_DONE' || rating === 'POOR' ? 'border-red-400' : 'border-green-400'
                      : 'border-slate-500'
                  }`}>
                    {qualityRating === rating && (
                      <View className={`w-2.5 h-2.5 rounded-full ${
                        rating === 'NOT_DONE' || rating === 'POOR' ? 'bg-red-400' : 'bg-green-400'
                      }`} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  disabled={isSubmitting}
                  onPress={() => setIsVerifyModalOpen(false)}
                  className="flex-1 bg-slate-700 rounded-xl py-3.5 items-center border border-slate-600"
                >
                  <Text className="text-slate-300 font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={isSubmitting}
                  onPress={submitVerify}
                  className="flex-1 bg-emerald-600 rounded-xl py-3.5 items-center"
                >
                  <Text className="text-white font-bold">
                    {isSubmitting ? 'Verifying...' : 'Verify Job'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tool Transfer Modal */}
      <Modal
        visible={!!transferTool}
        transparent
        animationType="slide"
        onRequestClose={() => setTransferTool(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#1e293b] rounded-t-3xl p-6 border-t border-[#334155] max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-lg font-bold">
                Transfer Tool
              </Text>
              <TouchableOpacity onPress={() => setTransferTool(null)} className="p-2 -mr-2">
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text className="text-slate-300 font-medium mb-1">
              {transferTool?.tool?.name} ({transferTool?.tool?.toolCode})
            </Text>
            <Text className="text-slate-400 text-xs mb-4">
              Select a peer to transfer this tool to. They will receive a pending request to accept it.
            </Text>

            <Text className="text-slate-400 text-xs font-semibold mb-2 ml-1 uppercase">Select Receiver</Text>
            <ScrollView className="mb-6 max-h-[40vh]">
              {transferUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => setSelectedTransferUserId(u.id)}
                  className={`p-4 rounded-xl border mb-2 flex-row justify-between items-center ${
                    selectedTransferUserId === u.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <View>
                    <Text className="text-white font-semibold text-sm">{u.fullName}</Text>
                    <Text className="text-slate-400 text-xs mt-0.5">@{u.username}</Text>
                  </View>
                  {selectedTransferUserId === u.id && (
                    <CheckCircle size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3.5 bg-slate-800 rounded-xl items-center justify-center border border-slate-700"
                onPress={() => setTransferTool(null)}
                disabled={isTransferring}
              >
                <Text className="text-slate-300 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3.5 rounded-xl items-center justify-center ${selectedTransferUserId ? 'bg-[#f59e0b]' : 'bg-slate-700'}`}
                onPress={handleTransferSubmit}
                disabled={isTransferring || !selectedTransferUserId}
              >
                {isTransferring ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text className="text-slate-900 font-bold text-sm">Send Request</Text>
                )}
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
              {activeMaterial?.product?.name} (Taken: {activeMaterial?.quantityTaken} {activeMaterial?.product?.unit})
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

      {/* Job Request Modal */}
      <Modal
        visible={isRequestModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsRequestModalOpen(false);
          setRequestReason('');
        }}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6">
            <Text className="text-slate-50 font-bold text-xl mb-4 text-center">
              {job?.status === 'UNASSIGNED' ? 'Request Job Assignment' : 'Request Different Job'}
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Reason for Request <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  value={requestReason}
                  onChangeText={setRequestReason}
                  placeholder={job?.status === 'UNASSIGNED' ? "Explain why you want to take this job..." : "Explain why you cannot complete your current job..."}
                  placeholderTextColor="#64748b"
                  className="bg-[#0f172a] rounded-xl border border-[#334155] p-3 text-slate-100 text-sm"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
            </View>

            <View className="flex-row mt-6">
              <TouchableOpacity
                onPress={() => {
                  setIsRequestModalOpen(false);
                  setRequestReason('');
                }}
                className="flex-1 bg-slate-800 rounded-xl py-3.5 border border-[#334155] mr-2 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJobRequestSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-bold">Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Addon Request Modal */}
      <Modal
        visible={isAddonModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsAddonModalOpen(false);
          setAddonItemId(null);
          setAddonReason('');
        }}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#1e293b] rounded-t-3xl border-t border-[#334155] p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Request Addons</Text>
              <TouchableOpacity onPress={() => setIsAddonModalOpen(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text className="text-slate-400 text-sm font-medium uppercase mb-2">Item Type</Text>
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => { setAddonType('TOOL'); setAddonItemId(null); }}
                  className={`flex-1 rounded-xl py-3 items-center border ${addonType === 'TOOL' ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}
                >
                  <Text className={`font-bold ${addonType === 'TOOL' ? 'text-white' : 'text-slate-400'}`}>Tool</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setAddonType('MATERIAL'); setAddonItemId(null); }}
                  className={`flex-1 rounded-xl py-3 items-center border ${addonType === 'MATERIAL' ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}
                >
                  <Text className={`font-bold ${addonType === 'MATERIAL' ? 'text-white' : 'text-slate-400'}`}>Material</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-slate-400 text-sm font-medium uppercase mb-2">Select Item</Text>
              <View className="bg-[#0f172a] rounded-xl border border-[#334155] p-2 mb-4 max-h-48">
                <ScrollView nestedScrollEnabled>
                  {addonType === 'TOOL' && availableTools.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setAddonItemId(t.id)}
                      className={`p-3 rounded-lg mb-1 ${addonItemId === t.id ? 'bg-blue-900/50 border border-blue-500/50' : 'bg-slate-800/50'}`}
                    >
                      <Text className={addonItemId === t.id ? 'text-blue-400 font-bold' : 'text-slate-300'}>{t.name} ({t.toolCode})</Text>
                    </TouchableOpacity>
                  ))}
                  {addonType === 'TOOL' && availableTools.length === 0 && (
                    <Text className="text-slate-500 text-center py-4">No available tools found.</Text>
                  )}
                  
                  {addonType === 'MATERIAL' && availableMaterials.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setAddonItemId(m.id)}
                      className={`p-3 rounded-lg mb-1 ${addonItemId === m.id ? 'bg-blue-900/50 border border-blue-500/50' : 'bg-slate-800/50'}`}
                    >
                      <Text className={addonItemId === m.id ? 'text-blue-400 font-bold' : 'text-slate-300'}>{m.name} ({m.sku})</Text>
                    </TouchableOpacity>
                  ))}
                  {addonType === 'MATERIAL' && availableMaterials.length === 0 && (
                    <Text className="text-slate-500 text-center py-4">No available materials found.</Text>
                  )}
                </ScrollView>
              </View>

              {addonType === 'MATERIAL' && (
                <>
                  <Text className="text-slate-400 text-sm font-medium uppercase mb-2">Quantity</Text>
                  <TextInput
                    value={addonQuantity}
                    onChangeText={setAddonQuantity}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#64748b"
                    className="bg-[#0f172a] text-white rounded-xl px-4 py-3.5 border border-[#334155] mb-4"
                  />
                </>
              )}

              <Text className="text-slate-400 text-sm font-medium uppercase mb-2">Reason</Text>
              <TextInput
                value={addonReason}
                onChangeText={setAddonReason}
                placeholder="Why do you need this?"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                className="bg-[#0f172a] text-white rounded-xl px-4 py-3.5 border border-[#334155] min-h-[100px]"
                textAlignVertical="top"
              />

              <View className="flex-row mt-6 mb-4">
                <TouchableOpacity
                  onPress={() => setIsAddonModalOpen(false)}
                  className="flex-1 bg-slate-800 rounded-xl py-4 border border-[#334155] mr-2 items-center"
                >
                  <Text className="text-slate-300 font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddonSubmit}
                  disabled={isSubmitting || !addonItemId}
                  className={`flex-1 rounded-xl py-4 items-center ${(!addonItemId || isSubmitting) ? 'bg-blue-800' : 'bg-blue-600'}`}
                >
                  <Text className="text-white font-bold">{isSubmitting ? 'Submitting...' : 'Submit Request'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* EN_ROUTE Block Modal */}
      <Modal visible={isEnRouteBlockModalOpen} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/70 justify-center items-center p-4">
          <View className="bg-[#1e293b] rounded-3xl border border-[#334155] p-6 w-full max-w-sm">
            <Text className="text-amber-400 font-bold text-xl mb-4 text-center">
              Cannot Start Journey
            </Text>
            <Text className="text-slate-300 text-sm mb-4 text-center">
              You cannot leave for site until these tools/materials are issued to you:
            </Text>
            
            <View className="bg-slate-800 rounded-xl p-3 mb-6">
              {missingEnRouteItems.tools.map((t, i) => (
                <Text key={`t-${i}`} className="text-slate-200 text-sm mb-1">• {t} (Tool)</Text>
              ))}
              {missingEnRouteItems.materials.map((m, i) => (
                <Text key={`m-${i}`} className="text-slate-200 text-sm mb-1">• {m} (Material)</Text>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsEnRouteBlockModalOpen(false)}
                className="flex-1 bg-slate-700 rounded-xl py-4 items-center"
              >
                <Text className="text-slate-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsEnRouteBlockModalOpen(false);
                  router.push('/(tabs)/inventory');
                }}
                className="flex-1 bg-blue-600 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-bold">Issue Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  </CheckInGuard>
  );
}
