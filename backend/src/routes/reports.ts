import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireOwner);

// GET /api/reports/employees/:year/:month
router.get('/employees/:year/:month', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const firmId = req.user!.firmId;

    const reports = await prisma.performanceReport.findMany({
      where: { firmId, year, month },
      include: {
        user: { select: { fullName: true, role: true } }
      }
    });

    res.json({ success: true, data: reports, message: 'Employee reports fetched' });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/inventory/:year/:month
router.get('/inventory/:year/:month', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const firmId = req.user!.firmId;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const products = await prisma.product.findMany({ where: { firmId } });
    const materials = await prisma.consumableMaterial.findMany({ where: { firmId } });
    
    let currentStockValue = 0;
    products.forEach(p => { currentStockValue += p.currentStock * p.purchasePrice; });
    materials.forEach(m => { currentStockValue += m.currentStock * m.purchasePrice; });

    const materialLogs = await prisma.materialUsageLog.findMany({
      where: { firmId, takenAt: { gte: start, lte: end } },
      include: { material: true }
    });

    let totalMaterialCostConsumed = 0;
    let totalMaterialsConsumed = 0;
    materialLogs.forEach(log => {
      totalMaterialsConsumed += log.quantityUsed;
      totalMaterialCostConsumed += log.quantityUsed * log.material.purchasePrice;
    });

    const damagedTools = await prisma.toolIssuance.count({
      where: { firmId, returnCondition: { in: ['DAMAGED', 'LOST', 'POOR'] }, returnedAt: { gte: start, lte: end } }
    });

    res.json({ 
      success: true, 
      data: {
        stockValueStart: currentStockValue,
        stockValueEnd: currentStockValue, 
        materialsConsumed: totalMaterialsConsumed,
        toolsDamaged: damagedTools,
        totalMaterialCostConsumed
      }, 
      message: 'Inventory report fetched' 
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/sales/:year/:month
router.get('/sales/:year/:month', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const firmId = req.user!.firmId;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: { firmId, createdAt: { gte: start, lte: end } },
      include: { product: true, user: true }
    });

    let totalRevenue = 0;
    let totalMargin = 0;
    const salesByEmployee: Record<string, number> = {};
    const salesByProduct: Record<string, number> = {};
    const salesByCategory: Record<string, number> = {};
    const salesByDayMap: Record<string, number> = {};

    sales.forEach(s => {
      totalRevenue += s.totalAmount;
      totalMargin += s.marginAmount;

      const employeeName = s.user.fullName;
      salesByEmployee[employeeName] = (salesByEmployee[employeeName] || 0) + s.totalAmount;

      const productName = s.product.name;
      salesByProduct[productName] = (salesByProduct[productName] || 0) + s.totalAmount;

      const categoryName = s.product.category;
      salesByCategory[categoryName] = (salesByCategory[categoryName] || 0) + s.totalAmount;

      const dateStr = s.createdAt.toISOString().split('T')[0];
      salesByDayMap[dateStr] = (salesByDayMap[dateStr] || 0) + s.totalAmount;
    });

    const salesByDay = Object.keys(salesByDayMap).map(date => ({
      date,
      amount: salesByDayMap[date]
    })).sort((a, b) => a.localeCompare(b));

    res.json({ 
      success: true, 
      data: {
        totalRevenue,
        totalMargin,
        totalSalesCount: sales.length,
        salesByEmployee: Object.keys(salesByEmployee).map(k => ({ name: k, amount: salesByEmployee[k] })),
        salesByProduct: Object.keys(salesByProduct).map(k => ({ name: k, amount: salesByProduct[k] })),
        salesByCategory: Object.keys(salesByCategory).map(k => ({ name: k, amount: salesByCategory[k] })),
        salesByDay
      }, 
      message: 'Sales report fetched' 
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/cashflow/:year/:month
router.get('/cashflow/:year/:month', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const firmId = req.user!.firmId;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: { firmId, createdAt: { gte: start, lte: end } }
    });
    const totalIncome = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    const reports = await prisma.performanceReport.findMany({
      where: { firmId, year, month }
    });
    const salaryExpenses = reports.reduce((sum, r) => sum + r.finalSalary, 0);

    const materialLogs = await prisma.materialUsageLog.findMany({
      where: { firmId, takenAt: { gte: start, lte: end } },
      include: { material: true }
    });
    const totalMaterialCostConsumed = materialLogs.reduce((sum, log) => sum + (log.quantityUsed * log.material.purchasePrice), 0);

    const totalExpenses = salaryExpenses + totalMaterialCostConsumed;
    const netCashflow = totalIncome - totalExpenses;

    res.json({ 
      success: true, 
      data: {
        totalIncome,
        totalExpenses,
        salaryExpenses,
        netCashflow
      }, 
      message: 'Cashflow report fetched' 
    });
  } catch (error) {
    next(error);
  }
});

export default router;
