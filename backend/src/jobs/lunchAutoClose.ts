// Cron job for auto-closing forgotten lunch breaks
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

const runLunchAutoClose = async () => {
  console.log(`[Cron] Running Lunch Auto-Close...`);
  try {
    const todayNormalized = new Date();
    todayNormalized.setUTCHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.findMany({
      where: {
        lunchStartTime: { not: null },
        lunchEndTime: null
      },
      include: { user: true }
    });

    const settings = await prisma.firmSettings.findUnique({ where: { id: 1 } });
    const maxLunchDurationMins = settings?.maxLunchDurationMins || 60;
    const triggerThreshold = maxLunchDurationMins * 2; // e.g. if max is 60, auto-close after 120 mins

    const now = new Date();

    for (const record of attendances) {
      if (!record.lunchStartTime) continue;

      const diffMins = Math.floor((now.getTime() - record.lunchStartTime.getTime()) / 60000);
      if (diffMins > triggerThreshold) {
        const autoLunchEndTime = new Date(record.lunchStartTime.getTime() + triggerThreshold * 60000);

        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            lunchEndTime: autoLunchEndTime,
            lunchAutoClose: true,
            lunchFlag: 'RED',
            lunchDurationMins: triggerThreshold,
            lunchPenaltyMins: triggerThreshold - maxLunchDurationMins // e.g. 120 - 60 = 60 mins penalty
          }
        });

        await prisma.systemAlert.create({
          data: {
            title: 'Lunch Break Auto-Closed',
            type: 'LUNCH_NOT_CLOSED',
            severity: 'WARNING',
            message: `Lunch break auto-closed for ${record.user.fullName} after ${triggerThreshold} mins. Please review.`,
            firmId: record.firmId
          }
        });
      }
    }

  } catch (error) {
    console.error(`[Cron] Lunch Auto-Close error:`, error);
  }
};

export const startLunchAutoCloseJob = () => {
  cron.schedule('*/30 * * * *', runLunchAutoClose);
};
