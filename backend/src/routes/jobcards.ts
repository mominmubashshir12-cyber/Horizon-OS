// src/routes/jobcards.ts
// Job card routes — manages job card CRUD operations, state transitions, verification, and analytics.

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { sendPushNotification } from '../services/notificationService';
import { ApiResponse, AuthenticatedRequest, JobStatus } from '../types';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';

const jobRequestSchema = z.object({
  reason: z.string(),
  requestedJobId: z.union([z.string(), z.number()]).optional().nullable()
});

const approveJobRequestSchema = z.object({
  assignedJobId: z.union([z.string(), z.number()]).optional().nullable(),
  action: z.string().optional().nullable(),
  approve: z.boolean().optional().nullable()
});

const createJobCardSchema = z.object({
  clientName: z.string().min(1, 'Client Name is required'),
  clientPhone: z.string().optional().nullable(),
  siteAddress: z.string().optional().nullable(),
  mapsLink: z.string().optional().nullable(),
  jobType: z.string().min(1, 'Job Type is required'),
  equipmentNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedEmployeeIds: z.array(z.union([z.string(), z.number()])).optional(),
  requiredTools: z.array(z.union([z.string(), z.number()])).optional(),
  requiredMaterials: z.array(z.object({
    productId: z.union([z.string(), z.number()]),
    quantity: z.union([z.string(), z.number()])
  })).optional(),
  scheduledDate: z.string().min(1, 'Scheduled Date is required'),
  estimatedDuration: z.union([z.string(), z.number()]).optional().nullable(),
});

const updateJobCardSchema = z.object({
  clientName: z.string().optional(),
  clientPhone: z.string().optional().nullable(),
  siteAddress: z.string().optional().nullable(),
  mapsLink: z.string().optional().nullable(),
  jobType: z.string().optional(),
  equipmentNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedEmployeeIds: z.array(z.union([z.string(), z.number()])).optional(),
  requiredTools: z.array(z.union([z.string(), z.number()])).optional(),
  requiredMaterials: z.array(z.object({
    productId: z.union([z.string(), z.number()]),
    quantity: z.union([z.string(), z.number()])
  })).optional(),
  scheduledDate: z.string().optional(),
  estimatedDuration: z.union([z.string(), z.number()]).optional().nullable(),
});
const updateStatusSchema = z.object({
  status: z.string(),
  beforePhoto: z.string().optional().nullable(),
  lat: z.union([z.number(), z.string()]).optional().nullable(),
  lng: z.union([z.number(), z.string()]).optional().nullable(),
  workSummary: z.string().optional().nullable(),
  issuesFound: z.string().optional().nullable(),
  nextVisitNeeded: z.boolean().optional().nullable(),
  completionPhoto: z.string().optional().nullable(),
});

const verifySchema = z.object({
  qualityRating: z.enum(['EXCELLENT', 'GOOD', 'SATISFACTORY', 'POOR', 'NOT_DONE'])
});

const toggleToolsSchema = z.object({
  requiresTools: z.boolean()
});

