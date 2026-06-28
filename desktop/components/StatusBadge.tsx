// StatusBadge — badge that auto-maps common status strings to semantic colors
'use client';

import React from 'react';

type StatusColor = '#10b981' | '#f59e0b' | '#f43f5e' | '#3b82f6' | '#8b5cf6' | '#f97316' | '#64748b';

interface StatusBadgeProps {
  status: string;
  variant?: any;
}

const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  COMPLETED: '#10b981',
  RETURNED: '#10b981',
  ACCEPTED: '#10b981',
  PRESENT: '#10b981',
  ACTIVE: '#10b981',
  GOOD: '#10b981',
  NEW: '#10b981',
  VERIFIED: '#10b981',

  ASSIGNED: '#3b82f6',
  INFO: '#3b82f6',
  DRAFT: '#3b82f6',
  SENT: '#3b82f6',
  ISSUED: '#3b82f6',

  IN_PROGRESS: '#8b5cf6',
  ARRIVED: '#8b5cf6',

  OPEN: '#f59e0b',
  LATE: '#f59e0b',
  WARNING: '#f59e0b',
  EN_ROUTE: '#f59e0b',
  PENDING: '#f59e0b',
  HALF_DAY: '#f59e0b',
  FAIR: '#f59e0b',
  WORN: '#f59e0b',
  EXPIRED: '#f59e0b',
  LEAVE: '#f59e0b',

  OVERDUE: '#f97316',
  DAMAGED: '#f97316',

  CANCELLED: '#f43f5e',
  REJECTED: '#f43f5e',
  ABSENT: '#f43f5e',
  LOST: '#f43f5e',
  RETIRED: '#f43f5e',
  CRITICAL: '#f43f5e',
};

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  // We use the status to find the color, defaulting to text-secondary slate if unknown
  const color = STATUS_COLOR_MAP[status] || '#64748b';

  const displayStatus = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span
      style={{
        background: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.1)`,
        color: color,
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {displayStatus}
    </span>
  );
}
