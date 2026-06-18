// contexts/AuthContext.tsx
// Authentication context for the Horizon OS mobile app.
// Manages the full auth lifecycle: login, logout, token persistence,
// and session restoration on app startup.
//
// On mount, reads stored tokens and user data from AsyncStorage.
// Exposes login/logout functions and current auth state to the entire app
// via React Context. The login function calls POST /auth/login and persists
// the access token, refresh token, and user profile locally.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL, STORAGE_KEYS } from '../constants/api';
import { clearAllOffline } from '../services/offline';
import type { AuthUser, ApiResponse, LoginResponse } from '../types';

// ─── Context Type ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Currently authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** Current access token, or null */
  token: string | null;
  /** True while the initial auth state is being restored from storage */
  isLoading: boolean;
  /** Convenience boolean: true when user and token are both present */
  isAuthenticated: boolean;
  /** Authenticate with username and password */
  login: (username: string, password: string) => Promise<void>;
  /** Clear all auth state and cached data */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = !!(user && token);

  // ── Restore session on mount ──────────────────────────────────────────────

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.USER,
        ]);

        const accessToken = storedToken[1];
        const userJson = storedUser[1];

        if (accessToken && userJson) {
          const parsedUser = JSON.parse(userJson) as AuthUser;
          setToken(accessToken);
          setUser(parsedUser);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[Auth] Failed to restore session:', msg);
        // If restoration fails, user simply needs to log in again
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      // Use a raw axios call here (not the api instance) to avoid
      // the auth interceptor injecting a stale/missing token
      const response = await axios.post<ApiResponse<LoginResponse>>(
        `${BASE_URL}/auth/login`,
        { username, password }
      );

      const { accessToken, refreshToken, user: loggedInUser } = response.data.data;

      // Persist tokens and user profile
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
        [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
        [STORAGE_KEYS.USER, JSON.stringify(loggedInUser)],
      ]);

      setToken(accessToken);
      setUser(loggedInUser);
    },
    []
  );

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear auth tokens
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);

      // Clear cached offline data
      await clearAllOffline();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Auth] Error during logout cleanup:', msg);
    } finally {
      // Always reset in-memory state even if storage cleanup fails
      setToken(null);
      setUser(null);
    }
  }, []);

  // ── Provide ───────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Hook to access authentication state and actions.
 * Must be used within an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