const requestAddonSchema = z.object({
  tools: z.array(z.object({
    toolId: z.number(),
    reason: z.string()
  })).optional(),
  materials: z.array(z.object({
    materialId: z.number(),
    quantityRequested: z.number().min(0.1),
    reason: z.string()
  })).optional()
});

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
    const visibilityConditions: any[] = [];
    if (role !== 'OWNER' && role !== 'ADMIN') {
      visibilityConditions.push(
        { assignedEmployees: { some: { id: userId } } },
        { assignedEmployees: { none: {} }, status: 'UNASSIGNED' }
      );
    } else if (assignedTo) {
      whereClause.assignedEmployees = { some: { id: parseInt(assignedTo as string, 10) } };
    }

    const andConditions: any[] = [];
    if (visibilityConditions.length > 0) {
      andConditions.push({ OR: visibilityConditions });
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
      andConditions.push({
        OR: [
          { clientName: { contains: search as string } },
          { siteAddress: { contains: search as string } },
        ]
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const [jobCards, total] = await Promise.all([
      prisma.jobCard.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          assignedEmployees: {
            select: {
              fullName: true,
            },
          },
          addonRequests: {
            include: {
              requestedBy: { select: { fullName: true } },
              tools: { include: { tool: true } },
              materials: { include: { material: true } }
            },
            orderBy: { createdAt: 'desc' }
          },
        },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.jobCard.count({ where: whereClause })
    ]);
    
    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<any> = {
      success: true,
      data: { data: jobCards, total, page, limit, totalPages },
      message: `Found ${total} job card(s)`,
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
 * POST /api/jobcards/requests
 * Employee requests a new job because current is blocked
 */
router.post('/requests', validateBody(jobRequestSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { reason, requestedJobId } = req.body;
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;

    // Unassign current active jobs for this user
    const currentJobs = await prisma.jobCard.findMany({
      where: { assignedEmployees: { some: { id: userId } }, status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'] } },
      include: { assignedEmployees: true }
    });
    for (const job of currentJobs) {
      const isLast = job.assignedEmployees.length === 1;
      await prisma.jobCard.update({
        where: { id: job.id },
        data: { 
          assignedEmployees: { disconnect: { id: userId } }, 
          ...(isLast && { status: 'UNASSIGNED' }) 
        }
      });
    }

    const newRequest = await prisma.jobRequest.create({
      data: {
        userId,
        reason,
        requestedJobId: requestedJobId ? parseInt(requestedJobId, 10) : null,
        firmId
      }
    });

    res.status(201).json({ success: true, data: newRequest, message: 'Job request submitted successfully' } as any);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, data: null, message: 'Failed to submit request' } as any);
  }
});

/**
 * GET /api/jobcards/requests
 * List pending requests for admins
 */
router.get('/requests', requireOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const firmId = req.user!.firmId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.jobRequest.findMany({
        where: { firmId, status: 'PENDING' },
        skip,
        take: limit,
        include: {
          user: { select: { fullName: true } },
          requestedJob: { select: { jobNumber: true, clientName: true } }
        }
      }),
      prisma.jobRequest.count({ where: { firmId, status: 'PENDING' } })
    ]);
    
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ success: true, data: { data: requests, total, page, limit, totalPages }, message: 'Requests fetched' } as any);
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch requests' } as any);
  }
});

/**
 * PUT /api/jobcards/requests/:id/approve
 * Admin approves and assigns a job
 */
