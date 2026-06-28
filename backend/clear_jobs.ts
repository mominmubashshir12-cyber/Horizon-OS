import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('Clearing job-related data...');
  
  // Delete in order to respect foreign key constraints (though Prisma handles some of this)
  await prisma.toolTransferRequest.deleteMany({});
  await prisma.toolIssuance.deleteMany({});
  await prisma.materialUsageLog.deleteMany({});
  await prisma.jobRequiredTool.deleteMany({});
  await prisma.jobRequiredMaterial.deleteMany({});
  await prisma.siteVisit.deleteMany({});
  await prisma.jobRequest.deleteMany({});
  
  // Reset tools to available
  await prisma.tool.updateMany({
    data: {
      currentHolderId: null,
      condition: 'GOOD'
    }
  });

  // Finally, delete all Job Cards
  await prisma.jobCard.deleteMany({});

  console.log('Successfully cleared all job cards and related data!');
}

clearData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
