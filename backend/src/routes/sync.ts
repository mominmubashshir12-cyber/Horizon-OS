import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticateToken);

const syncActionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  entity: z.string(),
  action: z.string(),
  payload: z.any(),
  clientTimestamp: z.union([z.string(), z.number()]).optional()
});

const syncSchema = z.union([
  z.array(syncActionSchema),
  z.object({ actions: z.array(syncActionSchema) }),
  syncActionSchema
]);

router.post('/', validateBody(syncSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const firmId = req.user!.firmId;
    
    const actions = Array.isArray(req.body) ? req.body : (req.body.actions ? req.body.actions : [req.body]);

    const results = {
      accepted: [] as any[],
      rejected: [] as any[],
      errors: [] as string[]
    };

    actions.sort((a: any, b: any) => {
      const timeA = new Date(a.clientTimestamp || 0).getTime();
      const timeB = new Date(b.clientTimestamp || 0).getTime();
      return timeA - timeB;
    });

    for (const action of actions) {
      try {
        const { id: actionId, entity, action: mutationType, payload, clientTimestamp } = action;
        const clientDate = clientTimestamp ? new Date(clientTimestamp) : new Date();

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

            await tx.product.update({
              where: { id: productId },
              data: { currentStock: product.currentStock - quantity }
            });
            
            if (actionId) results.accepted.push(actionId);

          } else if (entity === 'jobcard' || entity === 'jobcard_status' || entity === 'job') {
            const { id: jobId, status, arrivedLat, arrivedLng, workSummary, issuesFound, nextVisitNeeded } = payload;
            
            if (!jobId) throw new Error('Job ID missing');

            const serverRecord = await tx.jobCard.findUnique({ where: { id: jobId } });
            if (!serverRecord) throw new Error(`JobCard ${jobId} not found`);

            // Conflict check
            if (serverRecord.updatedAt > clientDate) {
              if (actionId) results.rejected.push({ id: actionId, serverRecord });
              return; // skip update
            }

            const updateData: any = { status, clientUpdatedAt: clientDate };
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

            if (status === 'IN_PROGRESS') {
              await tx.siteVisit.create({
                data: {
                  jobCardId: jobId,
                  userId,
                  arrivedAt: new Date(),
                  arrivedLat,
                  arrivedLng,
                  clientUpdatedAt: clientDate
                }
              });
            } else if (status === 'COMPLETED') {
              const latestVisit = await tx.siteVisit.findFirst({
                where: { jobCardId: jobId, userId },
                orderBy: { arrivedAt: 'desc' }
              });
              if (latestVisit && !latestVisit.departedAt) {
                // Check if site visit is newer on server? Not strictly needed for completion, but good practice.
                await tx.siteVisit.update({
                  where: { id: latestVisit.id },
                  data: { departedAt: new Date(), notes: workSummary, clientUpdatedAt: clientDate }
                });
              }
            }
            
            if (actionId) results.accepted.push(actionId);

          } else if (entity === 'attendance' || entity === 'attendance_checkin') {
             const { latitude, longitude, photo } = payload;
             
             const today = new Date();
             const dateStringIST = today.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
             const [mm, dd, yyyy] = dateStringIST.split('/');
             const todayNormalized = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 0, 0, 0, 0));

             const existing = await tx.attendance.findUnique({
               where: { userId_date: { userId, date: todayNormalized } }
             });

             if (existing && existing.updatedAt > clientDate) {
                if (actionId) results.rejected.push({ id: actionId, serverRecord: existing });
                return;
             }

             if (!existing) {
               await tx.attendance.create({
                 data: {
                   userId,
                   date: todayNormalized,
                   checkInTime: new Date(),
                   checkInLat: latitude || null,
                   checkInLng: longitude || null,
                   status: 'PRESENT',
                   firmId,
                   clientUpdatedAt: clientDate
                 }
               });
             } else {
               // Update logic if needed
               await tx.attendance.update({
                 where: { id: existing.id },
                 data: { clientUpdatedAt: clientDate }
               });
             }
             if (actionId) results.accepted.push(actionId);
          } else {
            // Unhandled entity
            if (actionId) results.accepted.push(actionId);
          }
        });
        
      } catch (err: any) {
        if (action.id) {
          results.errors.push(`Action ${action.id} failed: ${err.message}`);
        } else {
          results.errors.push(`Action ${action.entity} failed: ${err.message}`);
        }
      }
    }

    res.status(200).json(results);
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ accepted: [], rejected: [], errors: ['Sync failed: ' + error.message] });
  }
});

export default router;