router.put('/requests/:id/approve', requireOwner, validateBody(approveJobRequestSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { assignedJobId, action, approve } = req.body; // action = APPROVED or DECLINED, approve from desktop
    const reviewerId = req.user!.userId;

    const request = await prisma.jobRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, data: null, message: 'Request not found' } as any);
      return;
    }

    const resolvedAction = action || (approve ? 'APPROVED' : 'DECLINED');

    if (resolvedAction === 'APPROVED') {
      const jobIdToAssign = assignedJobId ? parseInt(assignedJobId, 10) : request.requestedJobId;
      if (jobIdToAssign) {
        // Assign the job and change status to ASSIGNED
        await prisma.jobCard.update({
          where: { id: jobIdToAssign },
          data: { assignedEmployees: { connect: { id: request.userId } }, status: 'ASSIGNED' }
        });
      }
    }

    const updated = await prisma.jobRequest.update({
      where: { id },
      data: {
        status: resolvedAction,
        assignedJobId: assignedJobId ? parseInt(assignedJobId, 10) : request.requestedJobId,
        reviewedById: reviewerId,
        reviewedAt: new Date()
      }
    });

    res.status(200).json({ success: true, data: updated, message: `Request ${resolvedAction}` } as any);
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to process request' } as any);
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
        assignedEmployees: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
          },
        },
        photos: {
          include: {
            takenBy: { select: { fullName: true } }
          },
          orderBy: { takenAt: 'desc' }
        },
        requiredTools: {
          include: {
            tool: true
          }
        },
        requiredMaterials: {
          include: {
            product: true
          }
        },
        addonRequests: {
          include: {
            requestedBy: { select: { fullName: true } },
            tools: { include: { tool: true } },
            materials: { include: { material: true } }
          },
          orderBy: { createdAt: 'desc' }
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
            product: {
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
        toolIssuances: {
          include: {
            tool: {
              select: {
                name: true,
                toolCode: true
              }
            },
            user: {
              select: {
                fullName: true
              }
            }
          },
          orderBy: { issuedAt: 'desc' }
        },
        requestedBy: {
          where: { status: 'PENDING' },
          select: { userId: true, status: true }
        }
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

    const processedJobCard = {
      ...jobCard,
      requiredTools: jobCard.requiredTools.map((rt: any) => ({
        ...rt,
        isIssuedToMe: jobCard.toolIssuances.some(
          (iss: any) => iss.toolId === rt.toolId && iss.userId === req.user!.userId && iss.isApproved && iss.status !== 'RETURN_VERIFIED'
        )
      })),
      requiredMaterials: jobCard.requiredMaterials.map((rm: any) => ({
        ...rm,
        isTakenByMe: jobCard.materialUsageLogs.some(
          (log: any) => log.productId === rm.productId && log.userId === req.user!.userId && log.isApproved
        )
      }))
    };

    const response: ApiResponse<typeof processedJobCard> = {
      success: true,
      data: processedJobCard,
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
 * GET /api/jobcards/:id/photos
 * Retrieves all photos for a specific job card.
 */
router.get('/:id/photos', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const firmId = req.user!.firmId;

    if (isNaN(id)) {
      res.status(400).json({ success: false, data: null, message: 'Invalid job card id' });
      return;
    }

    const jobCard = await prisma.jobCard.findFirst({ where: { id, firmId } });
    if (!jobCard) {
      res.status(404).json({ success: false, data: null, message: 'Job not found' });
      return;
    }

    const photos = await prisma.jobPhoto.findMany({
      where: { jobCardId: id },
      include: {
        takenBy: { select: { fullName: true } }
      },
      orderBy: { takenAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: photos,
      message: 'Photos retrieved'
    });
  } catch (error) {
    console.error('[JobCards] Photos GET error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to retrieve photos' } as any);
  }
});

const createPhotoSchema = z.object({
  phase: z.enum(['ARRIVAL', 'COMPLETION']),
  photoUrl: z.string().url(),
  caption: z.string().optional(),
});

/**
 * POST /api/jobcards/:id/photos
 * Adds a new photo to the job card.
 */
router.post(
  '/:id/photos',
  validateBody(createPhotoSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const firmId = req.user!.firmId;

      if (isNaN(id)) {
        res.status(400).json({ success: false, data: null, message: 'Invalid job card id' });
        return;
      }

      const jobCard = await prisma.jobCard.findFirst({
        where: { id, firmId },
        include: { assignedEmployees: true }
      });

      if (!jobCard) {
        res.status(404).json({ success: false, data: null, message: 'Job not found' });
        return;
      }

      // Allow if assigned or owner
      const isAssigned = jobCard.assignedEmployees.some(e => e.id === req.user!.userId);
      if (!isAssigned && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
        res.status(403).json({ success: false, data: null, message: 'Not authorized for this job' });
        return;
      }

      const { phase, photoUrl, caption } = req.body;

      const newPhoto = await prisma.jobPhoto.create({
        data: {
          jobCardId: jobCard.id,
          phase,
          photoUrl,
          caption,
          takenById: req.user!.userId
        },
        include: { takenBy: { select: { fullName: true } } }
      });

      res.status(201).json({
        success: true,
        data: newPhoto,
        message: 'Photo added successfully'
      });
    } catch (error) {
      console.error('[JobCards] Photos POST error:', error);
      res.status(500).json({ success: false, data: null, message: 'Failed to add photo' } as any);
    }
  }
);

