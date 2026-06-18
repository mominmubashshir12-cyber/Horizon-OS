// Alert service — creates, retrieves, and manages system alerts for the owner dashboard and user notifications.

import { prisma } from '../lib/prisma';
import { AlertSeverity, CreateAlertRequest } from '../types';

/**
 * Creates a new system alert.
 *
 * TODO: Implement with optional Socket.IO push to the target user's room.
 */
export async function createAlert(
  alertData: CreateAlertRequest,
  firmId: number
): Promise<void> {
  console.log(
    `[AlertService] Creating alert: "${alertData.title}" (${alertData.severity || 'INFO'})`
  );

  // TODO: Create the alert record
  // await prisma.systemAlert.create({ data: { ...alertData, firmId } });

  // TODO: Push via Socket.IO if targetUserId is specified
  // if (alertData.targetUserId) { io.to(`user-${alertData.targetUserId}`).emit('alert', ...); }
}

/**
 * Fetches unread alerts for a user (or all for owner).
 *
 * TODO: Implement with pagination support.
 */
export async function getUnreadAlerts(
  userId: number,
  firmId: number,
  isOwner: boolean
): Promise<void> {
  console.log(
    `[AlertService] Fetching unread alerts for user ${userId}, firm ${firmId}`
  );

  // TODO: Query alerts scoped to user or firm-wide for owners
  // const alerts = await prisma.systemAlert.findMany({ ... });
}

/**
 * Marks an alert as read.
 *
 * TODO: Update the isRead flag.
 */
export async function markAlertAsRead(alertId: number): Promise<void> {
  console.log(`[AlertService] Marking alert ${alertId} as read`);

  // TODO: await prisma.systemAlert.update({ where: { id: alertId }, data: { isRead: true } });
}

/**
 * Dismisses an alert.
 *
 * TODO: Update the isDismissed flag.
 */
export async function dismissAlert(alertId: number): Promise<void> {
  console.log(`[AlertService] Dismissing alert ${alertId}`);

  // TODO: await prisma.systemAlert.update({ where: { id: alertId }, data: { isDismissed: true } });
}

/**
 * Creates a low-stock alert for a product or material.
 *
 * TODO: Check stock levels and create CRITICAL alerts when below reorder level.
 */
export async function checkAndAlertLowStock(firmId: number): Promise<void> {
  console.log(`[AlertService] Checking low stock levels for firm ${firmId}`);

  // TODO: Query products and materials below reorder level
  // TODO: Create alerts for each
}
