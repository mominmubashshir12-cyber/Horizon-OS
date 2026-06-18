// contexts/NetworkContext.tsx
// Network connectivity context using @react-native-community/netinfo.
// Provides a global isOnline boolean to the entire app via React Context.
//
// Key behavior: when the device transitions from offline → online, the
// sync queue is automatically flushed so any mutations made while offline
// are sent to the backend without user intervention.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushSyncQueue } from '../services/sync';

// ─── Context Type ──────────────────────────────────────────────────────────────

interface NetworkContextValue {
  /** Whether the device currently has internet connectivity */
  isOnline: boolean;
  /** Manually trigger a connectivity check */
  refreshNetworkStatus: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  refreshNetworkStatus: async () => {},
});

// ─── Provider ──────────────────────────────────────────────────────────────────

interface NetworkProviderProps {
  children: React.ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps): React.JSX.Element {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const wasOffline = useRef<boolean>(false);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(connected);

      // If we just came back online, flush the sync queue
      if (connected && wasOffline.current) {
        console.log('[Network] Back online — flushing sync queue');
        flushSyncQueue().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.warn('[Network] Sync flush failed:', msg);
        });
      }

      wasOffline.current = !connected;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshNetworkStatus = useCallback(async () => {
    const state = await NetInfo.fetch();
    const connected = !!(state.isConnected && state.isInternetReachable !== false);
    setIsOnline(connected);
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, refreshNetworkStatus }}>
      {children}
    </NetworkContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Hook to access network connectivity state.
 * Must be used within a <NetworkProvider>.
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
