// services/sync.ts
// Offline sync flush service.
// When the device comes back online, this service reads all pending mutations
// from the local SQLite sync queue and replays them against the backend API.
// Each item is sent individually; on success it is marked as synced.
// Failed items remain in the queue for the next sync attempt.

import { getPendingSyncItems, markAsSynced, clearSyncedItems } from './db';
import { apiPost } from './api';

/**
 * Flushes all pending offline mutations to the backend.
 *
 * For each queued item, sends a POST to /sync with the entity, action, and
 * payload. Successfully synced items are marked in the local DB. After all
 * items are processed, synced rows are cleaned up.
 *
 * This function is designed to be called automatically when connectivity
 * is restored (see NetworkContext) and can also be triggered manually.
 *
 * @returns The number of items successfully synced
 */
export async function flushSyncQueue(): Promise<number> {
  const pendingItems = await getPendingSyncItems();

  if (pendingItems.length === 0) {
    return 0;
  }

  let syncedCount = 0;

  for (const item of pendingItems) {
    try {
      // Parse the stored JSON payload back into an object
      const payload: Record<string, unknown> = JSON.parse(item.payload) as Record<string, unknown>;

      await apiPost('/sync', {
        entity: item.entity,
        entityId: item.entityId,
        action: item.action,
        payload,
        clientTimestamp: item.createdAt,
      });

      await markAsSynced(item.id);
      syncedCount++;
    } catch (error: unknown) {
      // Log but don't throw — let remaining items attempt to sync.
      // The failed item stays in the queue for the next sync cycle.
      const message =
        error instanceof Error ? error.message : 'Unknown sync error';
      console.warn(
        `[Sync] Failed to sync item ${item.id} (${item.entity}/${item.action}): ${message}`
      );
    }
  }

  // Clean up successfully synced rows to keep the DB lean
  await clearSyncedItems();

  console.log(`[Sync] Flushed ${syncedCount}/${pendingItems.length} items`);
  return syncedCount;
}
