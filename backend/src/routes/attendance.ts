import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOwner, requireOwnerOrSelf } from '../middleware/roleGuard';
import * as performanceService from '../services/performanceService';
import { ApiResponse, AuthenticatedRequest, AttendanceStatus } from '../types';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';

const checkinSchema = z.object({
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
  photo: z.string().optional()
});

const emptySchema = z.object({});

const correctionRequestSchema = z.object({
  requestType: z.string(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  requestedTime: z.union([z.string(), z.date()]).optional().nullable()
});

const approveCorrectionSchema = z.object({
  reviewNote: z.string().optional().nullable(),
  correctedTime: z.union([z.string(), z.date()]).optional().nullable()
});

const rejectCorrectionSchema = z.object({
  reviewNote: z.string().min(1, 'Review note is required for rejection')
});

const generateReportSchema = z.object({
  userId: z.number().optional().nullable(),
  month: z.number(),
  year: z.number()
});

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/attendance');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// GET /api/attendance/photo/:filename
// Serves a previously uploaded attendance photo (publicly accessible because filenames are randomized)
router.get('/photo/:filename', (req, res) => {
  try {
    const filename = req.params.filename as string;
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

// Apply auth middleware to all other routes
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
 * GET /api/attendance/today-status
 * Retrieves full unified attendance state for today for the logged-in employee.
 */
router.get('/today-status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const todayNormalized = getNormalizedISTDate(new Date());

    let attendance = await prisma.attendance.findFirst({
      where: { userId, checkOutTime: null },
      orderBy: { date: 'desc' }
    });

    if (!attendance) {
      attendance = await prisma.attendance.findUnique({
        where: { userId_date: { userId, date: todayNormalized } }
      });
    }

    let pendingCorrectionRequest = false;
    if (attendance) {
      const reqCount = await prisma.attendanceCorrectionRequest.count({
        where: { attendanceId: attendance.id, status: 'PENDING' }
      });
      pendingCorrectionRequest = reqCount > 0;
    }

    const data = {
      isCheckedIn: !!attendance,
      isOnLunch: !!(attendance?.lunchStartTime && !attendance?.lunchEndTime),
      isCheckedOut: !!attendance?.checkOutTime,
      lunchStartTime: attendance?.lunchStartTime || null,
      lunchEndTime: attendance?.lunchEndTime || null,
      lunchDurationMins: attendance?.lunchDurationMins || 0,
      lunchFlag: attendance?.lunchFlag || null,
      checkInTime: attendance?.checkInTime || null,
      checkOutTime: attendance?.checkOutTime || null,
      checkoutAuto: attendance?.checkoutAuto || false,
      isMultiDay: attendance?.isMultiDay || false,
      expectedCheckoutDate: attendance?.expectedCheckoutDate || null,
      pendingCorrectionRequest
    };

    res.status(200).json({ success: true, data, message: 'Status fetched' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to retrieve today status' });
  }
});

/**
 * POST /api/attendance/checkin
 * Records employee check-in, calculates late minutes, and captures location coordinates/photos.
 */
router.post('/checkin', validateBody(checkinSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
router.post('/checkout', validateBody(emptySchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    let updateData: any = {
      checkOutTime: new Date(),
      checkoutConfirmed: true
    };

    if (attendance.lunchStartTime && !attendance.lunchEndTime) {
      updateData.lunchEndTime = new Date();
      updateData.lunchAutoClose = true;
      const durationMins = Math.floor((updateData.lunchEndTime.getTime() - attendance.lunchStartTime.getTime()) / 60000);
      updateData.lunchDurationMins = durationMins;
      if (durationMins > 90) {
        updateData.lunchFlag = 'RED';
        updateData.lunchPenaltyMins = durationMins - 90;
      } else if (durationMins > 60) {
        updateData.lunchFlag = 'WARNING';
      }
    }

    const updated = await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: updateData,
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
 * POST /api/attendance/lunch-start
 */
router.post('/lunch-start', validateBody(emptySchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const todayNormalized = getNormalizedISTDate(new Date());

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayNormalized } }
    });

    if (!attendance) {
      res.status(400).json({ success: false, data: null, message: 'You must check in first' });
      return;
    }
    if (attendance.checkOutTime) {
      res.status(400).json({ success: false, data: null, message: 'You have already checked out' });
      return;
    }
    if (attendance.lunchStartTime && !attendance.lunchEndTime) {
      res.status(400).json({ success: false, data: null, message: 'You are already on lunch break' });
      return;
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { lunchStartTime: new Date() }
    });
    res.status(200).json({ success: true, data: updated, message: 'Lunch break started' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to start lunch break' });
  }
});

/**
 * POST /api/attendance/lunch-end
 */
router.post('/lunch-end', validateBody(emptySchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const todayNormalized = getNormalizedISTDate(new Date());

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayNormalized } }
    });

    if (!attendance || !attendance.lunchStartTime || attendance.lunchEndTime) {
      res.status(400).json({ success: false, data: null, message: 'You are not on an active lunch break' });
      return;
    }

    const endTime = new Date();
    const durationMins = Math.floor((endTime.getTime() - attendance.lunchStartTime.getTime()) / 60000);
    
    let lunchFlag: string | null = null;
    let lunchPenaltyMins = 0;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (durationMins > 90) {
      lunchFlag = 'RED';
      lunchPenaltyMins = durationMins - 90;
      await prisma.systemAlert.create({
        data: {
          title: 'Lunch Overtime',
          type: 'LUNCH_OVERTIME',
          severity: 'CRITICAL',
          message: `Employee ${user?.fullName} took ${durationMins} minute lunch break (red flag threshold: 90 minutes)`,
          firmId: req.user!.firmId
        }
      });
    } else if (durationMins > 60) {
      lunchFlag = 'WARNING';
      await prisma.systemAlert.create({
        data: {
          title: 'Lunch Overtime',
          type: 'LUNCH_OVERTIME',
          severity: 'WARNING',
          message: `Employee ${user?.fullName} took ${durationMins} minute lunch break (warning threshold: 60 minutes)`,
          firmId: req.user!.firmId
        }
      });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        lunchEndTime: endTime,
        lunchDurationMins: durationMins,
        lunchFlag,
        lunchPenaltyMins
      }
    });

    res.status(200).json({ success: true, data: updated, message: 'Lunch break ended' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to end lunch break' });
  }
});

