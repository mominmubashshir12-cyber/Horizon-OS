import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOwner, requireOwnerOrSelf } from '../middleware/roleGuard';
import * as performanceService from '../services/performanceService';
import { ApiResponse, AuthenticatedRequest, AttendanceStatus } from '../types';
import fs from 'fs';
import path from 'path';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/attendance');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Apply auth middleware to all routes
router.use(authenticateToken);

/**
 * Helper: Normalizes a given date to the start of the day in IST (00:00:00 UTC represented at midnight calendar values).
 */
function getNormalizedISTDate(date: Date): Date {
  const dateStringIST = date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }); // e.g. "6/17/2026"
  const [mm, dd, yyyy] = dateStringIST.split('/');
  return new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 0, 0, 0, 0));
}

/**
 * GET /api/attendance/photo/:filename
 * Serves a previously uploaded attendance photo.
 */
router.get('/photo/:filename', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename as string;
    // Basic sanitization
    if (!filename || filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ success: false, data: null, message: 'Invalid filename' });
      return;
    }
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ success: false, data: null, message: 'Photo not found' });
      return;
    }
    res.sendFile(filepath);
  } catch (error) {
    console.error('[Attendance] Photo serve error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to serve photo' });
  }
});

/**
 * GET /api/attendance/status
 * Retrieves today's current check-in/out status for the logged-in employee.
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const todayNormalized = getNormalizedISTDate(new Date());

    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayNormalized,
        },
      },
    });

    const data = {
      checkedIn: !!attendance,
      checkedOut: !!attendance?.checkOutTime,
      checkInTime: attendance?.checkInTime || null,
      checkOutTime: attendance?.checkOutTime || null,
      status: attendance?.status || null,
    };

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      message: attendance ? 'Today\'s attendance log found' : 'No attendance log for today yet',
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[Attendance] Status error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to retrieve attendance status',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/attendance/checkin
 * Records employee check-in, calculates late minutes, and captures location coordinates/photos.
 */
