import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { ApiResponse, AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

// GET /api/products
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { firmId: req.user!.firmId },
      orderBy: { name: 'asc' }
    });
    const response: ApiResponse<typeof products> = {
      success: true,
      data: products,
      message: 'Products fetched successfully'
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/products
router.post('/', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = req.body;
    const product = await prisma.product.create({
      data: {
        ...data,
        firmId: req.user!.firmId
      }
    });
    const response: ApiResponse<typeof product> = {
      success: true,
      data: product,
      message: 'Product created successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/lookup
router.get('/lookup', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { search, category, inStock } = req.query;
    const where: any = { firmId: req.user!.firmId };

    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { sku: { contains: String(search) } }
      ];
    }
    if (category) {
      where.category = String(category);
    }
    if (inStock === 'true') {
      where.currentStock = { gt: 0 };
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        minSellingPrice: true,
        maxSellingPrice: true,
        customerPrice: true,
        currentStock: true,
        unit: true,
        shelfLocation: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: products,
      message: 'Products lookup fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/categories
router.get('/categories', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { firmId: req.user!.firmId },
      select: { category: true },
      distinct: ['category']
    });
    const categories = products.map((p: any) => p.category).filter((c: any) => c);

    res.json({
      success: true,
      data: categories,
      message: 'Categories fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/low-stock
router.get('/low-stock', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { firmId: req.user!.firmId }
    });
    const lowStockProducts = products.filter((p: any) => p.currentStock <= p.reorderLevel);

    res.json({
      success: true,
      data: lowStockProducts,
      message: 'Low stock products fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stats
router.get('/stats', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { firmId: req.user!.firmId }
    });
    const totalProducts = products.length;
    const totalStockValue = products.reduce((sum: number, p: any) => sum + (p.currentStock * p.purchasePrice), 0);
    const lowStockCount = products.filter((p: any) => p.currentStock <= p.reorderLevel).length;
    const outOfStockCount = products.filter((p: any) => p.currentStock === 0).length;
    const categoryCounts = products.reduce((acc: any, p: any) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalProducts,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        categoryCounts
      },
      message: 'Product stats fetched successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id/prices
router.put('/:id/prices', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { minSellingPrice, maxSellingPrice, customerPrice, purchasePrice } = req.body;
    
    if (minSellingPrice >= maxSellingPrice) {
      return res.status(400).json({ success: false, data: null, message: 'minSellingPrice must be less than maxSellingPrice' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldProduct = await tx.product.findUnique({ where: { id, firmId: req.user!.firmId } });
      if (!oldProduct) throw new Error('Product not found');

      const updated = await tx.product.update({
        where: { id },
        data: { minSellingPrice, maxSellingPrice, customerPrice, purchasePrice }
      });

      await tx.syncLog.create({
        data: {
          deviceId: 'server',
          userId: req.user!.userId,
          direction: 'UPLOAD',
          entity: 'product_price',
          entityId: id,
          action: 'UPDATE',
          payload: JSON.stringify({
            old: {
              minSellingPrice: oldProduct.minSellingPrice,
              maxSellingPrice: oldProduct.maxSellingPrice,
              customerPrice: oldProduct.customerPrice,
              purchasePrice: oldProduct.purchasePrice
            },
            new: {
              minSellingPrice, maxSellingPrice, customerPrice, purchasePrice
            }
          }),
          status: 'COMPLETED'
        }
      });

      return updated;
    });

    res.json({ success: true, data: result, message: 'Prices updated successfully' });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      res.status(404).json({ success: false, data: null, message: 'Product not found' });
    } else {
      next(error);
    }
  }
});

// PUT /api/products/:id/stock
router.put('/:id/stock', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { newStock, reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const oldProduct = await tx.product.findUnique({ where: { id, firmId: req.user!.firmId } });
      if (!oldProduct) throw new Error('Product not found');

      const updated = await tx.product.update({
        where: { id },
        data: { currentStock: newStock }
      });

      await tx.syncLog.create({
        data: {
          deviceId: 'server',
          userId: req.user!.userId,
          direction: 'UPLOAD',
          entity: 'product_stock',
          entityId: id,
          action: 'UPDATE',
          payload: JSON.stringify({
            oldStock: oldProduct.currentStock,
            newStock,
            reason
          }),
          status: 'COMPLETED'
        }
      });

      return updated;
    });

    res.json({ success: true, data: result, message: 'Stock updated successfully' });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      res.status(404).json({ success: false, data: null, message: 'Product not found' });
    } else {
      next(error);
    }
  }
});

// PUT /api/products/:id
router.put('/:id', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const data = req.body;
    const product = await prisma.product.update({
      where: { id },
      data
    });
    const response: ApiResponse<typeof product> = {
      success: true,
      data: product,
      message: 'Product updated successfully'
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ success: true, data: null, message: 'Product disabled successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
