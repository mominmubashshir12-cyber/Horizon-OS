const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating assignedToId to assignedEmployees...');
  const jobs = await prisma.jobCard.findMany({
    where: { assignedToId: { not: null } }
  });

  for (const job of jobs) {
    await prisma.jobCard.update({
      where: { id: job.id },
      data: {
        assignedEmployees: {
          connect: { id: job.assignedToId }
        }
      }
    });
    console.log(`Migrated job ${job.id}`);
  }
  console.log('Migration complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
