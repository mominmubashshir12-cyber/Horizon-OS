import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /api/settings
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.firmSettings.findUnique({
      where: { id: 1 }
    });

    if (!settings) {
      settings = await prisma.firmSettings.create({
        data: { id: 1 }
      });
    }

    res.status(200).json({ success: true, data: settings, message: 'Settings retrieved successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings
const settingsSchema = z.object({
  firmName: z.string().optional(),
  firmAddress: z.string().optional(),
  firmGstin: z.string().optional(),
  firmPhone: z.string().optional(),
  standardCheckInTime: z.string().optional(),
  autoCheckoutTime: z.string().optional(),
  maxLunchDurationMins: z.union([z.string(), z.number()]).optional(),
  workingDaysPerMonth: z.union([z.string(), z.number()]).optional(),
  overtimeMultiplier: z.union([z.string(), z.number()]).optional(),
  absentPenaltyRate: z.union([z.string(), z.number()]).optional(),
  globalLowStockThreshold: z.union([z.string(), z.number()]).optional()
});

router.put('/', authenticateToken, validateBody(settingsSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Only owners/admins should update settings
    const role = req.user!.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      res.status(403).json({ success: false, data: null, message: 'Only owners/admins can update settings' } as any);
      return;
    }

    const {
      firmName, firmAddress, firmGstin, firmPhone,
      standardCheckInTime, autoCheckoutTime, maxLunchDurationMins,
      workingDaysPerMonth, overtimeMultiplier, absentPenaltyRate,
      globalLowStockThreshold
    } = req.body;

    const settings = await prisma.firmSettings.upsert({
      where: { id: 1 },
      update: {
        firmName,
        firmAddress,
        firmGstin,
        firmPhone,
        standardCheckInTime,
        autoCheckoutTime,
        maxLunchDurationMins: maxLunchDurationMins ? parseInt(maxLunchDurationMins) : undefined,
        workingDaysPerMonth: workingDaysPerMonth ? parseInt(workingDaysPerMonth) : undefined,
        overtimeMultiplier: overtimeMultiplier ? parseFloat(overtimeMultiplier) : undefined,
        absentPenaltyRate: absentPenaltyRate ? parseFloat(absentPenaltyRate) : undefined,
        globalLowStockThreshold: globalLowStockThreshold ? parseInt(globalLowStockThreshold) : undefined,
      },
      create: {
        id: 1,
        firmName,
        firmAddress,
        firmGstin,
        firmPhone,
        standardCheckInTime,
        autoCheckoutTime,
        maxLunchDurationMins: maxLunchDurationMins ? parseInt(maxLunchDurationMins) : undefined,
        workingDaysPerMonth: workingDaysPerMonth ? parseInt(workingDaysPerMonth) : undefined,
        overtimeMultiplier: overtimeMultiplier ? parseFloat(overtimeMultiplier) : undefined,
        absentPenaltyRate: absentPenaltyRate ? parseFloat(absentPenaltyRate) : undefined,
        globalLowStockThreshold: globalLowStockThreshold ? parseInt(globalLowStockThreshold) : undefined,
      }
    });

    res.status(200).json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
