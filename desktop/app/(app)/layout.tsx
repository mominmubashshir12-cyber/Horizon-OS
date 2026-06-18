// App layout — protected shell with sidebar and topbar, redirects unauthenticated users to login
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FirmProvider } from '@/contexts/FirmContext';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
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
      <div className="flex h-screen items-center justify-center bg-[#0f172a]">
        <LoadingSpinner size="lg" message="Loading Horizon OS..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <FirmProvider>
      <div className="flex h-screen bg-[#090d14]">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Area */}
        <div className="ml-[260px] flex flex-1 flex-col w-[calc(100%-260px)]">
          {/* TopBar */}
          <TopBar />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>
    </FirmProvider>
  );
}
