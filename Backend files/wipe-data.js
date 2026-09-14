const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!admin) { console.log('❌ No super admin found.'); process.exit(1); }
    
    console.log('🧹 Starting wipe for user:', admin.email);
    
    const pay = await prisma.payment.deleteMany({ where: { userId: admin.id } });
    console.log(`🗑️ Deleted ${pay.count} payments`);
    
    const cust = await prisma.customer.deleteMany({ where: { userId: admin.id } });
    console.log(`🗑️ Deleted ${cust.count} customers`);
    
    console.log('✅ Wipe complete. Ready for fresh import with auto-payments.');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();