/**
 * POST /api/jobcards
 * Creates a new job card and assigns it to an employee.
 * Auto-generates jobNumber as JC-YYYY-XXX.
 * Restricted to OWNER / ADMIN.
 */
router.post(
  '/',
  requireOwner,
  validateBody(createJobCardSchema),
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
        assignedEmployeeIds,
        requiredTools,
        requiredMaterials,
        scheduledDate,
        estimatedDuration,
      } = req.body;

      // ── Stock availability check ─────────────────────────────────────────────
      // Reject the job card creation if any required material exceeds current stock.
      if (requiredMaterials && Array.isArray(requiredMaterials) && requiredMaterials.length > 0) {
        const firmId = req.user!.firmId;
        const shortfalls: string[] = [];

        for (const m of requiredMaterials) {
          const productId = parseInt(m.productId, 10);
          const needed = parseFloat(m.quantity);
          if (isNaN(productId) || isNaN(needed) || needed <= 0) continue;

          const product = await prisma.product.findFirst({
            where: { id: productId, firmId },
            select: { name: true, currentStock: true, unit: true },
          });

          if (product && product.currentStock < needed) {
            shortfalls.push(
              `${product.name}: need ${needed} ${product.unit}, only ${product.currentStock} in stock`
            );
          }
        }

        if (shortfalls.length > 0) {
          res.status(400).json({
            success: false,
            data: null,
            message: `Insufficient stock for the following materials:\n• ${shortfalls.join('\n• ')}`,
          } as ApiResponse<null>);
          return;
        }
      }
      // ────────────────────────────────────────────────────────────────────────

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

      const assignedIds = Array.isArray(assignedEmployeeIds) 
        ? assignedEmployeeIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id))
        : [];
      const status = assignedIds.length > 0 ? 'ASSIGNED' : 'UNASSIGNED';

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
          scheduledDate: new Date(scheduledDate),
          estimatedDuration,
          createdById: req.user!.userId,
          firmId,
          status,
          ...(assignedEmployeeIds && Array.isArray(assignedEmployeeIds) && {
            assignedEmployees: {
              connect: assignedEmployeeIds.map((id: any) => ({ id: parseInt(id, 10) }))
            }
          }),
          ...(requiredTools && Array.isArray(requiredTools) && {
            requiredTools: {
              create: requiredTools.map((id: any) => ({ toolId: parseInt(id, 10) }))
            }
          }),
          ...(requiredMaterials && Array.isArray(requiredMaterials) && {
            requiredMaterials: {
              create: requiredMaterials.map((m: any) => ({ productId: parseInt(m.productId, 10), quantity: parseFloat(m.quantity) }))
            }
          })
        },
        include: {
          assignedEmployees: {
            select: {
              id: true,
              fullName: true,
              deviceToken: true,
            },
          },
        },
      });

      // Dispatches push notification to assigned employees if token exists
      if (newJobCard.assignedEmployees && newJobCard.assignedEmployees.length > 0) {
        for (const emp of newJobCard.assignedEmployees) {
          if (emp.deviceToken) {
            try {
              await sendPushNotification(
                emp.id,
                'New Job Card Assigned',
                `You have been assigned to Job card #${newJobCard.jobNumber} for ${newJobCard.clientName}.`
              );
            } catch (pushErr) {
              console.error('[JobCards] Push notification failed to send:', pushErr);
            }
          }
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
  validateBody(updateJobCardSchema),
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
        assignedEmployeeIds,
        requiredTools,
        requiredMaterials,
        scheduledDate,
        estimatedDuration,
      } = req.body;

      let updateStatus = existing.status;
      let assignedEmployeesUpdate: any = undefined;

      if (assignedEmployeeIds !== undefined) {
        const assignedIds = Array.isArray(assignedEmployeeIds) 
          ? assignedEmployeeIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id))
          : [];
        
        assignedEmployeesUpdate = {
          set: assignedIds.map(id => ({ id }))
        };

        if (assignedIds.length === 0 && existing.status === 'ASSIGNED') {
          updateStatus = 'UNASSIGNED';
        } else if (assignedIds.length > 0 && existing.status === 'UNASSIGNED') {
          updateStatus = 'ASSIGNED';
        }
      }

      let requiredToolsUpdate: any = undefined;
      if (requiredTools !== undefined) {
        // delete many and create
        requiredToolsUpdate = {
          deleteMany: {},
          create: Array.isArray(requiredTools) ? requiredTools.map((id: any) => ({ toolId: parseInt(id, 10) })) : []
        };
      }

      let requiredMaterialsUpdate: any = undefined;
      if (requiredMaterials !== undefined) {
        // ── Stock availability check for edit ──────────────────────────────────
        if (Array.isArray(requiredMaterials) && requiredMaterials.length > 0) {
          const shortfalls: string[] = [];

          for (const m of requiredMaterials) {
            const productId = parseInt(m.productId, 10);
            const needed = parseFloat(m.quantity);
            if (isNaN(productId) || isNaN(needed) || needed <= 0) continue;

            const product = await prisma.product.findFirst({
              where: { id: productId, firmId },
              select: { name: true, currentStock: true, unit: true },
            });

            if (product && product.currentStock < needed) {
              shortfalls.push(
                `${product.name}: need ${needed} ${product.unit}, only ${product.currentStock} in stock`
              );
            }
          }

          if (shortfalls.length > 0) {
            res.status(400).json({
              success: false,
              data: null,
              message: `Insufficient stock for the following materials:\n• ${shortfalls.join('\n• ')}`,
            } as ApiResponse<null>);
            return;
          }
        }
        // ──────────────────────────────────────────────────────────────────────
        requiredMaterialsUpdate = {
          deleteMany: {},
          create: Array.isArray(requiredMaterials) ? requiredMaterials.map((m: any) => ({ productId: parseInt(m.productId, 10), quantity: parseFloat(m.quantity) })) : []
        };
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
          status: updateStatus,
          scheduledDate: scheduledDate !== undefined ? new Date(scheduledDate) : existing.scheduledDate,
          estimatedDuration: estimatedDuration !== undefined ? estimatedDuration : existing.estimatedDuration,
          ...(assignedEmployeesUpdate && { assignedEmployees: assignedEmployeesUpdate }),
          ...(requiredToolsUpdate && { requiredTools: requiredToolsUpdate }),
          ...(requiredMaterialsUpdate && { requiredMaterials: requiredMaterialsUpdate }),
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
router.put('/:id/status', validateBody(updateStatusSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Fetch the jobCard with assignedEmployees and required items
    const jobCard = await prisma.jobCard.findFirst({ 
      where: { id, firmId },
      include: { 
        assignedEmployees: { select: { id: true } },
        requiredTools: { include: { tool: { select: { id: true, name: true } } } },
        requiredMaterials: { include: { product: { select: { id: true, name: true } } } },
      }
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

    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';
    const isAssigned = jobCard.assignedEmployees.some(emp => emp.id === userId);

    // Access control: non-owner/admin can only update their own assigned job card status
    if (!isOwnerAdmin && !isAssigned) {
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

    if (targetStatus === 'EN_ROUTE') {
      const hasRequiredTools = jobCard.requiredTools.length > 0;
      const hasRequiredMaterials = jobCard.requiredMaterials.length > 0;

      if (hasRequiredTools || hasRequiredMaterials) {
        // Check team collectively — any assigned employee can issue on behalf of the group.
        // The individual who issued the item is recorded and is personally responsible for it.
        const teamMemberIds = jobCard.assignedEmployees.map((e: any) => e.id);

        const teamIssuedTools = await prisma.toolIssuance.findMany({
          where: { jobCardId: id, userId: { in: teamMemberIds } }
        });
        const teamUsedMaterials = await prisma.materialUsageLog.findMany({
          where: { jobCardId: id, userId: { in: teamMemberIds } }
        });

        const approvedIssuedToolIds = new Set(teamIssuedTools.filter(t => t.isApproved).map(t => t.toolId));
        const missingTools = jobCard.requiredTools.filter((rt: any) => !approvedIssuedToolIds.has(rt.toolId));

        const approvedUsedMaterialMap = new Map<number, number>();
        teamUsedMaterials.filter(m => m.isApproved).forEach(m => {
          approvedUsedMaterialMap.set(m.productId, (approvedUsedMaterialMap.get(m.productId) || 0) + m.quantityTaken);
        });
        const missingMaterials = jobCard.requiredMaterials.filter((rm: any) => (approvedUsedMaterialMap.get(rm.productId) || 0) < rm.quantity);

        if (missingTools.length > 0 || missingMaterials.length > 0) {
          const missingToolNames = missingTools.map((rt: any) => rt.tool?.name || `Tool #${rt.toolId}`).join(', ');
          const missingMatNames = missingMaterials.map((rm: any) => rm.product?.name || `Material #${rm.productId}`).join(', ');
          const allMissing = [missingToolNames, missingMatNames].filter(Boolean).join(', ');
          const response: ApiResponse<null> = {
            success: false,
            data: null,
            message: `Your team must request and get approval for all required items before starting the journey. Still missing/pending: ${allMissing}`,
          };
          res.status(400).json(response);
          return;
        }
      }
    }


    if (targetStatus === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
    }

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
      updateData.isOverdue = false;

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
      const completionPhotosCount = await prisma.jobPhoto.count({
        where: { jobCardId: id, phase: 'COMPLETION' }
      });
      if (completionPhotosCount === 0) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'At least one completion photo is required'
        };
        res.status(400).json(response);
        return;
      }

      updateData.completedAt = new Date();
      updateData.workSummary = workSummary;
      updateData.issuesFound = issuesFound || null;
      updateData.nextVisitNeeded = nextVisitNeeded === true;
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
  validateBody(verifySchema),
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

      const jobCard = await prisma.jobCard.findFirst({
        where: { id, firmId },
        include: { assignedEmployees: true }
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

      if (jobCard.status !== 'COMPLETED') {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Only completed job cards can be verified',
        };
        res.status(400).json(response);
        return;
      }

      // Only block on tools that were physically issued (approved) and not yet RETURN_VERIFIED.
      // Admin must confirm physical return — status goes ISSUED → RETURNED (employee) → RETURN_VERIFIED (admin).
      const unreturnedTools = await prisma.toolIssuance.findMany({
        where: { jobCardId: id, isApproved: true, status: { not: 'RETURN_VERIFIED' } }
      });
      // Only block on material logs that were approved and not yet owner-reviewed (admin accepted the return quantities).
      const unreturnedMaterials = await prisma.materialUsageLog.findMany({
        where: { jobCardId: id, isApproved: true, ownerReviewed: false }
      });

      if (unreturnedTools.length > 0 || unreturnedMaterials.length > 0) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Cannot verify job: there are unreturned tools or incomplete material logs assigned to this job.',
        };
        res.status(400).json(response);
        return;
      }

      const { qualityRating } = req.body;

      if (qualityRating === 'NOT_DONE') {
        const updated = await prisma.jobCard.update({
          where: { id },
          data: {
            status: 'ASSIGNED',
            startedAt: null,
            arrivedAt: null,
            completedAt: null,
            arrivedLat: null,
            arrivedLng: null,
            workSummary: null,
            issuesFound: null,
            nextVisitNeeded: false,
            qualityRating: 'NOT_DONE',
            assignedEmployees: { set: [] }
          }
        });

        const employeesToPenalize = jobCard.assignedEmployees || [];
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        for (const emp of employeesToPenalize) {
          await prisma.performanceReport.upsert({
            where: {
              userId_month_year: { userId: emp.id, month, year }
            },
            create: {
              userId: emp.id,
              firmId: firmId,
              month,
              year,
              disciplineScore: 85
            },
            update: {
              disciplineScore: { decrement: 15 }
            }
          });
        }

        res.status(200).json({
          success: true,
          data: updated,
          message: 'Job card marked NOT DONE and reverted to ASSIGNED',
        });
        return;
      }

      let scoreChange = 0;
      let isExcellent = false;
      if (qualityRating === 'EXCELLENT') { scoreChange = 10; isExcellent = true; }
      if (qualityRating === 'GOOD') scoreChange = 5;
      if (qualityRating === 'POOR') scoreChange = -5;

      const updated = await prisma.jobCard.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: req.user!.userId,
          qualityRating
        },
      });

      if (scoreChange !== 0 || isExcellent) {
        const employeesToReward = jobCard.assignedEmployees || [];
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        for (const emp of employeesToReward) {
          const employeeData = await prisma.user.findUnique({ where: { id: emp.id } });
          const baseSalary = employeeData?.baseSalary || 0;
          const bonusAmt = isExcellent ? (baseSalary * 0.05) : 0;

          await prisma.performanceReport.upsert({
            where: {
              userId_month_year: { userId: emp.id, month, year }
            },
            create: {
              userId: emp.id,
              firmId: firmId,
              month,
              year,
              disciplineScore: 100 + scoreChange,
              bonusAmount: bonusAmt,
              bonusReason: isExcellent ? `EXCELLENT rating on Job #${id}` : null
            },
            update: {
              disciplineScore: { increment: scoreChange },
              bonusAmount: { increment: bonusAmt },
              bonusReason: isExcellent ? `EXCELLENT rating on Job #${id}` : undefined
            }
          });
        }
      }

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
 * POST /api/jobcards/:id/request-addon
 * Create an addon request for tool/material mid-job.
 */
