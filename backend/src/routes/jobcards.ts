// src/routes/jobcards.ts
// Job card routes — manages job card CRUD operations, state transitions, verification, and analytics.

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { sendPushNotification } from '../services/notificationService';
import { ApiResponse, AuthenticatedRequest, JobStatus } from '../types';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/jobcards/stats
 * Returns job card counts grouped by status for the dashboard.
 * Restricted to OWNER / ADMIN.
 */
router.get(
  '/stats',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const firmId = req.user!.firmId;

      const counts = await prisma.jobCard.groupBy({
        by: ['status'],
        where: { firmId },
        _count: {
          status: true,
        },
      });

      // Map to key-value status object
      const stats: Record<string, number> = {
        ASSIGNED: 0,
        EN_ROUTE: 0,
        ARRIVED: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        VERIFIED: 0,
        CANCELLED: 0,
      };

      counts.forEach((item) => {
        if (item.status in stats) {
          stats[item.status] = item._count.status;
        }
      });

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
        message: 'Job card statistics fetched successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('[JobCards] Stats error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to fetch job card stats',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/jobcards
 * Lists job cards. OWNER/ADMIN sees all, employees see only their assigned jobs.
 * Supports filters: ?status=, ?assignedTo=, ?date=, ?search=
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const firmId = req.user!.firmId;
    const role = req.user!.role;
    const userId = req.user!.userId;
    const { status, assignedTo, date, search } = req.query;

    const whereClause: any = {
      firmId,
    };

    // Role-based visibility logic
    if (role !== 'OWNER' && role !== 'ADMIN') {
      whereClause.assignedToId = userId;
    } else if (assignedTo) {
      whereClause.assignedToId = parseInt(assignedTo as string, 10);
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (date) {
      const targetDate = new Date(date as string);
      const startOfDay = new Date(targetDate.setUTCHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setUTCHours(23, 59, 59, 999));
      whereClause.scheduledDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (search) {
      whereClause.OR = [
        { clientName: { contains: search as string } },
        { siteAddress: { contains: search as string } },
      ];
    }

    const jobCards = await prisma.jobCard.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const response: ApiResponse<typeof jobCards> = {
      success: true,
      data: jobCards,
      message: `Found ${jobCards.length} job card(s)`,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[JobCards] List error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to fetch job cards',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/jobcards/:id
 * Fetches a single job card with related site visits and material logs.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const firmId = req.user!.firmId;

    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Invalid job card id',
      };
      res.status(400).json(response);
      return;
    }

    const jobCard = await prisma.jobCard.findFirst({
      where: { id, firmId },
      include: {
        assignedTo: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
          },
        },
        siteVisits: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: { arrivedAt: 'desc' },
        },
        materialUsageLogs: {
          include: {
            material: {
              select: {
                name: true,
                unit: true,
              },
            },
            user: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: { takenAt: 'desc' },
        },
      },
    });

    if (!jobCard) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Job card not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<typeof jobCard> = {
      success: true,
      data: jobCard,
      message: 'Job card details retrieved',
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[JobCards] Detail error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to retrieve job card details',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/jobcards
 * Creates a new job card and assigns it to an employee.
 * Auto-generates jobNumber as JC-YYYY-XXX.
 * Restricted to OWNER / ADMIN.
 */
router.post(
  '/',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        clientName,
        clientPhone,
        siteAddress,
        mapsLink,
        jobType,
        equipmentNotes,
        notes,
        assignedToId,
        scheduledDate,
        estimatedDuration,
      } = req.body;

      if (!clientName || !jobType || !assignedToId || !scheduledDate) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Client Name, Job Type, Assigned To, and Scheduled Date are required',
        };
        res.status(400).json(response);
        return;
      }

      const firmId = req.user!.firmId;
      const currentYear = new Date().getFullYear();
      const yearPrefix = `JC-${currentYear}-`;

      // Transactional or safely sequenced generation of sequential job card number
      const jobNumber = await prisma.$transaction(async (tx) => {
        const latestJob = await tx.jobCard.findFirst({
          where: {
            jobNumber: {
              startsWith: yearPrefix,
            },
            firmId,
          },
          orderBy: {
            jobNumber: 'desc',
          },
        });

        let nextNumber = 1;
        if (latestJob) {
          const parts = latestJob.jobNumber.split('-');
          if (parts.length === 3) {
            const lastNum = parseInt(parts[2], 10);
            if (!isNaN(lastNum)) {
              nextNumber = lastNum + 1;
            }
          }
        }

        return `${yearPrefix}${String(nextNumber).padStart(3, '0')}`;
      });

      const newJobCard = await prisma.jobCard.create({
        data: {
          jobNumber,
          clientName,
          clientPhone,
          siteAddress,
          mapsLink,
          jobType,
          equipmentNotes,
          notes,
          assignedToId: parseInt(assignedToId, 10),
          scheduledDate: new Date(scheduledDate),
          estimatedDuration,
          createdById: req.user!.userId,
          firmId,
          status: 'ASSIGNED',
        },
        include: {
          assignedTo: {
            select: {
              fullName: true,
              deviceToken: true,
            },
          },
        },
      });

      // Dispatches push notification to assigned employee if token exists
      if (newJobCard.assignedTo.deviceToken) {
        try {
          await sendPushNotification(
            newJobCard.assignedToId,
            'New Job Card Assigned',
            `You have been assigned to Job card #${newJobCard.jobNumber} for ${newJobCard.clientName}.`
          );
        } catch (pushErr) {
          console.error('[JobCards] Push notification failed to send:', pushErr);
        }
      }

      const response: ApiResponse<typeof newJobCard> = {
        success: true,
        data: newJobCard,
        message: `Job Card ${jobNumber} created successfully`,
      };
      res.status(201).json(response);
    } catch (error) {
      console.error('[JobCards] Creation error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to create job card',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * PUT /api/jobcards/:id
 * Updates general parameters of an existing job card.
 * Restricted to OWNER / ADMIN.
 */
router.put(
  '/:id',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const firmId = req.user!.firmId;

      if (isNaN(id)) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Invalid job card id',
        };
        res.status(400).json(response);
        return;
      }

      const existing = await prisma.jobCard.findFirst({ where: { id, firmId } });
      if (!existing) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Job card not found',
        };
        res.status(404).json(response);
        return;
      }

      const {
        clientName,
        clientPhone,
        siteAddress,
        mapsLink,
        jobType,
        equipmentNotes,
        notes,
        assignedToId,
        scheduledDate,
        estimatedDuration,
      } = req.body;

      if (clientName === '' || jobType === '' || assignedToId === '') {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Client Name, Job Type, and Assigned To cannot be empty',
        };
        res.status(400).json(response);
        return;
      }

      const updated = await prisma.jobCard.update({
        where: { id },
        data: {
          clientName: clientName !== undefined ? clientName : existing.clientName,
          clientPhone: clientPhone !== undefined ? clientPhone : existing.clientPhone,
          siteAddress: siteAddress !== undefined ? siteAddress : existing.siteAddress,
          mapsLink: mapsLink !== undefined ? mapsLink : existing.mapsLink,
          jobType: jobType !== undefined ? jobType : existing.jobType,
          equipmentNotes: equipmentNotes !== undefined ? equipmentNotes : existing.equipmentNotes,
          notes: notes !== undefined ? notes : existing.notes,
          assignedToId: assignedToId !== undefined ? parseInt(assignedToId, 10) : existing.assignedToId,
          scheduledDate: scheduledDate !== undefined ? new Date(scheduledDate) : existing.scheduledDate,
          estimatedDuration: estimatedDuration !== undefined ? estimatedDuration : existing.estimatedDuration,
        },
      });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
        message: 'Job card updated successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('[JobCards] Update error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to update job card',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * PUT /api/jobcards/:id/status
 * Updates status pipeline for a job card.
 * Enforces order: ASSIGNED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED.
 */
