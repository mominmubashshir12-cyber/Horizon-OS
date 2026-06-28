const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.jobCard.findFirst({
  where: { jobNumber: 'JC-2026-011' },
  include: {
    requiredTools: { include: { tool: true } },
    requiredMaterials: { include: { material: true } },
    assignedEmployees: true
  }
}).then(j => {
  console.log('requiredTools:', JSON.stringify(j?.requiredTools));
  console.log('requiredMaterials:', JSON.stringify(j?.requiredMaterials));
  console.log('assignedEmployees:', JSON.stringify(j?.assignedEmployees?.map(e => e.fullName)));
  console.log('status:', j?.status);
}).catch(e => console.error(e)).finally(() => p.$disconnect());
