import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { createAlert } from '../services/alertService';

export async function runMaterialHoldingChecker(): Promise<void> {
  console.log('[MaterialHoldingChecker] Scanning for unfinalized material holds...');

  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const holds = await prisma.materialUsageLog.findMany({
      where: {
        quantityUsed: 0,
        createdAt: { lt: twentyFourHoursAgo }
      },
      include: {
        user: true,
        jobCard: true
      }
    });

    for (const hold of holds) {
      const existingAlert = await prisma.systemAlert.findFirst({
        where: {
          type: 'MATERIAL_HOLD',
          relatedEntity: 'MaterialUsageLog',
          relatedId: hold.id,
          isDismissed: false
        }
      });

      if (!existingAlert) {
        await createAlert({
          type: 'MATERIAL_HOLD',
          severity: 'WARNING',
          title: 'Unfinalized Material Hold',
          message: `Material hold by ${hold.user.fullName} for job #${hold.jobCard?.jobNumber || hold.jobCardId} has not been finalized for 24+ hours. Review or release stock.`,
          relatedEntity: 'MaterialUsageLog',
          relatedId: hold.id,
          targetUserId: hold.userId,
        }, hold.jobCard?.firmId || 1);
      }
    }

    console.log(`[MaterialHoldingChecker] Check completed. Found ${holds.length} unfinalized holds.`);
  } catch (error) {
    console.error('[MaterialHoldingChecker] Error:', error);
  }
}

/**
 * Initializes the cron job to run every hour.
 */
export function initMaterialHoldingChecker(): void {
  cron.schedule(
    '0 * * * *',
    async () => {
      console.log('[Cron] Executing material holding checker (every hour)...');
      await runMaterialHoldingChecker();
    },
    { scheduled: true }
  );
  console.log('[Cron] Material holding checker registered (every hour)');
}
