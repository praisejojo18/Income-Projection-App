
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
};
(async () => {
  const users = [
    { firstName: 'Super', lastName: 'Admin', email: 'super@prontolog.com', role: 'SUPER_ADMIN' },
    { firstName: 'Regular', lastName: 'User', email: 'user@prontolog.com', role: 'USER' }
  ];
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) { console.log('Skipped ' + u.email); continue; }
    await prisma.user.create({ data: { ...u, password: hashPassword('password123') } });
    console.log('Created ' + u.email + ' (' + u.role + ') - password: password123');
  }
  await prisma.' + chr(36) + 'disconnect();
  console.log('Done!');
})();
