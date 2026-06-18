import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest, ApiResponse } from '../types';
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

    const tools = await prisma.tool.findMany({
      where,
      include: {
        currentHolder: {
          select: { fullName: true }
        }
      }
    });

    res.status(200).json({ success: true, data: tools, message: 'Tools retrieved successfully' });
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

    res.status(200).json({ success: true, data: tools, message: 'My tools retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools
router.post('/', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, category, condition, purchasePrice, replacementCost, photoUrl, notes } = req.body;
    const firmId = req.user!.firmId;

    // Auto-generate toolCode TL-XXX
    const toolsCount = await prisma.tool.count({ where: { firmId } });
    const nextNum = toolsCount + 1;
    const toolCode = `TL-${nextNum.toString().padStart(3, '0')}`;

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
router.put('/:id', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// POST /api/tools/:id/issue
router.post('/:id/issue', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const { userId, jobCardId, issuedCondition } = req.body;

    const tool = await prisma.tool.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!tool) {
      res.status(404).json({ success: false, data: null, message: 'Tool not found' });
      return;
    }

    if (tool.currentHolderId !== null) {
      res.status(400).json({ success: false, data: null, message: 'Tool is already issued' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedTool = await tx.tool.update({
        where: { id: tool.id },
        data: { currentHolderId: userId }
      });

      const issuance = await tx.toolIssuance.create({
        data: {
          toolId: tool.id,
          userId,
          jobCardId,
          issuedCondition: issuedCondition || 'GOOD',
          status: 'ISSUED',
          firmId
        }
      });

      await tx.systemAlert.create({
        data: {
          type: 'INFO',
          title: 'Tool Issued',
          message: `You have been issued a tool: ${tool.name} (${tool.toolCode})`,
          targetUserId: userId,
          firmId
        }
      });

      return { updatedTool, issuance };
    });

    res.status(200).json({ success: true, data: result, message: 'Tool issued successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/return
router.post('/:id/return', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// PUT /api/tools/issuances/:id/approve-penalty
router.put('/issuances/:id/approve-penalty', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export default router;
