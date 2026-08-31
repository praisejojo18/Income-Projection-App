try { require('dotenv').config(); } catch (e) {}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const oldPlans = await prisma.plan.findMany({
    where: { name: { in: ['Basic', 'Basic Plan', 'Standard', 'Standard Plan'] } }
  });

  if (!oldPlans.length) {
    console.log('✅ No Basic/Standard plans found — nothing to wipe.');
    await prisma.$disconnect();
    return;
  }

  for (const p of oldPlans) {
    // 1) Find customers on this plan
    const custs = await prisma.customer.findMany({ where: { planId: p.id }, select: { id: true } });
    const custIds = custs.map(c => c.id);

    // 2) Delete ALL payments referencing those customers (any plan) — fixes FK error
    const pays = await prisma.payment.deleteMany({ where: { customerId: { in: custIds } } });

    // 3) Delete projections for this plan
    const projs = await prisma.projection.deleteMany({ where: { planId: p.id } });

    // 4) Now safe to delete the customers
    const del = await prisma.customer.deleteMany({ where: { planId: p.id } });

    // 5) Delete the plan itself
    await prisma.plan.delete({ where: { id: p.id } });

    console.log(`🗑️  Removed plan "${p.name}" (${del.count} customers, ${pays.count} payments, ${projs.count} projections)`);
  }

  console.log('✅ Done. Basic/Standard plans wiped — database clean for migration.');
  await prisma.$disconnect();
})();