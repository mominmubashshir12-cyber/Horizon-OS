// src/jobs/staleJobChecker.ts
// Stale job checker cron — scans for jobs stuck in non-terminal states past 24 hours and dispatches SystemAlerts.

import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { createAlert } from '../services/alertService';

/**
 * Finds all job cards where status is PENDING or ASSIGNED,
 * and updatedAt is more than 24 hours ago, and creates a SystemAlert of type JOB_STALE,
 * severity WARNING for each one found.
 */
export async function runStaleJobChecker(): Promise<void> {
  console.log('[StaleJobChecker] Starting scan at:', new Date().toISOString());
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const staleJobs = await prisma.jobCard.findMany({
      where: {
        status: { in: ['PENDING', 'ASSIGNED'] },
        updatedAt: { lt: twentyFourHoursAgo },
      },
      include: {
        assignedEmployees: { select: { id: true }, take: 1 }
      }
    });

    console.log(`[StaleJobChecker] Found ${staleJobs.length} stale job card(s)`);

    for (const job of staleJobs) {
      const existingAlert = await prisma.systemAlert.findFirst({
        where: {
          relatedEntity: 'JobCard',
          relatedId: job.id,
          isDismissed: false,
          type: 'JOB_STALE',
        },
      });

      if (!existingAlert) {
        await createAlert({
          type: 'JOB_STALE',
          severity: 'WARNING',
          title: `Job Card #${job.jobNumber} is Stale`,
          message: `Job #${job.id} - ${job.clientName} has been ${job.status} for over 24 hours. Assign or escalate.`,
          relatedEntity: 'JobCard',
          relatedId: job.id,
          targetUserId: job.assignedEmployees[0]?.id || undefined,
        }, job.firmId);
        
        console.log(`[StaleJobChecker] Dispatched JOB_STALE alert for Job Card #${job.jobNumber}`);
      }
    }

    // ─── CHECK SCHEDULED DATE BREACH ─────────────────────────────────────────
    const overdueJobs = await prisma.jobCard.findMany({
      where: {
        status: { in: ['ASSIGNED', 'EN_ROUTE'] },
        arrivedAt: null,
        scheduledDate: { lt: new Date() },
        isOverdue: false,
      },
      include: {
        assignedEmployees: { select: { id: true }, take: 1 }
      }
    });

    console.log(`[StaleJobChecker] Found ${overdueJobs.length} newly overdue job card(s)`);

    for (const job of overdueJobs) {
      await prisma.jobCard.update({
        where: { id: job.id },
        data: { isOverdue: true }
      });

      await createAlert({
        type: 'JOB_OVERDUE',
        severity: 'CRITICAL',
        title: `Job Card #${job.jobNumber} is Overdue`,
        message: `Job #${job.id} - ${job.clientName} was scheduled for ${job.scheduledDate.toISOString().split('T')[0]} but work has not started.`,
        relatedEntity: 'JobCard',
        relatedId: job.id,
        targetUserId: job.assignedEmployees[0]?.id || undefined,
      }, job.firmId);
      
      console.log(`[StaleJobChecker] Dispatched JOB_OVERDUE alert for Job Card #${job.jobNumber}`);
    }
  } catch (error) {
    console.error('[StaleJobChecker] Scan execution error:', error);
  }
}

/**
 * Initializes the cron job to run every 30 minutes.
 */
export function initStaleJobChecker(): void {
  cron.schedule(
    '*/30 * * * *',
    async () => {
      console.log('[Cron] Executing stale job checker (every 30 mins)...');
      await runStaleJobChecker();
    },
    { scheduled: true }
  );
  console.log('[Cron] Stale job checker registered (every 30 mins)');
}
