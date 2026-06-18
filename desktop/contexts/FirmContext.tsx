// FirmContext — provides the current firm/company information across the application
'use client';

import React, { createContext, useContext, useState } from 'react';
import type { Firm } from '@/types';

interface FirmContextValue {
  firm: Firm | null;
  isLoading: boolean;
}

const FirmContext = createContext<FirmContextValue | undefined>(undefined);

const DEFAULT_FIRM: Firm = {
  id: 1,
  name: 'Horizon IT Solutions',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  logoUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const [firm] = useState<Firm | null>(DEFAULT_FIRM);
  const [isLoading] = useState(false);

  return (
    <FirmContext.Provider value={{ firm, isLoading }}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm(): FirmContextValue {
  const context = useContext(FirmContext);
  if (context === undefined) {
    throw new Error('useFirm must be used within a FirmProvider');
  }
  return context;
}

export default FirmContext;