/**
 * POST /api/attendance/correction-request
 */
router.post('/correction-request', validateBody(correctionRequestSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { requestType, reason, requestedTime } = req.body;

    const todayNormalized = getNormalizedISTDate(new Date());
    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayNormalized } }
    });

    if (!attendance) {
      res.status(400).json({ success: false, data: null, message: 'No attendance record for today' });
      return;
    }

    const existingPending = await prisma.attendanceCorrectionRequest.findFirst({
      where: { attendanceId: attendance.id, status: 'PENDING' }
    });

    if (existingPending) {
      res.status(400).json({ success: false, data: null, message: 'You already have a pending correction request for today' });
      return;
    }

    const correction = await prisma.attendanceCorrectionRequest.create({
      data: {
        attendanceId: attendance.id,
        userId,
        requestType,
        reason,
        requestedTime: requestedTime ? new Date(requestedTime) : null,
        firmId: req.user!.firmId
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.systemAlert.create({
      data: {
        title: 'Correction Request',
        type: 'CORRECTION_REQUEST',
        severity: 'WARNING',
        message: `Employee ${user?.fullName} has requested an attendance correction: ${reason}`,
        firmId: req.user!.firmId
      }
    });

    res.status(201).json({ success: true, data: correction, message: 'Correction request submitted' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to submit correction request' });
  }
});

/**
 * GET /api/attendance/correction-requests
 */
router.get('/correction-requests', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const firmId = req.user!.firmId;
    const { status } = req.query;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const whereClause: any = { firmId };
    if (status) whereClause.status = status;

    const [requests, total] = await Promise.all([
      prisma.attendanceCorrectionRequest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendanceCorrectionRequest.count({ where: whereClause })
    ]);

    const userIds = requests.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true }
    });

    const dataWithUsers = requests.map(r => ({
      ...r,
      user: users.find(u => u.id === r.userId) || { fullName: 'Unknown' }
    }));

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ 
      success: true, 
      data: { data: dataWithUsers, total, page, limit, totalPages }, 
      message: 'Requests fetched' 
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch correction requests' });
  }
});

/**
 * PUT /api/attendance/correction-requests/:id/approve
 */
router.put('/correction-requests/:id/approve', requireOwner, validateBody(approveCorrectionSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { reviewNote, correctedTime } = req.body;

    const request = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id }
    });

    if (!request || request.status !== 'PENDING') {
      res.status(400).json({ success: false, data: null, message: 'Invalid or already processed request' });
      return;
    }

    const updatedRequest = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewNote,
        reviewedById: req.user!.userId,
        reviewedAt: new Date()
      }
    });

    let attendanceUpdateData: any = {};
    if (request.requestType === 'UNDO_CHECKOUT') {
      attendanceUpdateData = { checkOutTime: null, checkoutConfirmed: false };
    } else if (request.requestType === 'CORRECT_CHECKOUT_TIME') {
      attendanceUpdateData = { checkOutTime: correctedTime ? new Date(correctedTime) : request.requestedTime };
    } else if (request.requestType === 'CORRECT_CHECKIN_TIME') {
      const newCheckIn = correctedTime ? new Date(correctedTime) : request.requestedTime;
      attendanceUpdateData = { checkInTime: newCheckIn };
      
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (user && newCheckIn) {
        const [targetHour, targetMin] = (user.workStartTime || '09:00').split(':').map(Number);
        const targetMinutes = targetHour * 60 + targetMin;
        
        const timeStringIST = newCheckIn.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
        const [currentHour, currentMin] = timeStringIST.split(':').map(Number);
        const currentMinutes = currentHour * 60 + currentMin;

        attendanceUpdateData.lateMinutes = currentMinutes > targetMinutes ? currentMinutes - targetMinutes : 0;
      }
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id: request.attendanceId },
      data: attendanceUpdateData
    });

    res.status(200).json({ success: true, data: { request: updatedRequest, attendance: updatedAttendance }, message: 'Request approved' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to approve request' });
  }
});

