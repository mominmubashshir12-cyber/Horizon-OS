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
    <div className="mb-8 flex items-end justify-between">
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tight text-white drop-shadow-md">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{subtitle}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
