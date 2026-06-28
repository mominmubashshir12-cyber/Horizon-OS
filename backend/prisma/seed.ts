// prisma/seed.ts
// Database seeding script — creates a default firm and an OWNER/ADMIN user for testing.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seeding...');

  // 1. Create default Firm (firmId: 1)
  const defaultFirm = await prisma.firm.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Horizon IT Solutions',
      address: 'Malegaon, Maharashtra',
      phone: '+91 98765 43210',
      email: 'info@horizonit.com',
    },
  });
  console.log(`[Seed] Default firm created/ensured: ${defaultFirm.name}`);

  // 2. Create admin/owner user
  const adminPasswordHash = await bcrypt.hash('admin', 12);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'Horizon Admin Owner',
      role: 'OWNER',
      employmentType: 'PERMANENT',
      baseSalary: 75000,
      isActive: true,
      firmId: 1,
    },
  });
  console.log(`[Seed] Owner user created/ensured: ${adminUser.username} (${adminUser.fullName})`);

  // 3. Create default Cashflow Categories
  const categories = [
    { name: 'Sales Revenue', type: 'INCOME', color: '#22c55e' },
    { name: 'Service Income', type: 'INCOME', color: '#10b981' },
    { name: 'Other Income', type: 'INCOME', color: '#06b6d4' },
    { name: 'Salaries', type: 'EXPENSE', color: '#ef4444' },
    { name: 'Materials', type: 'EXPENSE', color: '#f97316' },
    { name: 'Rent', type: 'EXPENSE', color: '#eab308' },
    { name: 'Utilities', type: 'EXPENSE', color: '#a855f7' },
    { name: 'Transport', type: 'EXPENSE', color: '#3b82f6' },
    { name: 'Miscellaneous', type: 'EXPENSE', color: '#64748b' }
  ];

  for (const cat of categories) {
    const exists = await prisma.cashflowCategory.findFirst({
      where: { name: cat.name, firmId: 1 }
    });
    if (!exists) {
      await prisma.cashflowCategory.create({
        data: { ...cat, isDefault: true, firmId: 1 }
      });
    }
  }
  console.log('[Seed] Default cashflow categories created/ensured.');

  console.log('[Seed] Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
