import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticateToken);

/**
 * POST /api/sync
 * Processes an array of queued offline actions in chronological order.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    
    // Support both single item and batched array (mobile currently sends single, but requirement asks for array processing)
    const actions = Array.isArray(req.body) ? req.body : (req.body.actions ? req.body.actions : [req.body]);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Sort by clientTimestamp if available to ensure chronological order
    actions.sort((a: any, b: any) => {
      const timeA = new Date(a.clientTimestamp || 0).getTime();
      const timeB = new Date(b.clientTimestamp || 0).getTime();
      return timeA - timeB;
    });

    // Process each action independently to ensure one failure doesn't roll back the others
    for (const action of actions) {
      try {
        const { entity, action: mutationType, payload } = action;

        await prisma.$transaction(async (tx) => {
          if (entity === 'sale' || entity === 'product') {
            const { productId, quantity, unitPrice, totalAmount, clientId, notes } = payload;
            
            const product = await tx.product.findUnique({ where: { id: productId } });
            if (!product) throw new Error(`Product ${productId} not found`);

            const marginAmount = totalAmount - (product.purchasePrice * quantity);
            const marginPercent = (marginAmount / totalAmount) * 100;

            await tx.sale.create({
              data: {
                productId,
                userId,
                quantity,
                unitPrice,
                totalAmount,
                purchasePriceSnapshot: product.purchasePrice,
                marginAmount,
                marginPercent,
                clientId: clientId || null,
                notes,
                firmId
              }
            });

            // Update stock
            await tx.product.update({
              where: { id: productId },
              data: { currentStock: product.currentStock - quantity }
            });
            
          } else if (entity === 'jobcard' || entity === 'jobcard_status' || entity === 'job') {
            const { id: jobId, status, arrivedLat, arrivedLng, workSummary, issuesFound, nextVisitNeeded } = payload;
            
            if (!jobId) throw new Error('Job ID missing');

            const updateData: any = { status };
            if (status === 'IN_PROGRESS' && arrivedLat && arrivedLng) {
              updateData.arrivedAt = new Date();
              updateData.arrivedLat = arrivedLat;
              updateData.arrivedLng = arrivedLng;
            } else if (status === 'COMPLETED') {
              updateData.completedAt = new Date();
              if (workSummary) updateData.workSummary = workSummary;
              if (issuesFound) updateData.issuesFound = issuesFound;
              if (nextVisitNeeded !== undefined) updateData.nextVisitNeeded = nextVisitNeeded;
            }

            await tx.jobCard.update({
              where: { id: jobId },
              data: updateData
            });

            // If arrived, create site visit
            if (status === 'IN_PROGRESS') {
              await tx.siteVisit.create({
                data: {
                  jobCardId: jobId,
                  userId,
                  arrivedAt: new Date(),
                  arrivedLat,
                  arrivedLng
                }
              });
            } else if (status === 'COMPLETED') {
              // Complete site visit
              const latestVisit = await tx.siteVisit.findFirst({
                where: { jobCardId: jobId, userId },
                orderBy: { arrivedAt: 'desc' }
              });
              if (latestVisit && !latestVisit.departedAt) {
                await tx.siteVisit.update({
                  where: { id: latestVisit.id },
                  data: { departedAt: new Date(), notes: workSummary }
                });
              }
            }
            
          } else if (entity === 'attendance' || entity === 'attendance_checkin') {
             const { latitude, longitude, photo } = payload;
             
             // Check if already checked in
             const today = new Date();
             const dateStringIST = today.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
             const [mm, dd, yyyy] = dateStringIST.split('/');
             const todayNormalized = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 0, 0, 0, 0));

             const existing = await tx.attendance.findUnique({
               where: { userId_date: { userId, date: todayNormalized } }
             });

             if (!existing) {
               await tx.attendance.create({
                 data: {
                   userId,
                   date: todayNormalized,
                   checkInTime: new Date(),
                   checkInLat: latitude || null,
                   checkInLng: longitude || null,
                   checkInPhoto: null, // Note: offline photo payload would need special handling if base64
                   status: 'PRESENT',
                   firmId
                 }
               });
             }
          }
        });
        
        results.processed++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Action ${action.entity} failed: ${err.message}`);
      }
    }

    const response: ApiResponse<typeof results> = {
      success: results.failed === 0,
      data: results,
      message: `Sync complete: ${results.processed} processed, ${results.failed} failed`,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: 'Sync failed: ' + error.message,
    };
    res.status(500).json(response);
  }
});

export default router;
