require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BUSINESS_PLANS = [
  { name: "Silver",        price: 12800 },
  { name: "Gold",          price: 21900 },
  { name: "Platinum",      price: 31800 },
  { name: "Platinum+",     price: 46500 },
  { name: "Premium",       price: 75000 },
  { name: "Premium+",      price: 95000 },
  { name: "SME Silver",    price: 25000 },
  { name: "SME Gold",      price: 40000 },
  { name: "SME Platinum",  price: 50000 },
  { name: "SME Platinum+", price: 75000 }
];

async function main() {
  const users = await prisma.user.findMany();
  if (!users.length) throw new Error("No users found. Run node prisma/seed.js first.");

  for (const user of users) {
    // Hide old test plans from dropdowns (customers attached to them stay safe)
    await prisma.plan.updateMany({
      where: { userId: user.id, name: { in: ["Basic Plan", "Standard Plan"] } },
      data: { status: "ARCHIVED" }
    });

    // Create / update the real business plans
    for (const p of BUSINESS_PLANS) {
      await prisma.plan.upsert({
        where: { userId_name: { userId: user.id, name: p.name } },
        update: { price: p.price, status: "ACTIVE" },
        create: {
          userId: user.id,
          name: p.name,
          price: p.price,
          durationDays: 30, // monthly billing cycle
          status: "ACTIVE"
        }
      });
    }
  }

  const plans = await prisma.plan.findMany({
    where: { userId: users[0].id, status: "ACTIVE" },
    orderBy: { name: "asc" }
  });

  console.log("✅ Business plans ready:");
  plans.forEach((p) => console.log(`   ${p.name.padEnd(16)} ₦${Number(p.price).toLocaleString()}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());