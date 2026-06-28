// Root page — redirects users directly to /dashboard (which handles authentication checks)
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage(): null {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