router.post('/checkin', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { latitude, longitude, photo, lat, lng } = req.body;

    const todayNormalized = getNormalizedISTDate(new Date());

    // Check if check-in already logged for today
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayNormalized,
        },
      },
    });

    if (existing) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'You have already checked in for today',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch user details for shift start time
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'User details not found',
      };
      res.status(404).json(response);
      return;
    }

    // Compute late minutes based on workStartTime (e.g. "09:00")
    const [targetHour, targetMin] = (user.workStartTime || '09:00').split(':').map(Number);
    const now = new Date();
    
    const timeStringIST = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const [currentHour, currentMin] = timeStringIST.split(':').map(Number);

    let lateMinutes = 0;
    const targetMinutes = targetHour * 60 + targetMin;
    const currentMinutes = currentHour * 60 + currentMin;

    if (currentMinutes > targetMinutes) {
      lateMinutes = currentMinutes - targetMinutes;
    }

    // Capture coords supporting both standard types and shortcut aliases
    const finalLat = latitude !== undefined ? parseFloat(latitude) : (lat !== undefined ? parseFloat(lat) : null);
    const finalLng = longitude !== undefined ? parseFloat(longitude) : (lng !== undefined ? parseFloat(lng) : null);

    // Save photo to file system instead of database
    let photoFilename: string | null = null;
    if (photo) {
      const isDataUri = photo.startsWith('data:image/');
      let base64Data = photo;
      let ext = 'jpg';
      if (isDataUri) {
        const matches = photo.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          ext = matches[1];
          base64Data = matches[2];
        }
      }
      photoFilename = `checkin_${userId}_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, photoFilename), base64Data, 'base64');
    }

    const log = await prisma.attendance.create({
      data: {
        userId,
        date: todayNormalized,
        checkInTime: new Date(),
        checkInLat: finalLat,
        checkInLng: finalLng,
        checkInPhoto: photoFilename,
        lateMinutes,
        status: 'PRESENT',
        firmId,
      },
    });

    const response: ApiResponse<typeof log> = {
      success: true,
      data: log,
      message: lateMinutes > 0 
        ? `Checked in successfully (Late by ${lateMinutes} minutes)` 
        : 'Checked in successfully on time',
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[Attendance] Check-in error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to record check-in',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/attendance/checkout
 * Records employee check-out for today's active attendance log.
 */
router.post('/checkout', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const todayNormalized = getNormalizedISTDate(new Date());

    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayNormalized,
        },
      },
    });

    if (!attendance) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'No check-in record found for today. You must check in first.',
      };
      res.status(400).json(response);
      return;
    }

    if (attendance.checkOutTime) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'You have already checked out for today',
      };
      res.status(400).json(response);
      return;
    }

    const updated = await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        checkOutTime: new Date(),
      },
    });

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: 'Checked out successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[Attendance] Check-out error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to record check-out',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/attendance
 * Retrieves attendance logs for the firm. Filters: ?userId=, ?startDate=, ?endDate=
 * Restricted to OWNER / ADMIN.
 */
router.get(
  '/',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const firmId = req.user!.firmId;
      const { userId, startDate, endDate } = req.query;

      const whereClause: any = {
        firmId,
      };

      if (userId) {
        whereClause.userId = parseInt(userId as string, 10);
      }

      if (startDate || endDate) {
        whereClause.date = {};
        if (startDate) {
          whereClause.date.gte = new Date(startDate as string);
        }
        if (endDate) {
          whereClause.date.lte = new Date(endDate as string);
        }
      }

      const logs = await prisma.attendance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              fullName: true,
              workStartTime: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const response: ApiResponse<typeof logs> = {
        success: true,
        data: logs,
        message: `Retrieved ${logs.length} attendance log(s)`,
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('[Attendance] Query error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to query attendance logs',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/attendance/today
 */
router.get('/today', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const firmId = req.user!.firmId;
    const todayNormalized = getNormalizedISTDate(new Date());

    const activeUsers = await prisma.user.findMany({
      where: { firmId, isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        workStartTime: true
      }
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        firmId,
        date: todayNormalized
      }
    });

    const attendanceMap = new Map();
    for (const att of attendances) {
      attendanceMap.set(att.userId, att);
    }

    const data = activeUsers.map(user => {
      const att = attendanceMap.get(user.id);
      if (att) {
        return {
          userId: user.id,
          fullName: user.fullName,
          role: user.role,
          workStartTime: user.workStartTime,
          checkInTime: att.checkInTime,
          checkOutTime: att.checkOutTime,
          lateMinutes: att.lateMinutes,
          status: att.status,
          checkInPhoto: att.checkInPhoto
        };
      } else {
        return {
          userId: user.id,
          fullName: user.fullName,
          role: user.role,
          workStartTime: user.workStartTime,
          checkInTime: null,
          checkOutTime: null,
          lateMinutes: null,
          status: 'ABSENT',
          checkInPhoto: null
        };
      }
    });

    res.status(200).json({ success: true, data, message: 'Today attendance fetched' });
  } catch (error) {
    console.error('[Attendance] Today error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch today attendance' });
  }
});

/**
 * GET /api/attendance/user/:userId
 */
router.get('/user/:userId', requireOwnerOrSelf('userId'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const now = new Date();
    const monthStr = req.query.month as string;
    const yearStr = req.query.year as string;
    
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { date: 'asc' }
    });

    res.status(200).json({ success: true, data: records, message: 'User attendance history fetched' });
  } catch (error) {
    console.error('[Attendance] User history error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch user history' });
  }
});

/**
 * GET /api/attendance/monthly-summary/:userId
 */
router.get('/monthly-summary/:userId', requireOwnerOrSelf('userId'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const now = new Date();
    const monthStr = req.query.month as string;
    const yearStr = req.query.year as string;
    
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate }
      }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    let leaveDays = 0;
    let presentDays = 0;
    let totalLateDays = 0;
    let totalLateMinutes = 0;

    for (const rec of records) {
      if (rec.status === 'LEAVE') {
        leaveDays++;
      } else if (rec.status === 'PRESENT') {
        presentDays++;
        if (rec.lateMinutes > 0) {
          totalLateDays++;
          totalLateMinutes += rec.lateMinutes;
        }
      }
    }

    const totalWorkingDays = daysInMonth - leaveDays;
    const totalAbsent = totalWorkingDays - presentDays;
    const averageLateMinutes = totalLateDays > 0 ? (totalLateMinutes / totalLateDays) : 0;
    const onTimePercentage = totalWorkingDays > 0 ? ((presentDays - totalLateDays) / totalWorkingDays) * 100 : 0;

    const data = {
      totalWorkingDays,
      totalPresent: presentDays,
      totalAbsent,
      totalLateDays,
      totalLateMinutes,
      averageLateMinutes,
      onTimePercentage
    };

    res.status(200).json({ success: true, data, message: 'Monthly summary fetched' });
  } catch (error) {
    console.error('[Attendance] Monthly summary error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch monthly summary' });
  }
});

/**
 * POST /api/attendance/generate-report
 */
router.post('/generate-report', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, month, year } = req.body;
    if (!month || !year) {
      res.status(400).json({ success: false, data: null, message: 'month and year are required' });
      return;
    }

    let report;
    if (userId) {
      report = await performanceService.generateMonthlyReport(userId, month, year);
    } else {
      report = await performanceService.generateAllMonthlyReports(month, year);
    }

    res.status(200).json({ success: true, data: report, message: 'Report(s) generated successfully' });
  } catch (error) {
    console.error('[Attendance] Generate report error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to generate report' });
  }
});

/**
 * GET /api/attendance/performance/:userId
 */
router.get('/performance/:userId', requireOwnerOrSelf('userId'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const monthStr = req.query.month as string;
    const yearStr = req.query.year as string;

    if (!monthStr || !yearStr) {
      res.status(400).json({ success: false, data: null, message: 'month and year are required' });
      return;
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const report = await prisma.performanceReport.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year
        }
      }
    });

    if (report) {
      res.status(200).json({ success: true, data: report, message: 'Performance report fetched' });
    } else {
      res.status(200).json({ success: true, data: null, message: 'Performance report not generated yet' });
    }
  } catch (error) {
    console.error('[Attendance] Performance report error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch performance report' });
  }
});

/**
 * PUT /api/attendance/performance/:id/approve
 */
router.put('/performance/:id/approve', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const updated = await prisma.performanceReport.update({
      where: { id },
      data: {
        ownerApproved: true,
        approvedById: req.user!.userId,
        approvedAt: new Date()
      }
    });

    res.status(200).json({ success: true, data: updated, message: 'Performance report approved' });
  } catch (error) {
    console.error('[Attendance] Approve report error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to approve report' });
  }
});

export default router;
