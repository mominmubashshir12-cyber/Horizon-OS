// services/db.ts
// Local SQLite database for offline-first capabilities.
// Uses expo-sqlite to maintain a sync queue table that stores mutations made
// while the device is offline. When connectivity is restored, these queued
// items are flushed to the backend API by the sync service.
//
// Table: sync_queue
//   - id: auto-increment primary key
//   - entity: the backend entity type (e.g. 'job', 'attendance')
//   - entityId: the UUID of the entity being mutated
//   - action: CREATE | UPDATE | DELETE
//   - payload: JSON-serialized request body
//   - createdAt: ISO timestamp of when the mutation was queued
//   - synced: 0 = pending, 1 = successfully synced

import * as SQLite from 'expo-sqlite';
import type { SyncQueueItem } from '../types';

// ─── Database Instance ─────────────────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton database instance, opening it if necessary.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('horizon_offline.db');
  }
  return db;
}

// ─── Initialization ────────────────────────────────────────────────────────────

/**
 * Creates the sync_queue table if it does not already exist.
 * Call this once during app startup (e.g. in the root layout).
 */
export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entityId TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);
}

// ─── Queue Operations ──────────────────────────────────────────────────────────

/**
 * Adds a mutation to the offline sync queue.
 * @param entity - Backend entity type (e.g. 'job', 'product')
 * @param entityId - UUID of the entity
 * @param action - The mutation type
 * @param payload - The request body as a plain object
 */
export async function addToSyncQueue(
  entity: string,
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO sync_queue (entity, entityId, action, payload, createdAt, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [entity, entityId, action, JSON.stringify(payload), now]
  );
}

/**
 * Retrieves all sync queue items that have not yet been synced.
 * Ordered by creation time (oldest first) to maintain mutation ordering.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SyncQueueItem>(
    `SELECT id, entity, entityId, action, payload, createdAt, synced
     FROM sync_queue
     WHERE synced = 0
     ORDER BY createdAt ASC`
  );
  return rows;
}

/**
 * Marks a specific sync queue item as successfully synced.
 * @param id - The primary key of the sync queue row
 */
export async function markAsSynced(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE sync_queue SET synced = 1 WHERE id = ?`,
    [id]
  );
}

/**
 * Removes all sync queue items that have already been synced.
 * Call periodically to keep the local database lean.
 */
export async function clearSyncedItems(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM sync_queue WHERE synced = 1`);
}

/**
 * Returns the count of pending (un-synced) items.
 * Useful for showing a badge indicator in the UI.
 */
export async function getPendingCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0`
  );
  return result?.count ?? 0;
}
