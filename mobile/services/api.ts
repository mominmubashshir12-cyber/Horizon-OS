// services/api.ts
// Axios-based HTTP client for the Horizon OS backend API.
// Features:
//   - Automatic Bearer token injection from AsyncStorage on every request
//   - 401 response interception with transparent token refresh and request retry
//   - Typed helper functions (apiGet, apiPost, apiPut, apiDelete) for clean call sites
//   - Queues concurrent requests during a token refresh to avoid duplicate refresh calls

import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, REQUEST_TIMEOUT, STORAGE_KEYS } from '../constants/api';
import type { ApiResponse } from '../types';

// ─── Axios Instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Token Refresh State ───────────────────────────────────────────────────────

let isRefreshing = false;
type QueuedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};
let failedQueue: QueuedRequest[] = [];

/**
 * Processes queued requests that were waiting for a token refresh.
 * On success, retries each with the new token. On failure, rejects all.
 */
function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// ─── Request Interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ─── Response Interceptor (401 → Refresh → Retry) ─────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401s that haven't already been retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
        `${BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const newAccessToken = data.data.accessToken;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);

      processQueue(null, newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh failed — clear all auth state (force logout)
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Typed API Helpers ─────────────────────────────────────────────────────────

/**
 * Typed GET request. Returns the unwrapped response data.
 */
export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await api.get<ApiResponse<T>>(url, config);
  return response.data;
}

/**
 * Typed POST request. Returns the unwrapped response data.
 */
export async function apiPost<T>(
  url: string,
  body?: Record<string, unknown>,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await api.post<ApiResponse<T>>(url, body, config);
  return response.data;
}

/**
 * Typed PUT request. Returns the unwrapped response data.
 */
export async function apiPut<T>(
  url: string,
  body?: Record<string, unknown>,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await api.put<ApiResponse<T>>(url, body, config);
  return response.data;
}

/**
 * Typed DELETE request. Returns the unwrapped response data.
 */
export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await api.delete<ApiResponse<T>>(url, config);
  return response.data;
}

export default api;
