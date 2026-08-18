const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance across the whole app
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;