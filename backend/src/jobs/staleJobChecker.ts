// src/jobs/staleJobChecker.ts
// Stale job checker cron — scans for jobs stuck in non-terminal states past 3 days and dispatches SystemAlerts.

import cron from 'node-cron';
import { prisma } from '../lib/prisma';

/**
 * Finds all job cards where status is not COMPLETED, VERIFIED, or CANCELLED,
 * and scheduledDate is more than 3 days ago, and creates a SystemAlert of type JOB_STALE,
 * severity WARNING for each one found. Skip creating duplicate alerts if one already exists
 * for that jobCardId and is not dismissed.
 */
export async function runStaleJobChecker(): Promise<void> {
  console.log('[StaleJobChecker] Starting scan at:', new Date().toISOString());
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find all job cards where status is not terminal and scheduledDate is older than 3 days
    const staleJobs = await prisma.jobCard.findMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'],
        },
        scheduledDate: {
          lt: threeDaysAgo,
        },
      },
    });

    console.log(`[StaleJobChecker] Found ${staleJobs.length} stale job card(s)`);

    for (const job of staleJobs) {
      // Check if there is an active, undismissed alert of type JOB_STALE for this job card
      const existingAlert = await prisma.systemAlert.findFirst({
        where: {
          relatedEntity: 'JobCard',
          relatedId: job.id,
          isDismissed: false,
          type: 'JOB_STALE',
        },
      });

      if (!existingAlert) {
        // Date displayed in IST format
        const dateIST = job.scheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        await prisma.systemAlert.create({
          data: {
            type: 'JOB_STALE',
            severity: 'WARNING',
            title: `Job Card #${job.jobNumber} is Stale`,
            message: `Job Card #${job.jobNumber} for ${job.clientName} was scheduled on ${dateIST} but remains in ${job.status} status.`,
            relatedEntity: 'JobCard',
            relatedId: job.id,
            targetUserId: job.assignedToId,
            firmId: job.firmId,
            isRead: false,
            isDismissed: false,
          },
        });
        console.log(`[StaleJobChecker] Dispatched JOB_STALE alert for Job Card #${job.jobNumber}`);
      }
    }
  } catch (error) {
    console.error('[StaleJobChecker] Scan execution error:', error);
  }
}

/**
 * Initializes the cron job to run every day at 8:00 AM IST.
 */
export function initStaleJobChecker(): void {
  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('[Cron] Executing daily stale job checker...');
      await runStaleJobChecker();
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );
  console.log('[Cron] Stale job checker registered (8:00 AM IST daily)');
}
