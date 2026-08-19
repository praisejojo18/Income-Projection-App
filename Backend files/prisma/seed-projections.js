require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "praise.test@prontolog.com" }
  });
  if (!user) throw new Error("Run `node prisma/seed.js` first.");

  const basic = await prisma.plan.findFirst({
    where: { userId: user.id, name: "Basic Plan" }
  });
  const standard = await prisma.plan.findFirst({
    where: { userId: user.id, name: "Standard Plan" }
  });
  if (!basic || !standard) throw new Error("Plans missing. Run `node prisma/seed.js` first.");

  let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: "Seed Customer",
        planId: basic.id,
        expiryDate: new Date("2026-09-30T00:00:00.000Z")
      }
    });
  }

  // ---- PROJECTIONS ----
  // July (closed window -> will be judged)
  await prisma.projection.upsert({
    where: {
      userId_planId_date: { userId: user.id, planId: basic.id, date: new Date("2026-07-01") }
    },
    update: {},
    create: {
      userId: user.id, planId: basic.id, date: new Date("2026-07-01"),
      threeDay: 15000, oneWeek: 35000, oneMonth: 100000, oneYear: 1200000
    }
  });

  await prisma.projection.upsert({
    where: {
      userId_planId_date: { userId: user.id, planId: standard.id, date: new Date("2026-07-01") }
    },
    update: {},
    create: {
      userId: user.id, planId: standard.id, date: new Date("2026-07-01"),
      threeDay: 10000, oneWeek: 20000, oneMonth: 50000, oneYear: 600000
    }
  });

  // August (open window -> "In Progress")
  await prisma.projection.upsert({
    where: {
      userId_planId_date: { userId: user.id, planId: basic.id, date: new Date("2026-08-01") }
    },
    update: {},
    create: {
      userId: user.id, planId: basic.id, date: new Date("2026-08-01"),
      threeDay: 15000, oneWeek: 35000, oneMonth: 100000, oneYear: 1200000
    }
  });

  // ---- ACTUAL PAYMENTS ----
  await prisma.payment.upsert({
    where: { userId_reference: { userId: user.id, reference: "SEED-JUL-BASIC" } },
    update: {},
    create: {
      userId: user.id, customerId: customer.id, planId: basic.id,
      amount: 90000, paymentDate: new Date("2026-07-20T10:00:00.000Z"),
      method: "BANK_TRANSFER", reference: "SEED-JUL-BASIC"
    }
  });

  await prisma.payment.upsert({
    where: { userId_reference: { userId: user.id, reference: "SEED-JUL-STD" } },
    update: {},
    create: {
      userId: user.id, customerId: customer.id, planId: standard.id,
      amount: 20000, paymentDate: new Date("2026-07-25T10:00:00.000Z"),
      method: "CASH", reference: "SEED-JUL-STD"
    }
  });

  console.log("✅ Projections + payments seeded!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());