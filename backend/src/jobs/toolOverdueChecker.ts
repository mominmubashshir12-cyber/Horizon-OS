import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { createAlert } from '../services/alertService';

export async function runToolOverdueChecker(): Promise<void> {
  console.log('[ToolOverdueChecker] Scanning for overdue tool issuances...');

  const now = new Date();

  const overdueIssuances = await prisma.toolIssuance.findMany({
    where: {
      status: 'ISSUED',
      expectedReturnDate: { lt: now },
      returnedAt: null,
      custodyLocation: { not: 'HOME' }
    },
    include: {
      tool: true,
      user: true
    }
  });

  for (const issuance of overdueIssuances) {
    const existingAlert = await prisma.systemAlert.findFirst({
      where: {
        type: 'TOOL_OVERDUE',
        relatedEntity: 'ToolIssuance',
        relatedId: issuance.id,
        isDismissed: false
      }
    });

    if (!existingAlert) {
      // Date displayed in IST format
      const dateIST = issuance.expectedReturnDate!.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      await createAlert({
        type: 'TOOL_OVERDUE',
        severity: 'WARNING',
        title: 'Tool Overdue Alert',
        message: `Tool '${issuance.tool.name}' issued to ${issuance.user.fullName} is overdue for return since ${dateIST}.`,
        relatedEntity: 'ToolIssuance',
        relatedId: issuance.id,
        targetUserId: issuance.userId,
      }, issuance.firmId);
    }
  }

  console.log(`[ToolOverdueChecker] Overdue tool check completed. Found ${overdueIssuances.length} overdue issuances.`);
}

/**
 * Initializes the cron job to run every hour.
 */
export function initToolOverdueChecker(): void {
  cron.schedule(
    '0 * * * *',
    async () => {
      console.log('[Cron] Executing tool overdue checker (every hour)...');
      await runToolOverdueChecker();
    },
    { scheduled: true }
  );
  console.log('[Cron] Tool overdue checker registered (every hour)');
}