router.post(
  '/:id/request-addon',
  validateBody(requestAddonSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const firmId = req.user!.firmId;

      if (isNaN(id)) {
        res.status(400).json({ success: false, data: null, message: 'Invalid job card id' });
        return;
      }

      const jobCard = await prisma.jobCard.findFirst({
        where: { id, firmId },
        include: { assignedEmployees: true }
      });

      if (!jobCard) {
        res.status(404).json({ success: false, data: null, message: 'Job card not found' });
        return;
      }

      const isAssigned = jobCard.assignedEmployees.some(emp => emp.id === req.user!.userId);
      const isOwnerAdmin = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';

      if (!isAssigned && !isOwnerAdmin) {
        res.status(403).json({ success: false, data: null, message: 'Not authorized for this job card' });
        return;
      }

      const { tools, materials } = req.body;

      if ((!tools || tools.length === 0) && (!materials || materials.length === 0)) {
        res.status(400).json({ success: false, data: null, message: 'Must request at least one tool or material' });
        return;
      }

      const addon = await prisma.addonRequest.create({
        data: {
          jobCardId: id,
          requestedById: req.user!.userId,
          status: 'PENDING',
          tools: tools ? {
            create: tools.map((t: any) => ({
              toolId: t.toolId,
              reason: t.reason
            }))
          } : undefined,
          materials: materials ? {
            create: materials.map((m: any) => ({
              materialId: m.materialId,
              quantityRequested: m.quantityRequested,
              reason: m.reason
            }))
          } : undefined
        }
      });

      res.status(201).json({
        success: true,
        data: addon,
        message: 'Addon request submitted successfully',
      });
    } catch (error) {
      console.error('[JobCards] Error creating addon request:', error);
      res.status(500).json({ success: false, data: null, message: 'Failed to submit addon request' });
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

/**
 * PUT /api/jobcards/:id/no-tools
 * Toggles the requiresTools flag
 */
router.put('/:id/no-tools', requireOwner, validateBody(toggleToolsSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { requiresTools } = req.body;
    const updated = await prisma.jobCard.update({
      where: { id },
      data: { requiresTools: Boolean(requiresTools) }
    });
    res.status(200).json({ success: true, data: updated, message: 'Requirement updated' } as any);
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to update requirement' } as any);
  }
});

export default router;
