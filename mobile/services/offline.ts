// services/offline.ts
// Simple key-value offline storage using AsyncStorage.
// Provides a thin abstraction for caching entity data locally so the app
// can display previously-fetched data when the device is offline.
//
// This is distinct from the SQLite sync queue (services/db.ts) which handles
// *mutations*. This module handles *read caching* for a better offline UX.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/api';

/**
 * Builds a namespaced AsyncStorage key for offline data.
 * @param entity - The entity type (e.g. 'jobs', 'products')
 */
function offlineKey(entity: string): string {
  return `${STORAGE_KEYS.OFFLINE_PREFIX}${entity}`;
}

/**
 * Saves entity data to offline storage.
 * Data is JSON-serialized before storage.
 *
 * @param entity - The entity type key
 * @param data - The data to cache (must be JSON-serializable)
 */
export async function saveOffline<T>(entity: string, data: T): Promise<void> {
  try {
    const key = offlineKey(entity);
    const serialized = JSON.stringify({
      data,
      cachedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(key, serialized);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown storage error';
    console.warn(`[Offline] Failed to save ${entity}: ${message}`);
  }
}

/**
 * Retrieves cached entity data from offline storage.
 * Returns null if no cached data exists or if deserialization fails.
 *
 * @param entity - The entity type key
 * @returns The cached data, or null
 */
export async function getOffline<T>(
  entity: string
): Promise<{ data: T; cachedAt: string } | null> {
  try {
    const key = offlineKey(entity);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { data: T; cachedAt: string };
    return parsed;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown storage error';
    console.warn(`[Offline] Failed to read ${entity}: ${message}`);
    return null;
  }
}

/**
 * Removes cached data for a specific entity from offline storage.
 *
 * @param entity - The entity type key to clear
 */
export async function clearOffline(entity: string): Promise<void> {
  try {
    const key = offlineKey(entity);
    await AsyncStorage.removeItem(key);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown storage error';
    console.warn(`[Offline] Failed to clear ${entity}: ${message}`);
  }
}

/**
 * Clears ALL offline cached data (all entities).
 * Useful during logout to ensure no stale data persists.
 */
export async function clearAllOffline(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const offlineKeys = allKeys.filter((key) =>
      key.startsWith(STORAGE_KEYS.OFFLINE_PREFIX)
    );
    if (offlineKeys.length > 0) {
      await AsyncStorage.multiRemove(offlineKeys);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown storage error';
    console.warn(`[Offline] Failed to clear all offline data: ${message}`);
  }
}
