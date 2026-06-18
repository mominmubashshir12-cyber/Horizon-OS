// components/JobCard.tsx
// A touchable card component for displaying a job card summary in lists.
// Displays the job number, client name, job type, status badge, scheduled date and time.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, MapPin, ChevronRight, Clock } from 'lucide-react-native';
import StatusBadge from './StatusBadge';
import type { JobCard as JobCardType } from '../types';

interface JobCardProps {
  job: JobCardType;
  onPress: () => void;
  showAssignee?: boolean;
}

function formatDateIST(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function JobCard({ job, onPress, showAssignee = false }: JobCardProps): React.JSX.Element {
  const jobTypeLabel = job.jobType
    ? job.jobType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Job';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1e293b] rounded-xl border border-[#334155] mb-3 p-4 shadow"
    >
      {/* Header: Job Number + Status */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-blue-400 font-bold text-base">
          {job.jobNumber}
        </Text>
        <StatusBadge status={job.status} size="sm" />
      </View>

      {/* Client Name */}
      <Text className="text-slate-50 font-bold text-lg mb-2" numberOfLines={1}>
        {job.clientName}
      </Text>

      {/* Bottom details */}
      <View className="space-y-2 mb-2">
        {job.siteAddress ? (
          <View className="flex-row items-center">
            <MapPin size={14} color="#94a3b8" />
            <Text className="text-slate-400 text-xs ml-2 flex-1" numberOfLines={1}>
              {job.siteAddress}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center">
          <Calendar size={14} color="#94a3b8" />
          <Text className="text-slate-400 text-xs ml-2">
            {formatDateIST(job.scheduledDate)}
          </Text>
        </View>

        {showAssignee && job.assignedTo?.fullName ? (
          <View className="flex-row items-center">
            <Clock size={14} color="#94a3b8" />
            <Text className="text-slate-400 text-xs ml-2">
              Assigned to: {job.assignedTo.fullName}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Divider */}
      <View className="border-t border-[#334155]/60 pt-2 flex-row items-center justify-between mt-2">
        <View className="bg-slate-800 rounded-lg px-2 py-0.5 border border-[#334155]">
          <Text className="text-slate-300 text-xs font-medium">{jobTypeLabel}</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-blue-400 text-xs font-semibold mr-1">Details</Text>
          <ChevronRight size={14} color="#60a5fa" />
        </View>
      </View>
    </TouchableOpacity>
  );
}
