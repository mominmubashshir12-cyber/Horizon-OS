// LoadingSpinner — centered animated spinner with primary brand color
'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const SIZE_MAP = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
} as const;

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className={`${SIZE_MAP[size]} animate-spin-slow rounded-full border-[#334155] border-t-[#2563eb]`}
      />
      {message && (
        <p className="text-sm text-[#94a3b8]">{message}</p>
      )}
    </div>
  );
}
