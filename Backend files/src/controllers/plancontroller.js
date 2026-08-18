const prisma = require('../config/database');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/plans?status=ACTIVE
const getPlans = asyncHandler(async (req, res) => {
  const where = { userId: req.userId };
  if (req.query.status) where.status = req.query.status.toUpperCase();

  const plans = await prisma.plan.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      // Frontend can show "in use" badge; also powers delete-guard awareness
      _count: { select: { customers: true, payments: true, projections: true } },
    },
  });

  res.json({ success: true, count: plans.length, data: plans });
});

// POST /api/plans
const createPlan = asyncHandler(async (req, res) => {
  const { name, price, durationDays } = req.body;

  // Duplicate check (also enforced at DB level by @@unique)
  const exists = await prisma.plan.findUnique({
    where: { userId_name: { userId: req.userId, name } },
  });
  if (exists) throw new ApiError(409, `A plan named "${name}" already exists`);

  const plan = await prisma.plan.create({
    data: { name, price, durationDays, userId: req.userId },
  });

  res.status(201).json({ success: true, data: plan });
});

// PATCH /api/plans/:id
const updatePlan = asyncHandler(async (req, res) => {
  // Ownership check — can't edit another workspace's plan
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!plan) throw new ApiError(404, 'Plan not found');

  // Renaming? Check new name isn't taken
  if (req.body.name && req.body.name !== plan.name) {
    const dup = await prisma.plan.findUnique({
      where: { userId_name: { userId: req.userId, name: req.body.name } },
    });
    if (dup) throw new ApiError(409, `A plan named "${req.body.name}" already exists`);
  }

  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: req.body,
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/plans/:id — with in-use guard
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { _count: { select: { customers: true, payments: true, projections: true } } },
  });
  if (!plan) throw new ApiError(404, 'Plan not found');

  const { customers, payments, projections } = plan._count;

  // 🛡️ Guard: block delete if plan is referenced anywhere
  if (customers > 0 || payments > 0 || projections > 0) {
    throw new ApiError(409, 'This plan is in use and cannot be deleted', {
      customers,
      payments,
      projections,
      suggestion: 'Archive it instead → PATCH /api/plans/:id with { "status": "ARCHIVED" }',
    });
  }

  await prisma.plan.delete({ where: { id: plan.id } });
  res.json({ success: true, message: 'Plan deleted successfully' });
});

module.exports = { getPlans, createPlan, updatePlan, deletePlan };