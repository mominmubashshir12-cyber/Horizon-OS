// app/_layout.tsx
// Root layout for the Horizon OS mobile app using expo-router.
// Sets up the global provider hierarchy: NetworkProvider → AuthProvider.
// Manages top-level navigation: unauthenticated users see the login screen,
// authenticated users see the (tabs) stack.
// Includes the OfflineBanner at the top level and configures the status bar.

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NetworkProvider } from '../contexts/NetworkContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import OfflineBanner from '../components/OfflineBanner';
import { initDatabase } from '../services/db';
import '../global.css';

// ─── Auth-Aware Navigation Guard ──────────────────────────────────────────────

/**
 * Watches auth state and redirects between login and (tabs) as needed.
 * This runs inside both providers so it has access to auth context.
 */
function NavigationGuard(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (isAuthenticated && !inAuthGroup) {
      // User is logged in but not in the tabs — redirect to home
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inAuthGroup) {
      // User is not logged in but in the tabs — redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Show a loading spinner while restoring session
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0f172a]">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <>
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout(): React.JSX.Element {
  // Initialize the SQLite database on app startup
  useEffect(() => {
    initDatabase().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[DB] Failed to initialize database:', msg);
    });
  }, []);

  return (
    <NetworkProvider>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#0f172a" />
        <NavigationGuard />
      </AuthProvider>
    </NetworkProvider>
  );
}
