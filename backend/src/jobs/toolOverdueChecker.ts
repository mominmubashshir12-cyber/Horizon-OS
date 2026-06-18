import { prisma } from '../lib/prisma';

export async function runToolOverdueChecker(): Promise<void> {
  console.log('[ToolOverdueChecker] Scanning for overdue tool issuances...');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const overdueIssuances = await prisma.toolIssuance.findMany({
    where: {
      status: 'ISSUED',
      issuedAt: { lt: oneDayAgo },
      returnedAt: null,
      tool: {
        currentHolderId: { not: null }
      }
    },
    include: {
      tool: true,
      user: true
    }
  });

  for (const issuance of overdueIssuances) {
    await prisma.$transaction(async (tx) => {
      await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: { status: 'OVERDUE' }
      });

      const existingAlert = await tx.systemAlert.findFirst({
        where: {
          type: 'TOOL_OVERDUE',
          relatedEntity: 'ToolIssuance',
          relatedId: issuance.id,
          isDismissed: false
        }
      });

      if (!existingAlert) {
        await tx.systemAlert.create({
          data: {
            type: 'TOOL_OVERDUE',
            severity: 'WARNING',
            title: 'Tool Overdue Alert',
            message: `Tool ${issuance.tool.name} (${issuance.tool.toolCode}) issued to ${issuance.user.fullName} is overdue.`,
            relatedEntity: 'ToolIssuance',
            relatedId: issuance.id,
            firmId: issuance.firmId
          }
        });
      }
    });
  }

  console.log(`[ToolOverdueChecker] Overdue tool check completed. Found ${overdueIssuances.length} overdue issuances.`);
}
