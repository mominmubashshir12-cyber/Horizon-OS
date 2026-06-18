import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

// GET /api/materials
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { category, lowStock } = req.query;
    const firmId = req.user!.firmId;

    const where: any = { firmId };
    if (category) where.category = category as string;

    let materials = await prisma.consumableMaterial.findMany({ where });

    if (lowStock === 'true') {
      materials = materials.filter(m => m.currentStock <= m.reorderLevel);
    }

    res.status(200).json({ success: true, data: materials, message: 'Materials retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/materials
router.post('/', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, unit, currentStock, reorderLevel, purchasePrice, category, shelfLocation } = req.body;
    const firmId = req.user!.firmId;

    const count = await prisma.consumableMaterial.count({ where: { firmId } });
    const materialCode = `MAT-${(count + 1).toString().padStart(3, '0')}`;

    const newMaterial = await prisma.consumableMaterial.create({
      data: {
        name,
        materialCode,
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

    const usages = await prisma.materialUsageLog.findMany({
      where: { userId, completedAt: null, firmId }
    });

    res.status(200).json({ success: true, data: usages, message: 'Active usages retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;

    const material = await prisma.consumableMaterial.findFirst({
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
router.put('/:id', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    const { currentStock, ...updates } = req.body;

    const material = await prisma.consumableMaterial.findFirst({ where: { id: parseInt(id as string, 10), firmId } });
    if (!material) {
      res.status(404).json({ success: false, data: null, message: 'Material not found' });
      return;
    }

    const updatedMaterial = await prisma.$transaction(async (tx) => {
      const updated = await tx.consumableMaterial.update({
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
            entity: 'ConsumableMaterial',
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
router.post('/usage/take', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { materialId, jobCardId, quantityTaken } = req.body;

    const qty = Number(quantityTaken);

    const material = await prisma.consumableMaterial.findFirst({ where: { id: parseInt(materialId as string, 10), firmId } });
    if (!material) {
      res.status(404).json({ success: false, data: null, message: 'Material not found' });
      return;
    }

    if (qty > material.currentStock) {
      res.status(400).json({ success: false, data: null, message: 'Quantity taken exceeds current stock' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedMaterial = await tx.consumableMaterial.update({
        where: { id: material.id },
        data: { currentStock: { decrement: qty } }
      });

      const usageLog = await tx.materialUsageLog.create({
        data: {
          materialId: material.id,
          userId,
          jobCardId,
          quantityTaken: qty,
          firmId
        }
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

      return usageLog;
    });

    res.status(200).json({ success: true, data: result, message: 'Material taken successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/usage/:id/complete
router.put('/usage/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    const { quantityUsed, quantityReturned, notes } = req.body;

    const used = Number(quantityUsed);
    const returned = Number(quantityReturned);

    const usageLog = await prisma.materialUsageLog.findFirst({
      where: { id: parseInt(id as string, 10), userId, firmId, completedAt: null },
      include: { material: true }
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
        await tx.consumableMaterial.update({
          where: { id: usageLog.materialId },
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
              message: `User ${req.user!.username} reported excessive usage for material ${usageLog.material.name}.`,
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

export default router;
