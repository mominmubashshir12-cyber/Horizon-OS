// Cron job for auto-checkout logic at 9 PM IST
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

const fixStuckShiftsOnStartup = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuckAttendances = await prisma.attendance.findMany({
      where: {
        checkOutTime: null,
        checkInTime: { lt: twentyFourHoursAgo },
        isMultiDay: false
      },
      include: { user: true }
    });

    for (const record of stuckAttendances) {
      const closedTime = new Date(record.checkInTime!.getTime() + 16 * 60 * 60 * 1000);
      
      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutTime: closedTime,
          checkoutAuto: true
        }
      });

      await prisma.systemAlert.create({
        data: {
          title: 'Legacy Shift Corrected',
          type: 'AUTO_CHECKOUT',
          severity: 'WARNING',
          message: `Stuck shift corrected for ${record.user.fullName}. Was open since ${record.checkInTime!.toISOString()}. Please review.`,
          firmId: record.firmId
        }
      });
    }
  } catch (error) {
    console.error('[Startup Data Fix] Error fixing stuck shifts:', error);
  }
};

const runAutoCheckout = async (runName: string) => {
  console.log(`[Cron] Running Auto Checkout (${runName})...`);
  try {
    const attendances = await prisma.attendance.findMany({
      where: {
        checkOutTime: null,
        checkInTime: { not: null },
        isMultiDay: false,
        expectedCheckoutDate: null
      },
      include: { user: true }
    });

    const settings = await prisma.firmSettings.findUnique({ where: { id: 1 } });
    const autoCheckoutTimeString = settings?.autoCheckoutTime || "22:00";
    const [coHours, coMins] = autoCheckoutTimeString.split(':').map(Number);

    for (const record of attendances) {
      const dateStringIST = record.date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      const [mm, dd, yyyy] = dateStringIST.split('/');
      const autoCheckoutTime = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), coHours - 5, coMins - 30, 0));

      let updateData: any = {
        checkOutTime: autoCheckoutTime,
        checkoutAuto: true,
        checkoutAutoTime: new Date()
      };

      if (record.lunchStartTime && !record.lunchEndTime) {
        updateData.lunchEndTime = autoCheckoutTime;
        updateData.lunchAutoClose = true;
        updateData.lunchDurationMins = Math.floor((autoCheckoutTime.getTime() - record.lunchStartTime.getTime()) / 60000);
      }

      await prisma.attendance.update({
        where: { id: record.id },
        data: updateData
      });

      await prisma.systemAlert.create({
        data: {
          title: 'Auto Checkout Applied',
          type: 'AUTO_CHECKOUT',
          severity: 'INFO',
          message: `Auto checkout applied for ${record.user.fullName} at ${autoCheckoutTimeString}. They did not check out manually.`,
          firmId: record.firmId
        }
      });
    }
  } catch (error) {
    console.error(`[Cron] Auto Checkout (${runName}) error:`, error);
  }
};

const runHourlyCheckout = async () => {
  console.log(`[Cron] Running Hourly Checkout...`);
  try {
    const now = new Date();
    const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // 1. Single-day shifts over 16h
    const overLimitSingleDay = await prisma.attendance.findMany({
      where: {
        isMultiDay: false,
        checkInTime: { lt: sixteenHoursAgo },
        checkOutTime: null
      },
      include: { user: true }
    });

    for (const record of overLimitSingleDay) {
      const calculatedClose = new Date(record.checkInTime!.getTime() + 16 * 60 * 60 * 1000);
      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutTime: calculatedClose,
          checkoutAuto: true
        }
      });
      await prisma.systemAlert.create({
        data: {
          title: 'Auto Checkout - Exceeded Limit',
          type: 'AUTO_CHECKOUT',
          severity: 'WARNING',
          message: `Employee ${record.user.fullName} was auto-checked out after 16h. Review attendance record.`,
          firmId: record.firmId
        }
      });
    }

    // 2. Multi-day shifts past expected end
    const overLimitMultiDay = await prisma.attendance.findMany({
      where: {
        isMultiDay: true,
        expectedCheckoutDate: { lt: now },
        checkOutTime: null
      },
      include: { user: true }
    });

    for (const record of overLimitMultiDay) {
      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutTime: record.expectedCheckoutDate,
          checkoutAuto: true
        }
      });
    }

    // 3. Multi-day shifts completed early
    const activeMultiDay = await prisma.attendance.findMany({
      where: {
        isMultiDay: true,
        checkOutTime: null,
        checkInTime: { not: null },
        expectedCheckoutDate: { not: null }
      },
      include: { user: true }
    });

    for (const record of activeMultiDay) {
      const linkedJobs = await prisma.jobCard.findMany({
        where: {
          assignedEmployees: { some: { id: record.userId } },
          scheduledDate: {
            gte: record.checkInTime!,
            lte: record.expectedCheckoutDate!
          }
        }
      });

      if (linkedJobs.length > 0) {
        const allCompleted = linkedJobs.every(job => 
          (job.status === 'VERIFIED' || job.status === 'COMPLETED') &&
          job.updatedAt <= twoHoursAgo
        );

        if (allCompleted) {
          // Find the latest updatedAt among the linked jobs
          const latestUpdate = linkedJobs.reduce((latest, job) => job.updatedAt > latest ? job.updatedAt : latest, linkedJobs[0].updatedAt);
          
          await prisma.attendance.update({
            where: { id: record.id },
            data: {
              checkOutTime: latestUpdate,
              checkoutAuto: true
            }
          });

          await prisma.systemAlert.create({
            data: {
              title: 'Auto Checkout - Job Completed Early',
              type: 'AUTO_CHECKOUT',
              severity: 'INFO',
              message: `Employee ${record.user.fullName} was auto-checked out because their job was marked complete. Verify attendance record.`,
              firmId: record.firmId
            }
          });
        }
      }
    }

  } catch (error) {
    console.error(`[Cron] Hourly Checkout error:`, error);
  }
};

export const startAutoCheckoutJobs = () => {
  // One-time data fix at startup
  fixStuckShiftsOnStartup();

  cron.schedule('29 15 * * *', () => runAutoCheckout('9 PM Run'));
  cron.schedule('30 9 * * *', () => runAutoCheckout('3 AM Run'));
  cron.schedule('0 * * * *', () => runHourlyCheckout()); // run every hour
};
