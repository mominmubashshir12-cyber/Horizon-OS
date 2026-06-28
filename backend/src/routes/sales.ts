import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { checkSaleForFraud } from '../services/antifraudService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/sales
router.get('/', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, productId, startDate, endDate } = req.query;
    const where: any = { firmId: req.user!.firmId };

    if (userId) where.userId = parseInt(String(userId), 10);
    if (productId) where.productId = parseInt(String(productId), 10);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }
    
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          product: { select: { name: true } },
          user: { select: { fullName: true } },
          totalAmount: true,
          marginAmount: true,
          marginPercent: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sale.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: { data: sales, total, page, limit, totalPages },
      message: 'Sales fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/my-sales
router.get('/my-sales', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const where: any = { firmId: req.user!.firmId, userId: req.user!.userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }
    
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          product: { select: { name: true } },
          user: { select: { fullName: true } },
          totalAmount: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sale.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: { data: sales, total, page, limit, totalPages },
      message: 'My sales fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/stats
router.get('/stats', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { month, year } = req.query;
    const where: any = { firmId: req.user!.firmId };

    if (month && year) {
      const m = parseInt(String(month), 10) - 1;
      const y = parseInt(String(year), 10);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { product: true, user: true }
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
    const totalMargin = sales.reduce((sum: number, s: any) => sum + s.marginAmount, 0);
    const averageMarginPercent = totalSales > 0 ? sales.reduce((sum: number, s: any) => sum + s.marginPercent, 0) / totalSales : 0;

    const productCounts: Record<number, { name: string, count: number }> = {};
    const userCounts: Record<number, { fullName: string, count: number }> = {};
    const salesByDayMap: Record<string, number> = {};

    sales.forEach((s: any) => {
      if (!productCounts[s.productId]) productCounts[s.productId] = { name: s.product.name, count: 0 };
      productCounts[s.productId].count += s.quantity;
      
      if (!userCounts[s.userId]) userCounts[s.userId] = { fullName: s.user.fullName, count: 0 };
      userCounts[s.userId].count += 1;

      const dateStr = s.createdAt.toISOString().split('T')[0];
      salesByDayMap[dateStr] = (salesByDayMap[dateStr] || 0) + s.totalAmount;
    });

    let topSellingProduct = null;
    let maxProductCount = 0;
    for (const pid in productCounts) {
      if (productCounts[pid].count > maxProductCount) {
        maxProductCount = productCounts[pid].count;
        topSellingProduct = productCounts[pid];
      }
    }

    let topEmployee = null;
    let maxUserCount = 0;
    for (const uid in userCounts) {
      if (userCounts[uid].count > maxUserCount) {
        maxUserCount = userCounts[uid].count;
        topEmployee = userCounts[uid];
      }
    }

    const salesByDay = Object.keys(salesByDayMap).map(date => ({
      date,
      amount: salesByDayMap[date]
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        totalSales,
        totalRevenue,
        totalMargin,
        averageMarginPercent,
        topSellingProduct,
        topEmployee,
        salesByDay
      },
      message: 'Sales stats fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/:id
router.get('/:id', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const sale = await prisma.sale.findUnique({
      where: { id, firmId: req.user!.firmId },
      include: { product: true, user: true }
    });

    if (!sale) {
      return res.status(404).json({ success: false, data: null, message: 'Sale not found' });
    }

    res.json({ success: true, data: sale, message: 'Sale fetched successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales
const saleSchema = z.object({
  productId: z.number(),
  quantity: z.number(),
  unitPrice: z.number(),
  clientId: z.number().optional(),
  notes: z.string().optional()
});

router.post('/', authenticateToken, validateBody(saleSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { productId, quantity, unitPrice, clientId, notes } = req.body;
    
    // Check product
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({ success: false, data: null, message: 'Product not found' });
    }
    
    // Anti-fraud checks are deferred until after successful creation
    
    // Process sale
    const totalAmount = quantity * unitPrice;
    const marginAmount = totalAmount - (product.purchasePrice * quantity);
    const marginPercent = (marginAmount / (product.purchasePrice * quantity)) * 100 || 0;
    
    // Transaction to ensure atomicity
    const sale = await prisma.$transaction(async (tx) => {
      // Deduct stock
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: { decrement: quantity } }
      });
      
      // Create sale
      return await tx.sale.create({
        data: {
          productId,
          userId: req.user!.userId,
          quantity,
          unitPrice,
          totalAmount,
          purchasePriceSnapshot: product.purchasePrice,
          marginAmount,
          marginPercent,
          clientId,
          notes,
          firmId: req.user!.firmId
        },
        include: { product: true }
      });
    });
    
    res.status(201).json({
      success: true,
      data: sale,
      message: 'Sale recorded successfully'
    });

    // Call anti-fraud service asynchronously
    checkSaleForFraud(req.user!.userId, product.id, unitPrice, req.user!.firmId).catch(console.error);
  } catch (error) {
    next(error);
  }
});

export default router;
