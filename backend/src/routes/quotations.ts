import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/quotations
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const isOwner = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    const where: any = { firmId: req.user!.firmId };

    if (!isOwner) {
      where.assignedToId = req.user!.userId;
    }

    if (status) {
      where.status = String(status);
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { clientName: { contains: s } },
        { quotationNumber: { contains: s } }
      ];
    }

    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: quotations, message: 'Quotations fetched' });
  } catch (error) {
    next(error);
  }
});

// POST /api/quotations
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clientName, clientPhone, clientAddress, validityDays = 15, items, notes, assignedToId } = req.body;
    
    // Auto-generate quotationNumber: QT-YYYY-XXX
    const year = new Date().getFullYear();
    const count = await prisma.quotation.count({
      where: { firmId: req.user!.firmId, quotationNumber: { startsWith: `QT-${year}-` } }
    });
    const quotationNumber = `QT-${year}-${String(count + 1).padStart(3, '0')}`;

    let subtotal = 0;
    let taxAmount = 0;
    
    const parsedItems = Array.isArray(items) ? items : [];
    
    const processedItems = parsedItems.map((item: any) => {
      const qty = item.qty || 1;
      const unitPrice = item.unitPrice || 0;
      const taxPercent = item.taxPercent !== undefined ? item.taxPercent : 18;
      
      const itemTotal = qty * unitPrice;
      const itemTax = itemTotal * (taxPercent / 100);
      
      subtotal += itemTotal;
      taxAmount += itemTax;
      
      return {
        desc: item.desc,
        qty,
        unitPrice,
        taxPercent,
        productId: item.productId,
      };
    });
    
    const grandTotal = subtotal + taxAmount;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        clientName,
        clientPhone,
        clientAddress,
        validityDays,
        items: JSON.stringify(processedItems),
        notes,
        assignedToId,
        subtotal,
        taxAmount,
        grandTotal,
        status: 'DRAFT',
        firmId: req.user!.firmId
      }
    });

    res.status(201).json({ success: true, data: quotation, message: 'Quotation created' });
  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    const isOwner = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    if (!isOwner && quotation.assignedToId !== req.user!.userId) {
      res.status(403).json({ success: false, data: null, message: 'Forbidden' });
      return;
    }

    res.json({ success: true, data: quotation, message: 'Quotation fetched' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/quotations/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    const isOwner = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    if (!isOwner && quotation.assignedToId !== req.user!.userId) {
      res.status(403).json({ success: false, data: null, message: 'Forbidden' });
      return;
    }

    if (quotation.status === 'CONVERTED' || quotation.status === 'EXPIRED') {
      res.status(400).json({ success: false, data: null, message: 'Cannot edit CONVERTED or EXPIRED quotation' });
      return;
    }

    const { clientName, clientPhone, clientAddress, validityDays, items, notes, assignedToId } = req.body;
    
    const updateData: any = {
      clientName,
      clientPhone,
      clientAddress,
      validityDays,
      notes,
      assignedToId
    };

    if (items && Array.isArray(items)) {
      let subtotal = 0;
      let taxAmount = 0;
      const processedItems = items.map((item: any) => {
        const qty = item.qty || 1;
        const unitPrice = item.unitPrice || 0;
        const taxPercent = item.taxPercent !== undefined ? item.taxPercent : 18;
        
        const itemTotal = qty * unitPrice;
        const itemTax = itemTotal * (taxPercent / 100);
        
        subtotal += itemTotal;
        taxAmount += itemTax;
        
        return {
          desc: item.desc,
          qty,
          unitPrice,
          taxPercent,
          productId: item.productId,
        };
      });
      updateData.items = JSON.stringify(processedItems);
      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.grandTotal = subtotal + taxAmount;
    }

    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updated = await prisma.quotation.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: updated, message: 'Quotation updated' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/quotations/:id/status
router.put('/:id/status', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['SENT'],
      'SENT': ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      'ACCEPTED': ['CONVERTED'],
      'REJECTED': [],
      'EXPIRED': [],
      'CONVERTED': []
    };

    if (!validTransitions[quotation.status]?.includes(status)) {
      res.status(400).json({ success: false, data: null, message: `Invalid status transition from ${quotation.status} to ${status}` });
      return;
    }

    const updateData: any = { status };
    if (status === 'SENT') {
      updateData.sentAt = new Date();
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: updated, message: 'Quotation status updated' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/quotations/:id
router.delete('/:id', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    if (quotation.status !== 'DRAFT') {
      res.status(400).json({ success: false, data: null, message: 'Can only delete DRAFT quotations' });
      return;
    }

    await prisma.quotation.delete({ where: { id } });
    
    res.json({ success: true, data: null, message: 'Quotation deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/:id/pdf-data
router.get('/:id/pdf-data', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    const isOwner = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    if (!isOwner && quotation.assignedToId !== req.user!.userId) {
      res.status(403).json({ success: false, data: null, message: 'Forbidden' });
      return;
    }

    const firm = await prisma.firm.findUnique({ where: { id: req.user!.firmId } });

    res.json({ 
      success: true, 
      data: {
        quotation,
        firmName: firm?.name,
        firmAddress: firm?.address,
        firmPhone: firm?.phone,
        firmGstin: firm?.gstin,
        items: JSON.parse(quotation.items),
        totals: {
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          grandTotal: quotation.grandTotal
        }
      }, 
      message: 'PDF data fetched' 
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/quotations/:id/convert
router.post('/:id/convert', requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = await prisma.quotation.findUnique({ where: { id, firmId: req.user!.firmId } });
    
    if (!quotation) {
      res.status(404).json({ success: false, data: null, message: 'Not found' });
      return;
    }

    if (quotation.status !== 'ACCEPTED') {
      res.status(400).json({ success: false, data: null, message: 'Can only convert ACCEPTED quotations' });
      return;
    }

    const items = JSON.parse(quotation.items);
    let firstSaleId: number | null = null;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const quantity = item.qty || 1;
            const unitPrice = item.unitPrice || 0;
            const totalAmount = quantity * unitPrice;
            const marginAmount = totalAmount - (product.purchasePrice * quantity);
            const marginPercent = (marginAmount / (product.purchasePrice * quantity)) * 100 || 0;

            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: { decrement: quantity } }
            });
            
            const sale = await tx.sale.create({
              data: {
                productId: product.id,
                userId: req.user!.userId,
                quantity,
                unitPrice,
                totalAmount,
                purchasePriceSnapshot: product.purchasePrice,
                marginAmount,
                marginPercent,
                clientId: null,
                notes: `Converted from Quotation ${quotation.quotationNumber}`,
                firmId: req.user!.firmId
              }
            });

            if (!firstSaleId) {
              firstSaleId = sale.id;
            }
          }
        }
      }

      await tx.quotation.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedInvoiceId: firstSaleId
        }
      });
    });

    const updated = await prisma.quotation.findUnique({ where: { id } });

    res.json({ success: true, data: updated, message: 'Quotation converted to sales' });
  } catch (error) {
    next(error);
  }
});

export default router;
