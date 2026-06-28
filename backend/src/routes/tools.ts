import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

// GET /api/tools
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { condition, currentHolderId, category } = req.query;
    const firmId = req.user!.firmId;

    const where: any = { firmId };
    if (condition) where.condition = condition as string;
    if (currentHolderId) where.currentHolderId = parseInt(currentHolderId as string, 10);
    if (category) where.category = category as string;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const [tools, total] = await Promise.all([
      prisma.tool.findMany({
        where,
        include: {
          currentHolder: {
            select: { fullName: true }
          }
        },
        skip,
        take: limit
      }),
      prisma.tool.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ success: true, data: { data: tools, total, page, limit, totalPages }, message: 'Tools retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/my-tools
router.get('/my-tools', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;

    const tools = await prisma.tool.findMany({
      where: { currentHolderId: userId, firmId }
    });

    // For each tool, find the active issuance
    const toolsWithIssuance = await Promise.all(tools.map(async (t) => {
      const issuance = await prisma.toolIssuance.findFirst({
        where: { toolId: t.id, userId, status: 'ISSUED' },
        orderBy: { issuedAt: 'desc' }
      });
      return {
        ...t,
        activeIssuanceId: issuance?.id,
        custodyLocation: issuance?.custodyLocation || 'OFFICE'
      };
    }));

    res.status(200).json({ success: true, data: toolsWithIssuance, message: 'My tools retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/issuances/for-job/:jobCardId
// Returns all tool issuances (pending + approved) for a job, with issuer info and transfer details.
router.get('/issuances/for-job/:jobCardId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const firmId = req.user!.firmId;
    const jobCardId = parseInt(req.params.jobCardId as string, 10);

    const issuances = await prisma.toolIssuance.findMany({
      where: { jobCardId, firmId },
      include: {
        tool: { select: { id: true, name: true, toolCode: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    // For RETURN_VERIFIED issuances, check if they were transferred (not physically returned)
    const enriched = await Promise.all(issuances.map(async (issuance) => {
      if (issuance.status === 'RETURN_VERIFIED') {
        const transfer = await prisma.toolTransferRequest.findFirst({
          where: {
            toolId: issuance.toolId,
            fromUserId: issuance.userId,
            jobCardId,
            status: 'ACCEPTED',
            firmId,
          },
          include: {
            toUser: { select: { id: true, fullName: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });
        return { ...issuance, transferredTo: transfer?.toUser || null };
      }
      return { ...issuance, transferredTo: null };
    }));

    res.status(200).json({ success: true, data: enriched, message: 'Job tool issuances retrieved' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools
const createToolSchema = z.object({
  toolCode: z.string().optional(),
  name: z.string(),
  category: z.string(),
  condition: z.string().optional(),
  purchasePrice: z.union([z.string(), z.number()]).optional(),
  replacementCost: z.union([z.string(), z.number()]).optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});
router.post('/', requireOwner, validateBody(createToolSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let { toolCode, name, category, condition, purchasePrice, replacementCost, photoUrl, notes } = req.body;
    const firmId = req.user!.firmId;

    if (!toolCode || toolCode.trim() === '') {
      const lastTool = await prisma.tool.findFirst({ where: { firmId }, orderBy: { id: 'desc' } });
      const nextNum = (lastTool?.id || 0) + 1;
      toolCode = `TL-${nextNum.toString().padStart(3, '0')}`;
    }

    const newTool = await prisma.tool.create({
      data: {
        name,
        toolCode,
        category,
        condition: condition || 'GOOD',
        purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
        replacementCost: replacementCost ? Number(replacementCost) : 0,
        photoUrl,
        notes,
        firmId
      }
    });

    res.status(201).json({ success: true, data: newTool, message: 'Tool created successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const tool = await prisma.tool.findFirst({
      where: { id: parseInt(id as string, 10), firmId },
      include: {
        issuances: {
          include: {
            user: { select: { fullName: true } }
          },
          orderBy: { issuedAt: 'desc' }
        }
      }
    });

    if (!tool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' });
      return;
    }

    res.status(200).json({ success: true, data: tool, message: 'Tool retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/:id
const updateToolSchema = z.object({
  toolCode: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  purchasePrice: z.union([z.string(), z.number()]).optional(),
  replacementCost: z.union([z.string(), z.number()]).optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});
router.put('/:id', requireOwner, validateBody(updateToolSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const updates = req.body;

    const existingTool = await prisma.tool.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!existingTool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' });
      return;
    }

    const tool = await prisma.tool.update({
      where: { id: parseInt(id as string, 10) },
      data: updates
    });

    res.status(200).json({ success: true, data: tool, message: 'Tool updated successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/:id/force-return
router.put('/:id/force-return', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const existingTool = await prisma.tool.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!existingTool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' });
      return;
    }

    if (existingTool.currentHolderId === null) {
      res.status(400).json({ success: false, data: null, message: 'Tool is already in the warehouse' });
      return;
    }

    // Force return the tool
    const tool = await prisma.tool.update({
      where: { id: parseInt(id as string, 10) },
      data: { currentHolderId: null }
    });

    // Close any active issuances
    await prisma.toolIssuance.updateMany({
      where: {
        toolId: tool.id,
        returnedAt: null
      },
      data: {
        returnedAt: new Date(),
        returnCondition: existingTool.condition || 'GOOD',
        status: 'RETURN_VERIFIED'
      }
    });

    // Create system alert
    await prisma.systemAlert.create({
      data: {
        title: 'Tool Forcefully Returned',
        type: 'INVENTORY_ALERT',
        severity: 'WARNING',
        message: `Tool ${tool.name} (${tool.toolCode}) was forcefully returned to the warehouse by admin.`,
        firmId
      }
    });

    res.status(200).json({ success: true, data: tool, message: 'Tool forcefully returned to warehouse' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/issue
const issueToolSchema = z.object({
  userId: z.number().int(),
  jobCardId: z.union([z.string(), z.number()]).optional(),
  issuedCondition: z.string().optional(),
});
router.post('/:id/issue', validateBody(issueToolSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const role = req.user!.role;
    const requesterId = req.user!.userId;
    const { userId, jobCardId, issuedCondition } = req.body;

    // If an employee is requesting, they can only request for themselves
    const targetUserId = (role === 'OWNER' || role === 'ADMIN') ? userId : requesterId;

    const tool = await prisma.tool.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!tool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' } as any);
      return;
    }

    let isCarryOver = false;

    if (tool.currentHolderId !== null) {
      if (tool.currentHolderId === targetUserId) {
        // The employee already holds it, they are carrying it over to a new job
        isCarryOver = true;
      } else {
        res.status(400).json({ success: false, data: null, message: 'Tool is already issued to another employee' } as any);
        return;
      }
    }

    // Check if there is already a pending issuance for this tool
    const pendingIssuance = await prisma.toolIssuance.findFirst({
      where: { toolId: tool.id, isApproved: false, status: 'PENDING_APPROVAL' }
    });
    if (pendingIssuance) {
      res.status(400).json({ success: false, data: null, message: 'Tool has a pending issuance request' } as any);
      return;
    }

    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';

    const result = await prisma.$transaction(async (tx) => {
      if (isCarryOver) {
        // Close the previous active issuance
        const activeIssuance = await tx.toolIssuance.findFirst({
          where: { toolId: tool.id, userId: targetUserId, status: 'ISSUED' },
          orderBy: { issuedAt: 'desc' }
        });
        if (activeIssuance) {
          await tx.toolIssuance.update({
            where: { id: activeIssuance.id },
            data: {
              status: 'RETURN_VERIFIED',
              returnedAt: new Date(),
              returnCondition: 'GOOD',
              penaltyNote: 'Carried over to new job'
            }
          });
        }
      }

      // Auto-approve if owner/admin is issuing, OR if the employee already holds it (carry-over)
      const isApprovedNow = isOwnerAdmin || isCarryOver;

      if (isApprovedNow && !isCarryOver) {
        // Update the current holder if it's a new issuance
        await tx.tool.update({
          where: { id: tool.id },
          data: { currentHolderId: targetUserId }
        });
      }

      const issuance = await tx.toolIssuance.create({
        data: {
          toolId: tool.id,
          userId: targetUserId,
          jobCardId: jobCardId ? parseInt(jobCardId, 10) : null,
          issuedCondition: issuedCondition || 'GOOD',
          status: isApprovedNow ? 'ISSUED' : 'PENDING_APPROVAL',
          isApproved: isApprovedNow,
          firmId
        }
      });

      if (isOwnerAdmin) {
        await tx.systemAlert.create({
          data: {
            type: 'INFO',
            title: 'Tool Issued',
            message: `You have been issued a tool: ${tool.name} (${tool.toolCode})`,
            targetUserId: targetUserId,
            firmId
          }
        });
      } else {
        await tx.systemAlert.create({
          data: {
            type: 'INFO',
            title: 'Tool Request Pending',
            message: `An employee has requested tool: ${tool.name} (${tool.toolCode}) for Job ID: ${jobCardId || 'N/A'}`,
            targetUserId: null,
            firmId
          }
        });
      }

      return issuance;
    });

    res.status(200).json({ success: true, data: result, message: isOwnerAdmin ? 'Tool issued successfully' : 'Tool requested successfully. Pending admin approval.' } as any);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/issuances/:id/approve
router.put('/issuances/:id/approve', requireOwner, validateBody(z.object({})), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const issuance = await prisma.toolIssuance.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!issuance || issuance.isApproved) {
      res.status(400).json({ success: false, data: null, message: 'Issuance not found or already approved' } as any);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.tool.update({
        where: { id: issuance.toolId },
        data: { currentHolderId: issuance.userId }
      });

      const updated = await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: { isApproved: true, status: 'ISSUED' },
        include: { tool: true }
      });

      await tx.systemAlert.create({
        data: {
          type: 'INFO',
          title: 'Tool Request Approved',
          message: `Your request for tool ${updated.tool.name} has been approved.`,
          targetUserId: issuance.userId,
          firmId
        }
      });

      return updated;
    });

    res.status(200).json({ success: true, data: result, message: 'Tool request approved' } as any);
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/return
const returnToolSchema = z.object({
  returnCondition: z.string().optional(),
});
router.post('/:id/return', validateBody(returnToolSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { returnCondition } = req.body;

    const tool = await prisma.tool.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!tool || tool.currentHolderId !== userId) {
      res.status(400).json({ success: false, data: null, message: 'You do not hold this tool' });
      return;
    }

    const issuance = await prisma.toolIssuance.findFirst({
      where: { toolId: tool.id, userId, status: 'ISSUED', firmId },
      orderBy: { issuedAt: 'desc' }
    });

    if (!issuance) {
      res.status(400).json({ success: false, data: null, message: 'No active issuance found' });
      return;
    }

    let penaltyAmount = 0;
    if (returnCondition === 'DAMAGED' || returnCondition === 'LOST') {
      penaltyAmount = tool.replacementCost / 6;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedIssuance = await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: {
          returnedAt: new Date(),
          returnCondition,
          status: 'RETURNED',
          penaltyAmount,
          penaltyApproved: false
        }
      });

      await tx.tool.update({
        where: { id: tool.id },
        data: {
          currentHolderId: null,
          condition: returnCondition || tool.condition
        }
      });

      if (returnCondition === 'DAMAGED' || returnCondition === 'LOST') {
        const ownerUsers = await tx.user.findMany({ where: { role: 'OWNER', firmId } });
        for (const owner of ownerUsers) {
          await tx.systemAlert.create({
            data: {
              type: 'WARNING',
              severity: 'WARNING',
              title: `Tool Returned as ${returnCondition}`,
              message: `Tool ${tool.name} (${tool.toolCode}) was returned by ${req.user!.username} as ${returnCondition}.`,
              targetUserId: owner.id,
              firmId
            }
          });
        }
      }

      return updatedIssuance;
    });

    res.status(200).json({ success: true, data: result, message: 'Tool returned successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/issuances/:id/set-custody
// Updates custody location of an issued tool (used by mobile app). Employee must own the issuance.
const setCustodySchema = z.object({
  custodyLocation: z.enum(['HOME', 'OFFICE'])
});
router.put('/issuances/:id/set-custody', validateBody(setCustodySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { custodyLocation } = req.body;

    const issuance = await prisma.toolIssuance.findUnique({ where: { id: parseInt(id as string, 10) } });
    if (!issuance) {
      res.status(404).json({ success: false, data: null, message: 'Issuance not found' });
      return;
    }

    if (issuance.userId !== userId) {
      res.status(403).json({ success: false, data: null, message: 'Not authorized for this issuance' });
      return;
    }

    if (issuance.status !== 'ISSUED') {
      res.status(400).json({ success: false, data: null, message: 'Tool must be currently issued' });
      return;
    }

    const updated = await prisma.toolIssuance.update({
      where: { id: parseInt(id as string, 10) },
      data: { custodyLocation }
    });

    res.status(200).json({ success: true, data: updated, message: 'Custody location updated' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/issuances/:id/return
// Returns a tool by issuance ID (used by mobile app). Employee must own the issuance.
router.put('/issuances/:id/return', validateBody(returnToolSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { returnCondition } = req.body;

    const issuance = await prisma.toolIssuance.findFirst({
      where: { id: parseInt(id as string, 10), firmId },
      include: { tool: true }
    });

    if (!issuance) {
      res.status(404).json({ success: false, data: null, message: 'Issuance not found' });
      return;
    }

    // Only the employee who took the tool (or owner/admin) can return it
    const role = req.user!.role;
    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';
    if (!isOwnerAdmin && issuance.userId !== userId) {
      res.status(403).json({ success: false, data: null, message: 'You can only return tools you issued' });
      return;
    }

    if (issuance.status === 'RETURNED') {
      res.status(400).json({ success: false, data: null, message: 'This tool has already been returned' });
      return;
    }

    const tool = issuance.tool;
    let penaltyAmount = 0;
    if (returnCondition === 'DAMAGED' || returnCondition === 'LOST') {
      penaltyAmount = tool.replacementCost / 6;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedIssuance = await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: {
          returnedAt: new Date(),
          returnCondition,
          status: 'RETURNED',
          penaltyAmount,
          penaltyApproved: false
        }
      });

      // Only clear holder if this was an approved issuance (tool was physically given)
      if (issuance.isApproved) {
        await tx.tool.update({
          where: { id: tool.id },
          data: {
            currentHolderId: null,
            condition: returnCondition || tool.condition
          }
        });
      }

      if (returnCondition === 'DAMAGED' || returnCondition === 'LOST') {
        const ownerUsers = await tx.user.findMany({ where: { role: 'OWNER', firmId } });
        for (const owner of ownerUsers) {
          await tx.systemAlert.create({
            data: {
              type: 'WARNING',
              severity: 'WARNING',
              title: `Tool Returned as ${returnCondition}`,
              message: `Tool ${tool.name} (${tool.toolCode}) was returned as ${returnCondition} by ${req.user!.username}.`,
              targetUserId: owner.id,
              firmId
            }
          });
        }
      }

      return updatedIssuance;
    });

    res.status(200).json({ success: true, data: result, message: 'Tool returned successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/issuances/:id/verify-return
// Admin/Owner confirms physical return of a tool — after employee has marked it RETURNED.
// Accepts: { condition: 'GOOD' | 'DAMAGED' | 'MISSING', adminNote?: string }
// - GOOD     → clean record, no deduction
// - DAMAGED  → toolIncidents+1, disciplineScore -5
// - MISSING  → toolIncidents+1, disciplineScore -15, tool marked MISSING
const verifyReturnSchema = z.object({
  condition: z.enum(['GOOD', 'DAMAGED', 'MISSING']),
  adminNote: z.string().optional(),
});
router.put('/issuances/:id/verify-return', requireOwner, validateBody(verifyReturnSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const { condition, adminNote } = req.body as { condition: 'GOOD' | 'DAMAGED' | 'MISSING'; adminNote?: string };

    const issuance = await prisma.toolIssuance.findFirst({
      where: { id: parseInt(id as string, 10), firmId },
      include: { tool: true }
    });

    if (!issuance) {
      res.status(404).json({ success: false, data: null, message: 'Issuance not found' });
      return;
    }

    if (issuance.status !== 'RETURNED') {
      res.status(400).json({ success: false, data: null, message: 'Tool has not been returned by employee yet' });
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate discipline impact
    const scoreDeduction = condition === 'MISSING' ? 15 : condition === 'DAMAGED' ? 5 : 0;
    const hasIncident = condition !== 'GOOD';

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Mark issuance RETURN_VERIFIED, store admin-confirmed condition
      const updatedIssuance = await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: {
          status: 'RETURN_VERIFIED',
          returnCondition: condition,   // override with admin-verified condition
          penaltyNote: adminNote || null,
        },
        include: { tool: true, user: true }
      });

      // 2. Update tool's condition in the Tool table
      await tx.tool.update({
        where: { id: issuance.toolId },
        data: {
          condition: condition === 'MISSING' ? 'MISSING' : condition === 'DAMAGED' ? 'DAMAGED' : issuance.tool.condition,
          currentHolderId: null,  // release holder
        }
      });

      // 3. If DAMAGED or MISSING — impact employee performance for current month
      if (hasIncident) {
        // Upsert PerformanceReport for the current month
        const existing = await tx.performanceReport.findUnique({
          where: { userId_month_year: { userId: issuance.userId, month: currentMonth, year: currentYear } }
        });

        if (existing) {
          await tx.performanceReport.update({
            where: { userId_month_year: { userId: issuance.userId, month: currentMonth, year: currentYear } },
            data: {
              toolIncidents: { increment: 1 },
              disciplineScore: Math.max(0, existing.disciplineScore - scoreDeduction),
            }
          });
        } else {
          await tx.performanceReport.create({
            data: {
              userId: issuance.userId,
              month: currentMonth,
              year: currentYear,
              toolIncidents: 1,
              disciplineScore: 100 - scoreDeduction,
              firmId,
            }
          });
        }

        // 4. Notify the employee
        const conditionLabel = condition === 'MISSING' ? 'reported missing' : 'returned damaged';
        await tx.systemAlert.create({
          data: {
            type: 'TOOL_INCIDENT',
            severity: condition === 'MISSING' ? 'CRITICAL' : 'WARNING',
            title: `Tool ${conditionLabel}: ${issuance.tool.name}`,
            message: `Admin verified that ${issuance.tool.name} (${issuance.tool.toolCode}) was ${conditionLabel}. Your discipline score was reduced by ${scoreDeduction} points.${adminNote ? ' Note: ' + adminNote : ''}`,
            targetUserId: issuance.userId,
            firmId,
          }
        });
      }

      return updatedIssuance;
    });

    res.status(200).json({ success: true, data: updated, message: 'Tool return verified successfully' });
  } catch (error) {
    next(error);
  }
});


// PUT /api/tools/issuances/:id/approve-penalty

router.put('/issuances/:id/approve-penalty', requireOwner, validateBody(z.object({})), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const issuance = await prisma.toolIssuance.findFirst({
      where: { id: parseInt(id as string, 10), firmId }
    });

    if (!issuance) {
      res.status(404).json({ success: false, data: null, message: 'Issuance not found' });
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    await prisma.$transaction(async (tx) => {
      await tx.toolIssuance.update({
        where: { id: issuance.id },
        data: { penaltyApproved: true }
      });

      const report = await tx.performanceReport.findFirst({
        where: { userId: issuance.userId, month: currentMonth, year: currentYear, firmId }
      });

      if (report) {
        await tx.performanceReport.update({
          where: { id: report.id },
          data: { deductionAmount: report.deductionAmount + issuance.penaltyAmount }
        });
      } else {
        await tx.toolIssuance.update({
          where: { id: issuance.id },
          data: { penaltyNote: 'No performance report for current month; penalty not automatically deducted.' }
        });
      }
    });

    res.status(200).json({ success: true, data: null, message: 'Penalty approved' });
  } catch (error) {
    next(error);
  }
});

// ─── TOOL TRANSFER ROUTES ────────────────────────────────────────────────────────

// GET /api/tools/:id/alternatives
// Find alternative tools in the same category that are available (not held, condition GOOD)
router.get('/:id/alternatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const originalTool = await prisma.tool.findUnique({
      where: { id: parseInt(id as string, 10), firmId }
    });

    if (!originalTool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' });
      return;
    }

    const alternatives = await prisma.tool.findMany({
      where: {
        firmId,
        category: originalTool.category,
        isActive: true,
        condition: 'GOOD',
        currentHolderId: null,
        id: { not: originalTool.id }
      },
      take: 5
    });

    res.status(200).json({ success: true, data: alternatives, message: 'Alternatives fetched' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/transfers
// Initiate a peer-to-peer field transfer
const createTransferSchema = z.object({
  toolId: z.union([z.string(), z.number()]),
  toUserId: z.union([z.string(), z.number()]),
  jobCardId: z.union([z.string(), z.number()]).optional(),
});
router.post('/transfers', authenticateToken, validateBody(createTransferSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fromUserId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { toolId, toUserId, jobCardId } = req.body;

    // Verify tool is held by the sender, OR the sender is an Admin/Owner
    const tool = await prisma.tool.findFirst({
      where: { id: parseInt(toolId, 10), firmId }
    });

    if (!tool) {
      res.status(400).json({ success: false, data: null, message: 'Tool does not exist.' });
      return;
    }

    if (tool.currentHolderId !== fromUserId && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
      res.status(400).json({ success: false, data: null, message: 'You do not hold this tool.' });
      return;
    }

    if (!tool.currentHolderId) {
      res.status(400).json({ success: false, data: null, message: 'This tool is not currently held by anyone.' });
      return;
    }

    // Check if there is already a pending transfer
    const existing = await prisma.toolTransferRequest.findFirst({
      where: { toolId: tool.id, status: 'PENDING' }
    });

    if (existing) {
      res.status(400).json({ success: false, data: null, message: 'A transfer request is already pending for this tool.' });
      return;
    }

    const transfer = await prisma.toolTransferRequest.create({
      data: {
        toolId: tool.id,
        fromUserId: tool.currentHolderId,
        toUserId: parseInt(toUserId, 10),
        jobCardId: jobCardId ? parseInt(jobCardId, 10) : null,
        firmId
      }
    });

    res.status(201).json({ success: true, data: transfer, message: 'Transfer request sent.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/transfers/incoming
// Fetch pending incoming transfer requests for the logged-in user
router.get('/transfers/incoming', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const toUserId = req.user!.userId;
    const firmId = req.user!.firmId;

    const transfers = await prisma.toolTransferRequest.findMany({
      where: { toUserId, status: 'PENDING', firmId },
      include: {
        tool: true,
        fromUser: { select: { id: true, fullName: true, username: true } },
        jobCard: { select: { id: true, jobNumber: true, clientName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: transfers, message: 'Incoming transfers fetched.' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/transfers/:id/accept
// PUT /api/tools/transfers/:id/accept
// Accept a transfer request
const acceptTransferSchema = z.object({
  receivedCondition: z.string(),
  note: z.string().optional(),
});
router.put('/transfers/:id/accept', authenticateToken, validateBody(acceptTransferSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { receivedCondition, note } = req.body;
    const toUserId = req.user!.userId;
    const firmId = req.user!.firmId;

    const transfer = await prisma.toolTransferRequest.findFirst({
      where: { id: parseInt(id as string, 10), toUserId, status: 'PENDING', firmId },
      include: { tool: true }
    });

    if (!transfer) {
      res.status(404).json({ success: false, data: null, message: 'Pending transfer not found.' });
      return;
    }

    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // 1. Mark transfer as ACCEPTED
      const reqUpdated = await tx.toolTransferRequest.update({
        where: { id: transfer.id },
        data: { status: 'ACCEPTED', receivedCondition, note }
      });

      // 2. Find old issuance and close it
      const oldIssuance = await tx.toolIssuance.findFirst({
        where: { toolId: transfer.toolId, userId: transfer.fromUserId, status: 'ISSUED' }
      });

      if (oldIssuance) {
        await tx.toolIssuance.update({
          where: { id: oldIssuance.id },
          data: {
            status: 'RETURN_VERIFIED', // field transfer bypasses admin verify
            returnedAt: new Date(),
            returnCondition: receivedCondition,
          }
        });
      }

      // 3. Create new issuance for the receiver
      await tx.toolIssuance.create({
        data: {
          toolId: transfer.toolId,
          userId: toUserId,
          jobCardId: transfer.jobCardId,
          issuedCondition: receivedCondition,
          status: 'ISSUED',
          isApproved: true, // implicit approval
          firmId
        }
      });

      // 4. Update Tool holder
      await tx.tool.update({
        where: { id: transfer.toolId },
        data: { currentHolderId: toUserId, condition: receivedCondition }
      });

      return reqUpdated;
    });

    res.status(200).json({ success: true, data: updatedTransfer, message: 'Transfer accepted.' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/transfers/:id/decline
// Decline a transfer request
router.put('/transfers/:id/decline', authenticateToken, validateBody(z.object({})), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const toUserId = req.user!.userId;
    const firmId = req.user!.firmId;

    const transfer = await prisma.toolTransferRequest.findFirst({
      where: { id: parseInt(id as string, 10), toUserId, status: 'PENDING', firmId }
    });

    if (!transfer) {
      res.status(404).json({ success: false, data: null, message: 'Pending transfer not found.' });
      return;
    }

    const updated = await prisma.toolTransferRequest.update({
      where: { id: transfer.id },
      data: { status: 'DECLINED' }
    });

    res.status(200).json({ success: true, data: updated, message: 'Transfer declined.' });
  } catch (error) {
    next(error);
  }
});

export default router;
