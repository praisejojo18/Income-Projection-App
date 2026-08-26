require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "praise.test@prontolog.com" } });
  if (!user) throw new Error("User not found.");

  const oldPlans = await prisma.plan.findMany({
    where: { userId: user.id, name: { in: ["Basic Plan", "Standard Plan"] } }
  });
  const oldPlanIds = oldPlans.map((p) => p.id);
  if (!oldPlanIds.length) { console.log("Nothing to clean."); return; }

  const delPayments = await prisma.payment.deleteMany({
    where: { userId: user.id, planId: { in: oldPlanIds } }
  });

  const delProjections = await prisma.projection.deleteMany({
    where: { userId: user.id, planId: { in: oldPlanIds } }
  });

  console.log(`🗑️ Removed ${delProjections.count} old projections and ${delPayments.count} old payments (Basic/Standard).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());