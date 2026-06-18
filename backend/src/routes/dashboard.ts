import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireOwner);

// GET /api/dashboard/live
router.get('/live', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const firmId = req.user!.firmId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Attendance
    const users = await prisma.user.findMany({ where: { firmId, isActive: true } });
    const attendanceRecords = await prisma.attendance.findMany({
      where: { firmId, date: { gte: today } }
    });
    
    let present = 0, late = 0, absent = 0;
    const employees = users.map(u => {
      const record = attendanceRecords.find(a => a.userId === u.id);
      let status = 'ABSENT';
      if (record) {
        if (record.status === 'ABSENT') {
          status = 'ABSENT';
          absent++;
        } else if (record.lateMinutes > 0) {
          status = 'LATE';
          late++;
        } else {
          status = 'PRESENT';
          present++;
        }
      } else {
        absent++;
      }
      return {
        id: u.id,
        name: u.fullName,
        role: u.role,
        status,
        checkInTime: record?.checkInTime || null,
        lateMinutes: record?.lateMinutes || 0
      };
    });

    // 2. Active Jobs
    const jobs = await prisma.jobCard.findMany({
      where: { firmId, status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } }
    });
    
    let assigned = 0, enRoute = 0, arrived = 0, inProgress = 0;
    jobs.forEach(j => {
      if (j.status === 'ASSIGNED') assigned++;
      else if (j.status === 'EN_ROUTE') enRoute++;
      else if (j.status === 'ARRIVED') arrived++;
      else if (j.status === 'IN_PROGRESS') inProgress++;
    });

    // 3. Today Sales
    const sales = await prisma.sale.findMany({
      where: { firmId, createdAt: { gte: today } },
      include: { product: true }
    });
    
    const todaySales = {
      totalAmount: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      count: sales.length,
      topProduct: ""
    };
    
    if (sales.length > 0) {
      const pCounts: Record<string, number> = {};
      sales.forEach(s => {
        pCounts[s.product.name] = (pCounts[s.product.name] || 0) + s.quantity;
      });
      todaySales.topProduct = Object.keys(pCounts).reduce((a, b) => pCounts[a] > pCounts[b] ? a : b);
    }

    // 4. Low Stock Alerts
    const products = await prisma.product.findMany({
      where: { firmId, isActive: true }
    });
    const lowStockItems = products.filter(p => p.currentStock <= p.reorderLevel).map(p => ({
      id: p.id,
      name: p.name,
      currentStock: p.currentStock,
      reorderLevel: p.reorderLevel
    }));

    // 5. Pending Quotations
    const pendingQuotes = await prisma.quotation.count({
      where: { firmId, status: { in: ['DRAFT', 'SENT'] } }
    });

    // 6. Tools Overdue
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 1);
    const overdueTools = await prisma.toolIssuance.count({
      where: { firmId, status: 'ISSUED', issuedAt: { lt: overdueDate } }
    });

    // 7. Unread Alerts
    const unreadAlerts = await prisma.systemAlert.count({
      where: { firmId, isRead: false }
    });

    const liveData = {
      todayAttendance: { present, late, absent, employees },
      activeJobs: { assigned, enRoute, arrived, inProgress },
      todaySales,
      lowStockAlerts: { count: lowStockItems.length, items: lowStockItems },
      pendingQuotations: { count: pendingQuotes },
      toolsOverdue: { count: overdueTools },
      unreadAlerts: { count: unreadAlerts }
    };

    res.json({ success: true, data: liveData, message: 'Live dashboard data fetched' });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, severity, limit = 20 } = req.query;
    const where: any = { firmId: req.user!.firmId, isDismissed: false };
    
    if (type) where.type = String(type);
    if (severity) where.severity = String(severity);

    const alerts = await prisma.systemAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit), 10)
    });

    res.json({ success: true, data: alerts, message: 'Alerts fetched' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/alerts/:id/read
router.put('/alerts/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const alert = await prisma.systemAlert.update({
      where: { id },
      data: { isRead: true }
    });
    res.json({ success: true, data: alert, message: 'Alert marked as read' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/alerts/:id/dismiss
router.put('/alerts/:id/dismiss', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const alert = await prisma.systemAlert.update({
      where: { id },
      data: { isDismissed: true }
    });
    res.json({ success: true, data: alert, message: 'Alert dismissed' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/alerts/read-all
router.put('/alerts/read-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.systemAlert.updateMany({
      where: { firmId: req.user!.firmId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, data: null, message: 'All alerts marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
