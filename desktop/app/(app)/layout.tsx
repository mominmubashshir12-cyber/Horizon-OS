// App layout — protected shell with sidebar and topbar, redirects unauthenticated users to login
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FirmProvider } from '@/contexts/FirmContext';
import Sidebar from '@/components/Sidebar';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0e14]">
        <LoadingSpinner size="lg" message="Loading Horizon OS..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <FirmProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#0b0f19]">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Area */}
        <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </FirmProvider>
  );
}
