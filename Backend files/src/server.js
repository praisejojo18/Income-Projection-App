require('dotenv').config();
const app = require('./app');
const prisma = require('./config/database');

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`✅ ProntoLog API running → http://localhost:${PORT}`);
});

// Graceful shutdown — close DB connections cleanly
const shutdown = async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);