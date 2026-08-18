const prisma = require('../config/database');
const { asyncHandler, ApiError, generateReference } = require('../utils/helpers');

// ─────────────────────────────────────────────
// Helper: builds date filter from query params
// Supports: ?range=today | ?range=month | ?from=&to=
// ─────────────────────────────────────────────
const buildDateFilter = (query) => {
  const now = new Date();

  if (query.range === 'today') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
  }

  if (query.range === 'month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  if (query.from || query.to) {
    const filter = {};
    if (query.from) filter.gte = new Date(query.from);
    if (query.to) filter.lte = new Date(`${query.to}T23:59:59.999`);
    return filter;
  }

  return undefined;
};

// ─────────────────────────────────────────────
// POST /api/payments — Record a payment
// ─────────────────────────────────────────────
const recordPayment = asyncHandler(async (req, res) => {
  const { customerId, planId, amount, paymentDate, method } = req.body;
  let { reference } = req.body;

  // 1. Customer must belong to this workspace
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId: req.userId },
  });
  if (!customer) throw new ApiError(404, 'Customer not found in your workspace');

  // 2. Plan must belong to this workspace
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId: req.userId },
  });
  if (!plan) throw new ApiError(404, 'Plan not found in your workspace');

  // 3. Auto-generate reference if the frontend didn't send one
  if (!reference) reference = generateReference();

  // 4. Duplicate reference check (friendly message before DB constraint hits)
  const duplicate = await prisma.payment.findUnique({
    where: { userId_reference: { userId: req.userId, reference } },
  });
  if (duplicate) throw new ApiError(409, `A payment with reference "${reference}" already exists`);

  // 5. Create
  const payment = await prisma.payment.create({
    data: {
      userId: req.userId,
      customerId,
      planId,
      amount,
      paymentDate: paymentDate || new Date(),
      method,
      reference,
    },
    include: {
      customer: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ success: true, data: payment });
});

// ─────────────────────────────────────────────
// GET /api/payments/stats — The 4 stat cards
// ─────────────────────────────────────────────
const getPaymentStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [aggregates, paymentsThisMonth, lastPayment] = await Promise.all([
    prisma.payment.aggregate({
      where: { userId: req.userId },
      _sum: { amount: true },
      _avg: { amount: true },
    }),
    prisma.payment.count({
      where: { userId: req.userId, paymentDate: { gte: startOfMonth } },
    }),
    prisma.payment.findFirst({
      where: { userId: req.userId },
      orderBy: { paymentDate: 'desc' },
      select: { amount: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalReceived: Number(aggregates._sum.amount || 0),
      paymentsThisMonth,
      averagePayment: Number(Number(aggregates._avg.amount || 0).toFixed(2)),
      lastPayment: lastPayment ? Number(lastPayment.amount) : 0,
    },
  });
});

// ─────────────────────────────────────────────
// GET /api/payments — Transactions list + filters
// ─────────────────────────────────────────────
const getPayments = asyncHandler(async (req, res) => {
  const { planId, method, page = 1, limit = 20 } = req.query;

  const where = { userId: req.userId };
  if (planId) where.planId = planId;
  if (method) where.method = method.toUpperCase();

  const dateFilter = buildDateFilter(req.query);
  if (dateFilter) where.paymentDate = dateFilter;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Math.min(Number(limit), 100);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({
    success: true,
    count: payments.length,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / take),
    data: payments,
  });
});

// ─────────────────────────────────────────────
// PATCH /api/payments/:id
// ─────────────────────────────────────────────
const updatePayment = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!payment) throw new ApiError(404, 'Payment not found');

  // Changing the reference? Check for duplicates first
  if (req.body.reference && req.body.reference !== payment.reference) {
    const duplicate = await prisma.payment.findUnique({
      where: { userId_reference: { userId: req.userId, reference: req.body.reference } },
    });
    if (duplicate) throw new ApiError(409, `A payment with reference "${req.body.reference}" already exists`);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: req.body,
    include: {
      customer: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });

  res.json({ success: true, data: updated });
});

// ─────────────────────────────────────────────
// DELETE /api/payments/:id
// ─────────────────────────────────────────────
const deletePayment = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!payment) throw new ApiError(404, 'Payment not found');

  await prisma.payment.delete({ where: { id: payment.id } });

  res.json({ success: true, message: 'Payment deleted successfully' });
});

module.exports = { recordPayment, getPaymentStats, getPayments, updatePayment, deletePayment };