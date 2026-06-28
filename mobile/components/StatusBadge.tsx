// components/StatusBadge.tsx
// A reusable colored pill/badge component that displays entity status strings.
// Maps known status values to specific background and text colors for quick
// visual identification. Supports two sizes: 'sm' and 'md'.

import React from 'react';
import { View, Text } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** The status string to display (e.g. 'COMPLETED', 'ASSIGNED') */
  status: string;
  /** Badge size variant. Defaults to 'md'. */
  size?: 'sm' | 'md';
}

// ─── Color Mapping ─────────────────────────────────────────────────────────────

interface StatusColors {
  bg: string;
  text: string;
}

/**
 * Maps status strings to NativeWind background and text color classes.
 * Falls back to a neutral gray for unknown statuses.
 */
function getStatusColors(status: string): StatusColors {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'UNASSIGNED':
      return { bg: 'bg-slate-800', text: 'text-slate-400' };

    case 'COMPLETED':
      return { bg: 'bg-green-900/50', text: 'text-green-400' };
    
    case 'VERIFIED':
      return { bg: 'bg-emerald-900/50', text: 'text-emerald-400' };

    case 'ASSIGNED':
      return { bg: 'bg-blue-900/50', text: 'text-blue-400' };

    case 'IN_PROGRESS':
      return { bg: 'bg-purple-900/50', text: 'text-purple-400' };

    case 'EN_ROUTE':
      return { bg: 'bg-yellow-900/50', text: 'text-yellow-400' };

    case 'ARRIVED':
      return { bg: 'bg-orange-900/50', text: 'text-orange-400' };

    case 'CANCELLED':
    case 'REJECTED':
    case 'LOST':
    case 'DAMAGED':
    case 'ABSENT':
      return { bg: 'bg-red-900/50', text: 'text-red-400' };

    case 'CHECKED_IN':
    case 'RETURNED':
      return { bg: 'bg-green-900/50', text: 'text-green-400' };

    case 'SENT':
    case 'ISSUED':
      return { bg: 'bg-blue-900/50', text: 'text-blue-400' };

    case 'DRAFT':
    case 'PENDING':
      return { bg: 'bg-orange-900/50', text: 'text-orange-400' };

    case 'INVOICED':
    case 'CONVERTED':
      return { bg: 'bg-purple-900/50', text: 'text-purple-400' };

    case 'EXPIRED':
    case 'OVERDUE':
      return { bg: 'bg-amber-900/50', text: 'text-amber-400' };

    default:
      return { bg: 'bg-slate-700', text: 'text-slate-300' };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StatusBadge({
  status,
  size = 'md',
}: StatusBadgeProps): React.JSX.Element {
  const colors = getStatusColors(status);

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';

  const textSizeClass =
    size === 'sm' ? 'text-xs' : 'text-sm';

  // Format the display label: UPPER_CASE → Title Case
  const displayLabel = status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <View className={`rounded-full ${sizeClasses} ${colors.bg} self-start`}>
      <Text className={`${textSizeClass} font-semibold ${colors.text}`}>
        {displayLabel}
      </Text>
    </View>
  );
}
