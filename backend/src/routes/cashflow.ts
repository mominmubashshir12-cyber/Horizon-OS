// Cashflow route — manages income/expense categories, transactions, day ledger, and financial summaries.

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireOwner } from '../middleware/roleGuard';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';

const createCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.string().min(1, 'type is required'),
  color: z.string().min(1, 'color is required'),
  icon: z.string().optional().nullable()
});

const updateCategorySchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional().nullable()
});

const createTransactionSchema = z.object({
  title: z.string().min(1, 'title is required'),
  amount: z.union([z.number(), z.string()]),
  type: z.string().min(1, 'type is required'),
  categoryId: z.union([z.number(), z.string()]),
  date: z.string().min(1, 'date is required'),
  notes: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.string().optional().nullable()
});

const updateTransactionSchema = z.object({
  title: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  categoryId: z.union([z.number(), z.string()]).optional(),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.string().optional().nullable()
});

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireOwner);

// ─── HELPER: Recalculate DayLedger for a given date ──────────────────────────

async function recalculateDayLedger(date: Date, firmId: number): Promise<void> {
  const dayStart = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999
  ));

  // Sum income and expense for this day
  const transactions = await prisma.cashflowTransaction.findMany({
    where: { firmId, date: { gte: dayStart, lte: dayEnd } }
  });

  const totalIncome = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  // Find previous day's closing balance for opening balance
  const prevDay = new Date(dayStart);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevLedger = await prisma.dayLedger.findUnique({
    where: { date_firmId: { date: prevDay, firmId } }
  });
  const openingBalance = prevLedger?.closingBalance ?? 0;
  const closingBalance = openingBalance + totalIncome - totalExpense;

  await prisma.dayLedger.upsert({
    where: { date_firmId: { date: dayStart, firmId } },
    update: { totalIncome, totalExpense, openingBalance, closingBalance },
    create: { date: dayStart, firmId, totalIncome, totalExpense, openingBalance, closingBalance }
  });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

// GET /api/cashflow/categories
router.get('/categories', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.cashflowCategory.findMany({
      where: { firmId: req.user!.firmId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });
    res.json({ success: true, data: categories, message: 'Categories fetched' });
  } catch (error) {
    next(error);
  }
});

