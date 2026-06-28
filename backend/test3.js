const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const job = await prisma.jobCard.findFirst({
    where: { id: 8 },
    include: {
      requestedBy: {
        where: { status: 'PENDING' },
        select: { userId: true, status: true }
      }
    }
  });
  console.log(JSON.stringify(job, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
