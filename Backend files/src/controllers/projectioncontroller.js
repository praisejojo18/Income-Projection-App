const prisma = require("../config/database");
const { computeAutoProjections } = require("../utils/autoProjection");

const getUserId = (req) =>
  req.user?.id ||
  req.user?.userId ||
  req.headers["x-user-id"] ||
  process.env.DEFAULT_USER_ID;

const round2 = (n) => Math.round(n * 100) / 100;

const cleanNumber = (v) =>
  v === undefined || v === null || v === "" ? null : Number(v);

const formatProjection = (p) => ({
  id: p.id,
  planId: p.planId,
  planName: p.plan?.name || "Unknown",
  date: p.date,
  threeDay: p.threeDay !== null ? round2(Number(p.threeDay)) : null,
  oneWeek: p.oneWeek !== null ? round2(Number(p.oneWeek)) : null,
  oneMonth: p.oneMonth !== null ? round2(Number(p.oneMonth)) : null,
  oneYear: p.oneYear !== null ? round2(Number(p.oneYear)) : null
});

/* =====================================================
   GET /api/projections  (list + plans for dropdowns)
===================================================== */
exports.getProjections = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { planId } = req.query;

    const [projections, plans] = await Promise.all([
      prisma.projection.findMany({
        where: { userId, ...(planId ? { planId } : {}) },
        include: { plan: true },
        orderBy: { date: "desc" }
      }),
      prisma.plan.findMany({ where: { userId }, orderBy: { name: "asc" } })
    ]);

    res.json({
      success: true,
      count: projections.length,
      projections: projections.map(formatProjection),
      plans: plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   GET /api/projections/summary  (totals of latest per plan)
===================================================== */
exports.getProjectionSummary = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const projections = await prisma.projection.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { date: "desc" }
    });

    const latestByPlan = {};
    projections.forEach((p) => {
      if (!latestByPlan[p.planId]) latestByPlan[p.planId] = p;
    });
    const latest = Object.values(latestByPlan);

    const sum = (field) => round2(latest.reduce((s, p) => s + Number(p[field] || 0), 0));

    res.json({
      success: true,
      summary: {
        threeDay: sum("threeDay"),
        oneWeek: sum("oneWeek"),
        oneMonth: sum("oneMonth"),
        oneYear: sum("oneYear")
      },
      perPlan: latest.map(formatProjection)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   GET /api/projections/auto  — THE AUTO ENGINE (owner's rule)
   1-Month = billable (Active+Expired) × price · 1-Year = ×12
   3-Day & 1-Week = renewals (expiry dates) due inside the window
===================================================== */
exports.getAutoProjections = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const auto = await computeAutoProjections(prisma, userId);

    res.json({
      success: true,
      explanation:
        "1-Month = billable (Active+Expired) × price · 1-Year = ×12 · 3-Day & 1-Week = renewals due inside the window.",
      counts: auto.counts,
      totals: auto.totals,
      perPlan: auto.perPlan,
      renewalBook: auto.renewalBook,
      manualCount: auto.manualCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   POST /api/projections  (upsert per plan + date)
===================================================== */
exports.createProjection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { planId, date, threeDay, oneWeek, oneMonth, oneYear } = req.body;

    if (!planId || !date || isNaN(Date.parse(date))) {
      return res.status(400).json({ error: "A valid planId and date are required." });
    }

    const plan = await prisma.plan.findFirst({ where: { id: planId, userId } });
    if (!plan) return res.status(404).json({ error: "Plan not found." });

    const data = {
      threeDay: cleanNumber(threeDay),
      oneWeek: cleanNumber(oneWeek),
      oneMonth: cleanNumber(oneMonth),
      oneYear: cleanNumber(oneYear)
    };

    const projection = await prisma.projection.upsert({
      where: { userId_planId_date: { userId, planId, date: new Date(date) } },
      update: data,
      create: { userId, planId, date: new Date(date), ...data },
      include: { plan: true }
    });

    res.status(201).json({
      success: true,
      message: "Projection saved.",
      projection: formatProjection(projection)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   PATCH /api/projections/:id  (his routes use PATCH!)
===================================================== */
exports.updateProjection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const existing = await prisma.projection.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!existing) return res.status(404).json({ error: "Projection not found." });

    const { threeDay, oneWeek, oneMonth, oneYear, date, planId } = req.body;
    const data = {};
    if (threeDay !== undefined) data.threeDay = cleanNumber(threeDay);
    if (oneWeek !== undefined) data.oneWeek = cleanNumber(oneWeek);
    if (oneMonth !== undefined) data.oneMonth = cleanNumber(oneMonth);
    if (oneYear !== undefined) data.oneYear = cleanNumber(oneYear);
    if (date && !isNaN(Date.parse(date))) data.date = new Date(date);
    if (planId) data.planId = planId;

    const updated = await prisma.projection.update({
      where: { id: existing.id },
      data,
      include: { plan: true }
    });

    res.json({
      success: true,
      message: "Projection updated.",
      projection: formatProjection(updated)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   DELETE /api/projections/:id
===================================================== */
exports.deleteProjection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const existing = await prisma.projection.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!existing) return res.status(404).json({ error: "Projection not found." });

    await prisma.projection.delete({ where: { id: existing.id } });

    res.json({ success: true, message: "Projection deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};