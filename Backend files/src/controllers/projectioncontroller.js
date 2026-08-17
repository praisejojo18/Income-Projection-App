const prisma = require('../config/database');
const { asyncHandler, ApiError } = require('../utils/helpers');

// Maps frontend tabs → DB columns
// Frontend uses "Daily (3-day)/Weekly/Monthly/Annually"
const TIMEFRAME_COLUMN = {
  daily: 'threeDay',
  weekly: 'oneWeek',
  monthly: 'oneMonth',
  yearly: 'oneYear',
  annually: 'oneYear', // Proj-vs-Actual report uses "Annually"
};

// ─────────────────────────────────────────────
// POST /api/projections — Create (upserts same date+plan)
// ─────────────────────────────────────────────
const createProjection = asyncHandler(async (req, res) => {
  const { planId, date, threeDay, oneWeek, oneMonth, oneYear } = req.body;

  // Plan must belong to this workspace
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId: req.userId },
  });
  if (!plan) throw new ApiError(404, 'Plan not found in your workspace');

  const projectionDate = new Date(date);

  // Upsert: if a projection for this date+plan already exists, update it instead
  const projection = await prisma.projection.upsert({
    where: {
      userId_planId_date: { userId: req.userId, planId, date: projectionDate },
    },
    create: {
      userId: req.userId,
      planId,
      date: projectionDate,
      threeDay,
      oneWeek,
      oneMonth,
      oneYear,
    },
    update: { threeDay, oneWeek, oneMonth, oneYear },
    include: { plan: { select: { id: true, name: true } } },
  });

  res.status(201).json({ success: true, data: projection });
});

// ─────────────────────────────────────────────
// GET /api/projections?timeframe=daily — Tabbed list
// ─────────────────────────────────────────────
const getProjections = asyncHandler(async (req, res) => {
  const { timeframe, page = 1, limit = 20 } = req.query;
  const where = { userId: req.userId };

  const skip = (Number(page) - 1) * Number(limit);
  const take = Math.min(Number(limit), 100);

  const projections = await prisma.projection.findMany({
    where,
    orderBy: { date: 'desc' },
    skip,
    take,
    include: { plan: { select: { id: true, name: true } } },
  });

  const total = await prisma.projection.count({ where });

  // Attach the amount matching the active tab so the frontend can render one column
  const column = TIMEFRAME_COLUMN[timeframe] || null;
  const data = projections.map((p) => ({
    ...p,
    projectedAmount: column ? Number(p[column] || 0) : null,
  }));

  res.json({
    success: true,
    count: data.length,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / take),
    timeframe: timeframe || 'all',
    data,
  });
});

// ─────────────────────────────────────────────
// GET /api/projections/summary — Totals per timeframe
// (Feeds Dashboard "Total Projection" + Proj-vs-Actual report)
// ─────────────────────────────────────────────
const getProjectionSummary = asyncHandler(async (req, res) => {
  const where = { userId: req.userId };

  // Optional date scoping: ?from=2026-08-01&to=2026-08-31
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = new Date(req.query.from);
    if (req.query.to) where.date.lte = new Date(`${req.query.to}T23:59:59.999`);
  }

  const result = await prisma.projection.aggregate({
    where,
    _sum: { threeDay: true, oneWeek: true, oneMonth: true, oneYear: true },
    _count: true,
  });

  res.json({
    success: true,
    data: {
      daily: Number(result._sum.threeDay || 0),
      weekly: Number(result._sum.oneWeek || 0),
      monthly: Number(result._sum.oneMonth || 0),
      yearly: Number(result._sum.oneYear || 0),
      totalProjections: result._count,
    },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/projections/:id
// ─────────────────────────────────────────────
const updateProjection = asyncHandler(async (req, res) => {
  const projection = await prisma.projection.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!projection) throw new ApiError(404, 'Projection not found');

  const { threeDay, oneWeek, oneMonth, oneYear } = req.body;

  const updated = await prisma.projection.update({
    where: { id: projection.id },
    data: {
      ...(threeDay !== undefined && { threeDay }),
      ...(oneWeek !== undefined && { oneWeek }),
      ...(oneMonth !== undefined && { oneMonth }),
      ...(oneYear !== undefined && { oneYear }),
    },
    include: { plan: { select: { id: true, name: true } } },
  });

  res.json({ success: true, data: updated });
});

// ─────────────────────────────────────────────
// DELETE /api/projections/:id
// ─────────────────────────────────────────────
const deleteProjection = asyncHandler(async (req, res) => {
  const projection = await prisma.projection.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!projection) throw new ApiError(404, 'Projection not found');

  await prisma.projection.delete({ where: { id: projection.id } });

  res.json({ success: true, message: 'Projection deleted successfully' });
});

module.exports = {
  createProjection,
  getProjections,
  getProjectionSummary,
  updateProjection,
  deleteProjection,
};