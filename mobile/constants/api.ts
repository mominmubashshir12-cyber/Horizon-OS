// constants/api.ts
// Central API configuration for the Horizon OS mobile app.
// BASE_URL points to the backend REST API.
//
// IMPORTANT: 10.0.2.2 is Android emulator's alias for the host machine's localhost.
// For production deployment on a VPS, change this to your actual server URL,
// e.g. 'https://api.yourdomain.com/api'
// For iOS simulator, use 'http://localhost:3001/api' instead.
// For physical device testing on the same network, use the host machine's LAN IP.

import Constants from 'expo-constants';

export const BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.15:3001/api';

/** WebSocket URL for real-time features (future use) */
export const WS_URL = Constants.expoConfig?.extra?.wsUrl || 'ws://192.168.1.15:3001';

/** Keys used for AsyncStorage persistence */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@horizon/accessToken',
  REFRESH_TOKEN: '@horizon/refreshToken',
  USER: '@horizon/user',
  OFFLINE_PREFIX: '@horizon/offline/',
} as const;

/** Request timeout in milliseconds */
export const REQUEST_TIMEOUT = 15000;
