import { prisma } from '../lib/prisma';

export async function calculateDisciplineScore(
  userId: number,
  month: number,
  year: number
): Promise<number> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // 1. Get attendance stats
  const attendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate }
    }
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  let leaveDays = 0;
  let presentDays = 0;
  let lateDays = 0;

  for (const att of attendances) {
    if (att.status === 'LEAVE') leaveDays++;
    else if (att.status === 'PRESENT') {
      presentDays++;
      if (att.lateMinutes > 0) lateDays++;
    }
  }
  const totalWorkingDays = daysInMonth - leaveDays;
  const absentDays = totalWorkingDays - presentDays;

  // 2. Count tool incidents
  const toolIncidentsCount = await prisma.toolIssuance.count({
    where: {
      userId,
      returnedAt: { gte: startDate, lte: endDate },
      returnCondition: { in: ['DAMAGED', 'LOST'] }
    }
  });

  // 3. Count jobs completed
  const jobsCompletedCount = await prisma.jobCard.count({
    where: {
      assignedToId: userId,
      verifiedAt: { gte: startDate, lte: endDate },
      status: 'VERIFIED'
    }
  });

  // 4. Calculate score
  let score = 100;
  score -= (2 * absentDays);
  score -= (0.5 * lateDays);
  score -= (1 * toolIncidentsCount);
  score += (1 * jobsCompletedCount);

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

export async function generateMonthlyReport(
  userId: number,
  month: number,
  year: number
): Promise<any> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const attendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate }
    }
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  let leaveDays = 0;
  let presentDays = 0;
  let lateDays = 0;
  let totalLateMinutes = 0;

  for (const att of attendances) {
    if (att.status === 'LEAVE') leaveDays++;
    else if (att.status === 'PRESENT') {
      presentDays++;
      if (att.lateMinutes > 0) {
        lateDays++;
        totalLateMinutes += att.lateMinutes;
      }
    }
  }
  const totalWorkingDays = daysInMonth - leaveDays;
  const absentDays = totalWorkingDays - presentDays;

  const disciplineScore = await calculateDisciplineScore(userId, month, year);

  const baseSalary = user.baseSalary;
  const totalWorkingMinutesInMonth = totalWorkingDays * 8 * 60;
  
  let deductionAmount = 0;
  if (totalWorkingMinutesInMonth > 0) {
    deductionAmount = (totalLateMinutes / totalWorkingMinutesInMonth) * baseSalary;
  }
  const maxDeduction = 0.20 * baseSalary;
  if (deductionAmount > maxDeduction) {
    deductionAmount = maxDeduction;
  }

  let bonusAmount = 0;
  let bonusReason = null;

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const prevReport = await prisma.performanceReport.findUnique({
    where: {
      userId_month_year: {
        userId,
        month: prevMonth,
        year: prevYear
      }
    }
  });

  if (disciplineScore > 85 && prevReport && prevReport.disciplineScore > 85) {
    bonusAmount = 0.10 * baseSalary;
    bonusReason = "Consistent high performance for 2 months";
  }

  const finalSalary = baseSalary - deductionAmount + bonusAmount;

  const jobsCompleted = await prisma.jobCard.count({
    where: {
      assignedToId: userId,
      verifiedAt: { gte: startDate, lte: endDate },
      status: 'VERIFIED'
    }
  });

  const toolIncidents = await prisma.toolIssuance.count({
    where: {
      userId,
      returnedAt: { gte: startDate, lte: endDate },
      returnCondition: { in: ['DAMAGED', 'LOST'] }
    }
  });

  const report = await prisma.performanceReport.upsert({
    where: {
      userId_month_year: {
        userId,
        month,
        year
      }
    },
    update: {
      totalPresent: presentDays,
      totalAbsent: absentDays,
      totalLateDays: lateDays,
      totalLateMinutes: totalLateMinutes,
      jobsCompleted,
      toolIncidents,
      disciplineScore,
      baseSalary,
      deductionAmount,
      deductionReason: deductionAmount > 0 ? `Late deduction` : null,
      bonusAmount,
      bonusReason,
      finalSalary,
      firmId: user.firmId,
    },
    create: {
      userId,
      month,
      year,
      totalPresent: presentDays,
      totalAbsent: absentDays,
      totalLateDays: lateDays,
      totalLateMinutes: totalLateMinutes,
      jobsCompleted,
      toolIncidents,
      disciplineScore,
      baseSalary,
      deductionAmount,
      deductionReason: deductionAmount > 0 ? `Late deduction` : null,
      bonusAmount,
      bonusReason,
      finalSalary,
      firmId: user.firmId,
    }
  });

  return report;
}

export async function generateAllMonthlyReports(month: number, year: number): Promise<any[]> {
  const activeUsers = await prisma.user.findMany({
    where: { firmId: 1, isActive: true }
  });

  const results = [];
  for (const user of activeUsers) {
    const report = await generateMonthlyReport(user.id, month, year);
    results.push(report);
  }
  return results;
}
