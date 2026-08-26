require("dotenv").config();
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

async function main() {
  const email = "praise.test@prontolog.com";
  const newPassword = "Password123!";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`⚠️ User ${email} not found. Creating them now...`);
    await prisma.user.create({
      data: {
        firstName: "Praise",
        lastName: "Test",
        email,
        password: hashPassword(newPassword)
      }
    });
  } else {
    await prisma.user.update({
      where: { email },
      data: { password: hashPassword(newPassword) }
    });
  }

  console.log(`✅ Password set for ${email}`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());