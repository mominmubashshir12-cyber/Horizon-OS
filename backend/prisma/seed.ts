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
