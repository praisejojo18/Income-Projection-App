// seed-users.js — creates local test accounts
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Same hashing as authController (scrypt) so login works
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

(async () => {
  const users = [
    { firstName: 'Super', lastName: 'Admin', email: 'super@prontolog.com', role: 'SUPER_ADMIN' },
    { firstName: 'Regular', lastName: 'User', email: 'user@prontolog.com', role: 'USER' }
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) { console.log(`⏭️  ${u.email} already exists`); continue; }
    await prisma.user.create({ data: { ...u, password: hashPassword('password123') } });
    console.log(`✅ Created ${u.email} (${u.role}) — password: password123`);
  }

  await prisma.$disconnect();
  console.log('🎉 Done!');
})();