router.put('/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const firmId = req.user!.firmId;
    const role = req.user!.role;
    const userId = req.user!.userId;
    const { status } = req.body;

    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Invalid job card id',
      };
      res.status(400).json(response);
      return;
    }

    const jobCard = await prisma.jobCard.findFirst({ where: { id, firmId } });
    if (!jobCard) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Job card not found',
      };
      res.status(404).json(response);
      return;
    }

    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';

    // Access control: non-owner/admin can only update their own assigned job card status
    if (!isOwnerAdmin && jobCard.assignedToId !== userId) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Access denied: You cannot update status of job cards not assigned to you',
      };
      res.status(403).json(response);
      return;
    }

    const currentStatus = jobCard.status;
    const targetStatus = status as JobStatus;

    const validPipeline: Record<string, string> = {
      ASSIGNED: 'EN_ROUTE',
      EN_ROUTE: 'ARRIVED',
      ARRIVED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    };

    // Validates the transitions unless setting to CANCELLED/VERIFIED (which is restricted to OWNER/ADMIN)
    if (targetStatus === 'CANCELLED' || targetStatus === 'VERIFIED') {
      if (!isOwnerAdmin) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: `Access denied: Only owners/admins can set jobs to ${targetStatus}`,
        };
        res.status(403).json(response);
        return;
      }
    } else {
      if (validPipeline[currentStatus] !== targetStatus) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: `Invalid status transition from ${currentStatus} to ${targetStatus}`,
        };
        res.status(400).json(response);
        return;
      }
    }

    const updateData: any = { status: targetStatus };

    // Capture specifics for arrived status transition
    if (targetStatus === 'ARRIVED') {
      const { lat, lng } = req.body;
      if (lat === undefined || lng === undefined) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Location latitude and longitude coordinates are required when marking arrived',
        };
        res.status(400).json(response);
        return;
      }

      updateData.arrivedAt = new Date();
      updateData.arrivedLat = parseFloat(lat);
      updateData.arrivedLng = parseFloat(lng);

      // Log site visit
      await prisma.siteVisit.create({
        data: {
          jobCardId: id,
          userId,
          arrivedAt: new Date(),
          arrivedLat: parseFloat(lat),
          arrivedLng: parseFloat(lng),
        },
      });
    }

    // Capture summary details for completion transition
    if (targetStatus === 'COMPLETED') {
      const { workSummary, issuesFound, nextVisitNeeded } = req.body;
      if (!workSummary) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Work summary details are required to complete job card',
        };
        res.status(400).json(response);
        return;
      }

      updateData.completedAt = new Date();
      updateData.workSummary = workSummary;
      updateData.issuesFound = issuesFound || null;
      updateData.nextVisitNeeded = nextVisitNeeded === true;
      if (req.body.completionPhoto) {
        updateData.completionPhoto = req.body.completionPhoto;
      }
    }

    const updated = await prisma.jobCard.update({
      where: { id },
      data: updateData,
    });

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: `Job Card status updated to ${targetStatus}`,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('[JobCards] Pipeline update error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Failed to update job card status',
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/jobcards/:id/verify
 * Verifies a completed job card.
 * Restricted to OWNER / ADMIN.
 */
router.put(
  '/:id/verify',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const firmId = req.user!.firmId;

      if (isNaN(id)) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Invalid job card id',
        };
        res.status(400).json(response);
        return;
      }

      const jobCard = await prisma.jobCard.findFirst({ where: { id, firmId } });
      if (!jobCard) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Job card not found',
        };
        res.status(404).json(response);
        return;
      }

      if (jobCard.status !== 'COMPLETED') {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Only completed job cards can be verified',
        };
        res.status(400).json(response);
        return;
      }

      const updated = await prisma.jobCard.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: req.user!.userId,
        },
      });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
        message: 'Job card verified successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('[JobCards] Verification error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to verify job card',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * DELETE /api/jobcards/:id
 * Soft deletes job card by marking it CANCELLED.
 * Restricted to OWNER / ADMIN.
 */
router.delete(
  '/:id',
  requireOwner,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const firmId = req.user!.firmId;

      if (isNaN(id)) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Invalid job card id',
        };
        res.status(400).json(response);
        return;
      }

      const existing = await prisma.jobCard.findFirst({ where: { id, firmId } });
      if (!existing) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Job card not found',
        };
        res.status(404).json(response);
        return;
      }

      const updated = await prisma.jobCard.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
        message: 'Job card cancelled successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('[JobCards] Delete/Cancel error:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to cancel job card',
      };
      res.status(500).json(response);
    }
  }
);

export default router;
