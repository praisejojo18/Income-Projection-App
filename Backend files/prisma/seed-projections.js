require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "praise.test@prontolog.com" }
  });
  if (!user) throw new Error("Run `node prisma/seed.js` first to create the user.");

  const silver = await prisma.plan.findFirst({ where: { userId: user.id, name: "Silver" } });
  const gold = await prisma.plan.findFirst({ where: { userId: user.id, name: "Gold" } });
  const platinum = await prisma.plan.findFirst({ where: { userId: user.id, name: "Platinum" } });

  if (!silver || !gold) throw new Error("New business plans missing. Run `node prisma/seed-business-plans.js` first.");

  let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: "Seed Customer",
        planId: silver.id,
        expiryDate: new Date("2026-09-30T00:00:00.000Z")
      }
    });
  }

  // ---- PROJECTIONS (July) ----
  await prisma.projection.upsert({
    where: { userId_planId_date: { userId: user.id, planId: silver.id, date: new Date("2026-07-01") } },
    update: {},
    create: {
      userId: user.id, planId: silver.id, date: new Date("2026-07-01"),
      threeDay: 25000, oneWeek: 60000, oneMonth: 150000, oneYear: 1800000
    }
  });

  await prisma.projection.upsert({
    where: { userId_planId_date: { userId: user.id, planId: gold.id, date: new Date("2026-07-01") } },
    update: {},
    create: {
      userId: user.id, planId: gold.id, date: new Date("2026-07-01"),
      threeDay: 40000, oneWeek: 90000, oneMonth: 250000, oneYear: 3000000
    }
  });

  // ---- PROJECTIONS (August) ----
  await prisma.projection.upsert({
    where: { userId_planId_date: { userId: user.id, planId: silver.id, date: new Date("2026-08-01") } },
    update: {},
    create: {
      userId: user.id, planId: silver.id, date: new Date("2026-08-01"),
      threeDay: 30000, oneWeek: 70000, oneMonth: 180000, oneYear: 2000000
    }
  });

  // ---- ACTUAL PAYMENTS (July) ----
  await prisma.payment.upsert({
    where: { userId_reference: { userId: user.id, reference: "SEED-JUL-SILVER" } },
    update: {},
    create: {
      userId: user.id, customerId: customer.id, planId: silver.id,
      amount: 130000, paymentDate: new Date("2026-07-15T10:00:00.000Z"),
      method: "BANK_TRANSFER", reference: "SEED-JUL-SILVER"
    }
  });

  await prisma.payment.upsert({
    where: { userId_reference: { userId: user.id, reference: "SEED-JUL-GOLD" } },
    update: {},
    create: {
      userId: user.id, customerId: customer.id, planId: gold.id,
      amount: 260000, paymentDate: new Date("2026-07-22T10:00:00.000Z"),
      method: "CASH", reference: "SEED-JUL-GOLD"
    }
  });

  console.log("✅ Projections + payments seeded with NEW Business Plans!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());