/**
 * PUT /api/attendance/correction-requests/:id/reject
 */
router.put('/correction-requests/:id/reject', requireOwner, validateBody(rejectCorrectionSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { reviewNote } = req.body;

    const request = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote,
        reviewedById: req.user!.userId,
        reviewedAt: new Date()
      }
    });

    res.status(200).json({ success: true, data: request, message: 'Request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to reject request' });
  }
});

/**
 * PATCH /api/attendance/:id/extend-deployment
 * Extends the expected checkout date of an active multi-day deployment.
 * Restricted to OWNER / ADMIN.
 */
router.patch('/:id/extend-deployment', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { newExpectedCheckoutDate } = req.body;

    if (!newExpectedCheckoutDate) {
      res.status(400).json({ success: false, data: null, message: 'newExpectedCheckoutDate is required' });
      return;
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!attendance || !attendance.isMultiDay || attendance.checkOutTime) {
      res.status(400).json({ success: false, data: null, message: 'Only active multi-day deployments can be extended' });
      return;
    }

    const newDate = new Date(newExpectedCheckoutDate);
    if (attendance.expectedCheckoutDate && newDate <= attendance.expectedCheckoutDate) {
      res.status(400).json({ success: false, data: null, message: 'New expected return date must be AFTER the current one' });
      return;
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: { expectedCheckoutDate: newDate }
    });

    await prisma.systemAlert.create({
      data: {
        title: 'Deployment Extended',
        type: 'ATTENDANCE_CORRECTION',
        severity: 'INFO',
        message: `Deployment extended for ${attendance.user.fullName}. New expected return: ${newDate.toLocaleString()}`,
        firmId: attendance.firmId
      }
    });

    res.status(200).json({ success: true, data: updated, message: 'Deployment extended successfully' });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to extend deployment' });
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

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.attendance.findMany({
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
          skip,
          take: limit,
        }),
        prisma.attendance.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / limit);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const logsWithComputedFlag = await Promise.all(logs.map(async (log) => {
        let hasCompletedUnlinkedJob = false;
        
        if (log.isMultiDay && !log.checkOutTime && log.checkInTime && log.expectedCheckoutDate) {
          const linkedJobs = await prisma.jobCard.findMany({
            where: {
              assignedEmployees: { some: { id: log.userId } },
              scheduledDate: {
                gte: log.checkInTime,
                lte: log.expectedCheckoutDate
              }
            }
          });

          if (linkedJobs.length > 0) {
            const allCompleted = linkedJobs.every(job => 
              (job.status === 'VERIFIED' || job.status === 'COMPLETED') &&
              job.updatedAt <= twoHoursAgo
            );
            if (allCompleted) {
              hasCompletedUnlinkedJob = true;
            }
          }
        }

        return { ...log, hasCompletedUnlinkedJob };
      }));

      const response: ApiResponse<any> = {
        success: true,
        data: { data: logsWithComputedFlag, total, page, limit, totalPages },
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
    const userId = parseInt(req.params.userId as string, 10);
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
    const userId = parseInt(req.params.userId as string, 10);
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
router.post('/generate-report', requireOwner, validateBody(generateReportSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, month, year } = req.body;

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
    const userId = parseInt(req.params.userId as string, 10);
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
router.put('/performance/:id/approve', requireOwner, validateBody(emptySchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    
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

const setMultidaySchema = z.object({
  expectedCheckoutDate: z.string().datetime()
});

/**
 * PATCH /api/attendance/:id/set-multiday
 * (OWNER/ADMIN only)
 */
router.patch('/:id/set-multiday', requireOwner, validateBody(setMultidaySchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { expectedCheckoutDate } = req.body;
    
    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        isMultiDay: true,
        expectedCheckoutDate: new Date(expectedCheckoutDate)
      }
    });

    res.status(200).json({ success: true, data: updated, message: 'Attendance marked as multi-day deployment' });
  } catch (error) {
    console.error('[Attendance] Set multiday error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to mark attendance as multi-day' });
  }
});

export default router;
