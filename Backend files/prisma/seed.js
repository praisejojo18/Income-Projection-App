require("dotenv").config(); // ⬅️ THIS LINE loads your .env file
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "praise.test@prontolog.com" },
    update: {},
    create: {
      firstName: "Praise",
      lastName: "Damilola",
      email: "praise.test@prontolog.com",
      password: "test12345"
    }
  });

  const basicPlan = await prisma.plan.upsert({
    where: { userId_name: { userId: user.id, name: "Basic Plan" } },
    update: {},
    create: {
      userId: user.id,
      name: "Basic Plan",
      price: 5000,
      durationDays: 30
    }
  });

  const standardPlan = await prisma.plan.upsert({
    where: { userId_name: { userId: user.id, name: "Standard Plan" } },
    update: {},
    create: {
      userId: user.id,
      name: "Standard Plan",
      price: 10000,
      durationDays: 30
    }
  });

  console.log("✅ Seed completed!");
  console.log("USER_ID =", user.id);
  console.log("BASIC_PLAN_ID =", basicPlan.id);
  console.log("STANDARD_PLAN_ID =", standardPlan.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());