import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';

const router = Router();

const createMaterialSchema = z.object({
  name: z.string(),
  unit: z.string(),
  currentStock: z.union([z.number(), z.string()]).optional(),
  reorderLevel: z.union([z.number(), z.string()]).optional(),
  purchasePrice: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional().nullable(),
  shelfLocation: z.string().optional().nullable()
});

const updateMaterialSchema = z.object({
  name: z.string().optional(),
  unit: z.string().optional(),
  currentStock: z.union([z.number(), z.string()]).optional(),
  reorderLevel: z.union([z.number(), z.string()]).optional(),
  purchasePrice: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional().nullable(),
  shelfLocation: z.string().optional().nullable(),
  sku: z.string().optional(),
});

const takeMaterialUsageSchema = z.object({
  productId: z.union([z.number(), z.string()]),
  jobCardId: z.union([z.number(), z.string()]).optional().nullable(),
  quantityTaken: z.union([z.number(), z.string()])
});

const completeMaterialUsageSchema = z.object({
  quantityUsed: z.union([z.number(), z.string()]),
  quantityReturned: z.union([z.number(), z.string()]),
  notes: z.string().optional().nullable()
});

router.use(authenticateToken);

// GET /api/materials
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { category, lowStock } = req.query;
    const firmId = req.user!.firmId;

    const where: any = { firmId };
    if (category) where.category = category as string;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    let materials = [];
    let total = 0;

    if (lowStock === 'true') {
      const allMaterials = await prisma.product.findMany({ where });
      const filtered = allMaterials.filter(m => m.currentStock <= m.reorderLevel);
      total = filtered.length;
      materials = filtered.slice(skip, skip + limit);
    } else {
      [materials, total] = await Promise.all([
        prisma.product.findMany({ where, skip, take: limit }),
        prisma.product.count({ where })
      ]);
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({ success: true, data: { data: materials, total, page, limit, totalPages }, message: 'Materials retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/materials
router.post('/', requireOwner, validateBody(createMaterialSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, unit, currentStock, reorderLevel, purchasePrice, category, shelfLocation } = req.body;
    const firmId = req.user!.firmId;

    const count = await prisma.product.count({ where: { firmId } });
    const sku = `MAT-${(count + 1).toString().padStart(3, '0')}`;

    const newMaterial = await prisma.product.create({
      data: {
        name,
        sku,
        unit,
        currentStock: currentStock ? Number(currentStock) : 0,
        reorderLevel: reorderLevel ? Number(reorderLevel) : 0,
        purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
        category,
        shelfLocation,
        firmId
      }
    });

    res.status(201).json({ success: true, data: newMaterial, message: 'Material created successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/usage/my-active
router.get('/usage/my-active', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { jobCardId } = req.query;

    const where: any = { userId, completedAt: null, firmId };
    if (jobCardId) where.jobCardId = parseInt(jobCardId as string, 10);

    const usages = await prisma.materialUsageLog.findMany({
      where,
      include: { product: { select: { id: true, name: true, unit: true } } },
    });

    res.status(200).json({ success: true, data: usages, message: 'Active usages retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/usage/for-job/:jobCardId
// Returns all material usage logs (pending + approved) for a job, with user info.
router.get('/usage/for-job/:jobCardId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const firmId = req.user!.firmId;
    const jobCardId = parseInt(req.params.jobCardId as string, 10);

    const usages = await prisma.materialUsageLog.findMany({
      where: { jobCardId, firmId },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    res.status(200).json({ success: true, data: usages, message: 'Job material usages retrieved' });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const material = await prisma.product.findFirst({
      where: { id: parseInt(id as string, 10), firmId },
      include: {
        usageLogs: {
          take: 20,
          orderBy: { takenAt: 'desc' },
          include: { user: { select: { fullName: true } } }
        }
      }
    });

    if (!material) {
      res.status(404).json({ success: false, data: null, message: 'Material not found' });
      return;
    }

    res.status(200).json({ success: true, data: material, message: 'Material retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/:id
router.put('/:id', requireOwner, validateBody(updateMaterialSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const { currentStock, ...updates } = req.body;

    const material = await prisma.product.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!material) {
      res.status(404).json({ success: false, data: null, message: 'Material not found' });
      return;
    }

    const updatedMaterial = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: material.id },
        data: {
          ...updates,
          ...(currentStock !== undefined && { currentStock: Number(currentStock) })
        }
      });

      if (currentStock !== undefined && Number(currentStock) !== material.currentStock) {
        await tx.syncLog.create({
          data: {
            deviceId: 'SERVER',
            userId: req.user!.userId,
            direction: 'UPLOAD',
            entity: 'Product',
            entityId: material.id,
            action: 'STOCK_UPDATE',
            payload: JSON.stringify({ oldStock: material.currentStock, newStock: currentStock }),
            status: 'COMPLETED',
            syncedAt: new Date()
          }
        });
      }
      return updated;
    });

    res.status(200).json({ success: true, data: updatedMaterial, message: 'Material updated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/materials/usage/take
router.post('/usage/take', validateBody(takeMaterialUsageSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const role = req.user!.role;
    const { productId, jobCardId, quantityTaken } = req.body;

    const qty = Number(quantityTaken);

    const material = await prisma.product.findFirst({ where: { id: parseInt(productId as string, 10), firmId } });
    if (!material) {
      res.status(404).json({ success: false, data: null, message: 'Material not found' } as any);
      return;
    }

    if (qty > material.currentStock) {
      res.status(400).json({ success: false, data: null, message: 'Quantity taken exceeds current stock' } as any);
      return;
    }

    // Check if there is already a pending usage log for this material on this job
    if (jobCardId) {
      const pendingUsage = await prisma.materialUsageLog.findFirst({
        where: { productId: material.id, isApproved: false, jobCardId: parseInt(jobCardId, 10) }
      });
      if (pendingUsage) {
        res.status(400).json({ success: false, data: null, message: 'Material has a pending request for this job' } as any);
        return;
      }
    }

    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';

    const result = await prisma.$transaction(async (tx) => {
      let updatedMaterial = material;
      if (isOwnerAdmin) {
        updatedMaterial = await tx.product.update({
          where: { id: material.id },
          data: { currentStock: { decrement: qty } }
        });
      }

      const usageLog = await tx.materialUsageLog.create({
        data: {
          productId: material.id,
          userId,
          jobCardId: jobCardId ? parseInt(jobCardId, 10) : null,
          quantityTaken: qty,
          isApproved: isOwnerAdmin,
          firmId
        }
      });

      if (!isOwnerAdmin) {
        await tx.systemAlert.create({
          data: {
            type: 'INFO',
            title: 'Material Request Pending',
            message: `An employee requested ${qty} ${material.unit} of ${material.name} for Job ID: ${jobCardId || 'N/A'}.`,
            targetUserId: null,
            firmId
          }
        });
      }

      if (isOwnerAdmin && updatedMaterial.currentStock <= updatedMaterial.reorderLevel) {
        const owners = await tx.user.findMany({ where: { role: 'OWNER', firmId } });
        for (const owner of owners) {
          await tx.systemAlert.create({
            data: {
              type: 'LOW_STOCK',
              severity: 'WARNING',
              title: 'Low Stock Alert',
              message: `Material ${updatedMaterial.name} is low on stock (${updatedMaterial.currentStock} remaining).`,
              targetUserId: owner.id,
              firmId
            }
          });
        }
      }

      return usageLog;
    });

    res.status(200).json({ success: true, data: result, message: isOwnerAdmin ? 'Material taken successfully' : 'Material requested. Pending admin approval.' } as any);
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/usage/:id/approve
router.put('/usage/:id/approve', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const usageLog = await prisma.materialUsageLog.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!usageLog || usageLog.isApproved) {
      res.status(400).json({ success: false, data: null, message: 'Usage log not found or already approved' } as any);
      return;
    }

    const material = await prisma.product.findFirst({ where: { id: usageLog.productId } });
    if (material && usageLog.quantityTaken > material.currentStock) {
      res.status(400).json({ success: false, data: null, message: 'Insufficient stock to approve this request' } as any);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedMaterial = await tx.product.update({
        where: { id: usageLog.productId },
        data: { currentStock: { decrement: usageLog.quantityTaken } }
      });

      const updated = await tx.materialUsageLog.update({
        where: { id: usageLog.id },
        data: { isApproved: true },
        include: { product: true }
      });

      if (updatedMaterial.currentStock <= updatedMaterial.reorderLevel) {
        const owners = await tx.user.findMany({ where: { role: 'OWNER', firmId } });
        for (const owner of owners) {
          await tx.systemAlert.create({
            data: {
              type: 'LOW_STOCK',
              severity: 'WARNING',
              title: 'Low Stock Alert',
              message: `Material ${updatedMaterial.name} is low on stock (${updatedMaterial.currentStock} remaining).`,
              targetUserId: owner.id,
              firmId
            }
          });
        }
      }

      await tx.systemAlert.create({
        data: {
          type: 'INFO',
          title: 'Material Request Approved',
          message: `Your request for material ${updatedMaterial.name} has been approved.`,
          targetUserId: usageLog.userId,
          firmId
        }
      });

      return updated;
    });

    res.status(200).json({ success: true, data: result, message: 'Material request approved' } as any);
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/usage/:id/complete
router.put('/usage/:id/complete', validateBody(completeMaterialUsageSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { quantityUsed, quantityReturned, notes } = req.body;

    const used = Number(quantityUsed);
    const returned = Number(quantityReturned);

    const usageLog = await prisma.materialUsageLog.findFirst({
      where: { id: parseInt(id as string, 10), userId, firmId, completedAt: null },
      include: { product: true }
    });

    if (!usageLog) {
      res.status(404).json({ success: false, data: null, message: 'Active usage log not found' });
      return;
    }

    if (used + returned !== usageLog.quantityTaken) {
      res.status(400).json({ success: false, data: null, message: 'Used + Returned quantities must equal Taken quantity' });
      return;
    }

    const overuseFlag = used > usageLog.quantityTaken * 1.2;

    const result = await prisma.$transaction(async (tx) => {
      if (returned > 0) {
        await tx.product.update({
          where: { id: usageLog.productId },
          data: { currentStock: { increment: returned } }
        });
      }

      const updatedLog = await tx.materialUsageLog.update({
        where: { id: usageLog.id },
        data: {
          quantityUsed: used,
          quantityReturned: returned,
          notes,
          completedAt: new Date(),
          overuseFlag
        }
      });

      if (overuseFlag) {
        const owners = await tx.user.findMany({ where: { role: 'OWNER', firmId } });
        for (const owner of owners) {
          await tx.systemAlert.create({
            data: {
              type: 'MATERIAL_OVERUSE',
              severity: 'WARNING',
              title: 'Material Overuse Alert',
              message: `User ${req.user!.username} reported excessive usage for material ${usageLog.product.name}.`,
              targetUserId: owner.id,
              firmId
            }
          });
        }
      }

      return updatedLog;
    });

    res.status(200).json({ success: true, data: result, message: 'Usage log completed successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/usage/:id/review
// Admin/Owner reviews a completed material usage log — confirms the quantities used and returned.
// Sets ownerReviewed = true, which is required before a job can be VERIFIED.
router.put('/usage/:id/review', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const usageLog = await prisma.materialUsageLog.findFirst({
      where: { id: parseInt(id as string, 10), firmId },
      include: { product: true }
    });

    if (!usageLog) {
      res.status(404).json({ success: false, data: null, message: 'Usage log not found' });
      return;
    }

    if (!usageLog.completedAt) {
      res.status(400).json({ success: false, data: null, message: 'Material log has not been completed by the employee yet' });
      return;
    }

    if (usageLog.ownerReviewed) {
      res.status(400).json({ success: false, data: null, message: 'Material log has already been reviewed' });
      return;
    }

    const updated = await prisma.materialUsageLog.update({
      where: { id: usageLog.id },
      data: { ownerReviewed: true },
      include: { product: true }
    });

    res.status(200).json({ success: true, data: updated, message: 'Material usage reviewed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
