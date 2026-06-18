// StatusBadge — pill-shaped badge that auto-maps common status strings to semantic colors
'use client';

import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
}

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  COMPLETED: 'success',
  RETURNED: 'success',
  ACCEPTED: 'success',
  PRESENT: 'success',
  ACTIVE: 'success',
  GOOD: 'success',
  NEW: 'success',

  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  SENT: 'info',
  ISSUED: 'info',

  OPEN: 'warning',
  DRAFT: 'warning',
  HALF_DAY: 'warning',
  FAIR: 'warning',
  WORN: 'warning',
  EXPIRED: 'warning',
  LEAVE: 'warning',

  CANCELLED: 'danger',
  REJECTED: 'danger',
  ABSENT: 'danger',
  DAMAGED: 'danger',
  LOST: 'danger',
  RETIRED: 'danger',
  CRITICAL: 'danger',
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-[#334155] text-[#94a3b8]',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-amber-500/15 text-amber-400',
  danger: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
};

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolvedVariant = variant ?? STATUS_VARIANT_MAP[status] ?? 'default';

  const displayStatus = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[resolvedVariant]}`}
    >
      {displayStatus}
    </span>
  );
}