// POST /api/cashflow/categories
router.post('/categories', validateBody(createCategorySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type, color, icon } = req.body as { name: string; type: string; color: string; icon?: string };
    const category = await prisma.cashflowCategory.create({
      data: { name, type, color, icon: icon ?? null, firmId: req.user!.firmId }
    });
    res.status(201).json({ success: true, data: category, message: 'Category created' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cashflow/categories/:id
router.put('/categories/:id', validateBody(updateCategorySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, color, icon } = req.body as { name?: string; color?: string; icon?: string };
    const category = await prisma.cashflowCategory.update({
      where: { id },
      data: { ...(name && { name }), ...(color && { color }), ...(icon !== undefined && { icon }) }
    });
    res.json({ success: true, data: category, message: 'Category updated' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cashflow/categories/:id
router.delete('/categories/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const txCount = await prisma.cashflowTransaction.count({ where: { categoryId: id } });
    if (txCount > 0) {
      res.status(400).json({ success: false, data: null, message: 'Cannot delete category with existing transactions' });
      return;
    }
    await prisma.cashflowCategory.delete({ where: { id } });
    res.json({ success: true, data: null, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// GET /api/cashflow/transactions
router.get('/transactions', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { month, year, type, categoryId } = req.query;
    const firmId = req.user!.firmId;
    const now = new Date();
    const m = month ? parseInt(month as string, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year as string, 10) : now.getFullYear();

    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const where: {
      firmId: number;
      date: { gte: Date; lte: Date };
      type?: string;
      categoryId?: number;
    } = { firmId, date: { gte: startDate, lte: endDate } };

    if (type) where.type = type as string;
    if (categoryId) where.categoryId = parseInt(categoryId as string, 10);

    const transactions = await prisma.cashflowTransaction.findMany({
      where,
      include: { category: { select: { name: true, color: true } } },
      orderBy: { date: 'desc' }
    });

    res.json({ success: true, data: transactions, message: 'Transactions fetched' });
  } catch (error) {
    next(error);
  }
});

// POST /api/cashflow/transactions
router.post('/transactions', validateBody(createTransactionSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, amount, type, categoryId, date, notes, isRecurring, recurringInterval } = req.body as {
      title: string;
      amount: number;
      type: string;
      categoryId: number;
      date: string;
      notes?: string;
      isRecurring?: boolean;
      recurringInterval?: string;
    };
    const txDate = new Date(date);
    const transaction = await prisma.cashflowTransaction.create({
      data: {
        title,
        amount: Number(amount),
        type,
        categoryId: Number(categoryId),
        date: txDate,
        notes: notes ?? null,
        isRecurring: isRecurring ?? false,
        recurringInterval: recurringInterval ?? null,
        firmId: req.user!.firmId
      },
      include: { category: { select: { name: true, color: true } } }
    });
    await recalculateDayLedger(txDate, req.user!.firmId);
    res.status(201).json({ success: true, data: transaction, message: 'Transaction created' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cashflow/transactions/:id
router.put('/transactions/:id', validateBody(updateTransactionSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const existing = await prisma.cashflowTransaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, data: null, message: 'Transaction not found' });
      return;
    }
    const { title, amount, type, categoryId, date, notes, isRecurring, recurringInterval } = req.body as {
      title?: string;
      amount?: number;
      type?: string;
      categoryId?: number;
      date?: string;
      notes?: string;
      isRecurring?: boolean;
      recurringInterval?: string;
    };
    const newDate = date ? new Date(date) : existing.date;
    const updated = await prisma.cashflowTransaction.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(type && { type }),
        ...(categoryId && { categoryId: Number(categoryId) }),
        ...(date && { date: newDate }),
        ...(notes !== undefined && { notes }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(recurringInterval !== undefined && { recurringInterval })
      },
      include: { category: { select: { name: true, color: true } } }
    });
    await recalculateDayLedger(existing.date, req.user!.firmId);
    if (date && new Date(date).toDateString() !== existing.date.toDateString()) {
      await recalculateDayLedger(newDate, req.user!.firmId);
    }
    res.json({ success: true, data: updated, message: 'Transaction updated' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cashflow/transactions/:id
router.delete('/transactions/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const existing = await prisma.cashflowTransaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, data: null, message: 'Transaction not found' });
      return;
    }
    await prisma.cashflowTransaction.delete({ where: { id } });
    await recalculateDayLedger(existing.date, req.user!.firmId);
    res.json({ success: true, data: null, message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

// GET /api/cashflow/summary
router.get('/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { month, year } = req.query;
    const firmId = req.user!.firmId;
    const now = new Date();
    const m = month ? parseInt(month as string, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year as string, 10) : now.getFullYear();

    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    const prevMonthEnd = new Date(Date.UTC(y, m - 1, 0, 23, 59, 59, 999));

    // Get all transactions for the month with categories
    const transactions = await prisma.cashflowTransaction.findMany({
      where: { firmId, date: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, color: true } } }
    });

    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const netCashflow = totalIncome - totalExpense;

    // Opening balance = closing balance of previous month's last day
    const prevLedger = await prisma.dayLedger.findFirst({
      where: { firmId, date: { lte: prevMonthEnd } },
      orderBy: { date: 'desc' }
    });
    const openingBalance = prevLedger?.closingBalance ?? 0;
    const closingBalance = openingBalance + netCashflow;

    // Income by category
    const incomeByCategory: Record<string, { name: string; color: string; amount: number }> = {};
    const expenseByCategory: Record<string, { name: string; color: string; amount: number }> = {};

    transactions.forEach(t => {
      const key = String(t.categoryId);
      const catName = t.category.name;
      const catColor = t.category.color;
      if (t.type === 'INCOME') {
        if (!incomeByCategory[key]) incomeByCategory[key] = { name: catName, color: catColor, amount: 0 };
        incomeByCategory[key].amount += t.amount;
      } else {
        if (!expenseByCategory[key]) expenseByCategory[key] = { name: catName, color: catColor, amount: 0 };
        expenseByCategory[key].amount += t.amount;
      }
    });

    // Daily flow
    const daysInMonth = new Date(y, m, 0).getDate();
    const dailyMap: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      const d = t.date.toISOString().slice(0, 10);
      if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') dailyMap[d].income += t.amount;
      else dailyMap[d].expense += t.amount;
    });

    const dailyFlow = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10);
      const entry = dailyMap[d] ?? { income: 0, expense: 0 };
      return { date: d, day: i + 1, income: entry.income, expense: entry.expense, net: entry.income - entry.expense };
    });

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netCashflow,
        openingBalance,
        closingBalance,
        incomeByCategory: Object.values(incomeByCategory),
        expenseByCategory: Object.values(expenseByCategory),
        dailyFlow
      },
      message: 'Summary fetched'
    });
  } catch (error) {
    next(error);
  }
});

// ─── VELOCITY ─────────────────────────────────────────────────────────────────

// GET /api/cashflow/velocity
router.get('/velocity', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
    const firmId = req.user!.firmId;
    const now = new Date();
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const results: { month: string; year: number; totalIncome: number; totalExpense: number; net: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const startDate = new Date(Date.UTC(y, m - 1, 1));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

      const transactions = await prisma.cashflowTransaction.findMany({
        where: { firmId, date: { gte: startDate, lte: endDate } }
      });

      const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

      results.push({ month: MONTH_NAMES[m - 1], year: y, totalIncome, totalExpense, net: totalIncome - totalExpense });
    }

    res.json({ success: true, data: results, message: 'Velocity data fetched' });
  } catch (error) {
    next(error);
  }
});

// ─── LEDGER ───────────────────────────────────────────────────────────────────

// GET /api/cashflow/ledger
router.get('/ledger', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { month, year } = req.query;
    const firmId = req.user!.firmId;
    const now = new Date();
    const m = month ? parseInt(month as string, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year as string, 10) : now.getFullYear();

    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const ledger = await prisma.dayLedger.findMany({
      where: { firmId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' }
    });

    res.json({ success: true, data: ledger, message: 'Ledger fetched' });
  } catch (error) {
    next(error);
  }
});

export default router;
