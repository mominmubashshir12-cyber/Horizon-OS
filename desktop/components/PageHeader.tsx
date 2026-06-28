// PageHeader — reusable page title bar with optional subtitle and action button
'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function PageHeader({ title, subtitle, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{subtitle}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{ background: 'var(--color-brand-primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
