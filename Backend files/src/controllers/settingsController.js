const prisma = require('../config/database');
const { asyncHandler } = require('../utils/helpers');
const { DEFAULT_SETTINGS } = require('../config/constants');

// GET /api/settings
const getSettings = asyncHandler(async (req, res) => {
  let settings = await prisma.settings.findUnique({
    where: { userId: req.userId },
  });

  // First visit → create with defaults (frontend always gets a full object)
  if (!settings) {
    settings = await prisma.settings.create({
      data: { userId: req.userId, ...DEFAULT_SETTINGS },
    });
  }

  res.json({ success: true, data: settings });
});

// PATCH /api/settings — partial update, creates if missing
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await prisma.settings.upsert({
    where: { userId: req.userId },
    create: { userId: req.userId, ...DEFAULT_SETTINGS, ...req.body },
    update: req.body,
  });

  res.json({ success: true, data: settings });
});

module.exports = { getSettings, updateSettings };