const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.jobRequest.findMany({ where: { status: 'PENDING' } });
  console.log(JSON.stringify(reqs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
