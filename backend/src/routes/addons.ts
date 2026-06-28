import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { requireOwner } from '../middleware/roleGuard';
import { validateBody } from '../middleware/validateBody';
import { createAlert } from '../services/alertService';

const router = Router();

const respondSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  managerNote: z.string().optional()
});

/**
 * PUT /api/addons/:addonId/respond
 * Owner/Admin approves or rejects an addon request.
 */
router.put(
  '/:addonId/respond',
  requireOwner,
  validateBody(respondSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const addonId = parseInt(req.params.addonId as string, 10);
      const { status, managerNote } = req.body;
      const firmId = req.user!.firmId;

      if (isNaN(addonId)) {
        res.status(400).json({ success: false, data: null, message: 'Invalid addon ID' });
        return;
      }

      const addon = await prisma.addonRequest.findFirst({
        where: { id: addonId, requestedBy: { firmId } },
        include: {
          tools: true,
          materials: true
        }
      });

      if (!addon) {
        res.status(404).json({ success: false, data: null, message: 'Addon request not found' });
        return;
      }

      if (addon.status !== 'PENDING') {
        res.status(400).json({ success: false, data: null, message: 'Addon request is already processed' });
        return;
      }

      if (status === 'REJECTED') {
        const updated = await prisma.addonRequest.update({
          where: { id: addonId },
          data: { status: 'REJECTED', managerNote }
        });
        res.status(200).json({ success: true, data: updated, message: 'Request rejected' });
        return;
      }

      // If APPROVED
      let anyUnavailable = false;

      // Process tools
      for (const tReq of addon.tools) {
        const tool = await prisma.tool.findUnique({ where: { id: tReq.toolId } });
        if (!tool || tool.condition !== 'GOOD' || tool.currentHolderId !== null) {
          anyUnavailable = true;
          await prisma.addonRequestTool.update({
            where: { id: tReq.id },
            data: { status: 'UNAVAILABLE' }
          });
        } else {
          // Issue tool
          await prisma.tool.update({
            where: { id: tool.id },
            data: { currentHolderId: addon.requestedById }
          });
          await prisma.toolIssuance.create({
            data: {
              toolId: tool.id,
              userId: addon.requestedById,
              jobCardId: addon.jobCardId,
              issuedAt: new Date(),
              status: 'ISSUED',
              firmId
            }
          });
          await prisma.addonRequestTool.update({
            where: { id: tReq.id },
            data: { status: 'ISSUED' }
          });
        }
      }

      // Process materials (Products)
      for (const mReq of addon.materials) {
        const product = await prisma.product.findUnique({ where: { id: mReq.materialId } });
        if (!product || product.currentStock < mReq.quantityRequested) {
          anyUnavailable = true;
          await prisma.addonRequestMaterial.update({
            where: { id: mReq.id },
            data: { status: 'UNAVAILABLE' }
          });
        } else {
          // Issue material
          await prisma.product.update({
            where: { id: product.id },
            data: { currentStock: { decrement: mReq.quantityRequested } }
          });
          await prisma.materialUsageLog.create({
            data: {
              productId: product.id,
              userId: addon.requestedById,
              jobCardId: addon.jobCardId,
              quantityTaken: mReq.quantityRequested,
              isApproved: true,
              firmId
            }
          });
          await prisma.addonRequestMaterial.update({
            where: { id: mReq.id },
            data: { status: 'ISSUED' }
          });
        }
      }

      const updatedAddon = await prisma.addonRequest.update({
        where: { id: addonId },
        data: { status: 'APPROVED', managerNote }
      });

      if (anyUnavailable) {
        // Alert manager
        await createAlert({
          type: 'ADDON_UNAVAILABLE',
          severity: 'WARNING',
          title: `Addon Request Items Unavailable`,
          message: `Some tools/materials for Addon Request #${addon.id} were unavailable in stock and marked as UNAVAILABLE.`,
          relatedEntity: 'AddonRequest',
          relatedId: addon.id,
        }, firmId);
      }

      res.status(200).json({ success: true, data: updatedAddon, message: 'Addon request approved and items issued' });
    } catch (error) {
      console.error('[Addons] Error responding to request:', error);
      res.status(500).json({ success: false, data: null, message: 'Internal server error' });
    }
  }
);

export default router;
