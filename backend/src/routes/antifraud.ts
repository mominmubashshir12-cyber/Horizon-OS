import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

// GET /api/antifraud
router.get('/', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const flags = await prisma.antifraudFlag.findMany({
      where: { firmId: req.user!.firmId },
      include: { user: true, product: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: flags,
      message: 'Flags fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/antifraud/:id/review
router.put('/:id/review', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { reviewNotes } = req.body;
    
    const flag = await prisma.antifraudFlag.update({
      where: { id },
      data: {
        reviewed: true,
        reviewedById: req.user!.userId,
        reviewedAt: new Date(),
        reviewNotes
      }
    });
    
    res.json({
      success: true,
      data: flag,
      message: 'Flag reviewed successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
