const prisma = require("../config/database");

const getUserId = (req) =>
  req.user?.id ||
  req.user?.userId ||
  req.headers["x-user-id"] ||
  process.env.DEFAULT_USER_ID;

/* =====================================================
   GET /api/settings — returns settings (creates default)
===================================================== */
exports.getSettings = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    let settings = await prisma.settings.findUnique({ where: { userId } });
    if (!settings) settings = await prisma.settings.create({ data: { userId } });

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   PUT /api/settings — save general preferences
===================================================== */
exports.updateSettings = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { workspaceName, darkMode, language, notifications, currency } = req.body;
    const data = {};
    if (workspaceName !== undefined) data.workspaceName = workspaceName;
    if (darkMode !== undefined) data.darkMode = Boolean(darkMode);
    if (language !== undefined) data.language = language;
    if (notifications !== undefined) data.notifications = Boolean(notifications);
    if (currency !== undefined) data.currency = currency;

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    });

    res.json({ success: true, message: "Settings saved.", settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   GET /api/settings/plans — ALL plans (active + archived)
===================================================== */
exports.getPlans = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const plans = await prisma.plan.findMany({ where: { userId }, orderBy: { name: "asc" } });

    res.json({
      success: true,
      plans,
      count: plans.filter((p) => p.status === "ACTIVE").length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   PUT /api/settings/plans/:id — edit price/name
   💥 Cascades the new price to existing customers so it
      reflects on Customers, Payments, Projections, Reports
===================================================== */
exports.updatePlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const existing = await prisma.plan.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: "Plan not found." });

    const { price, name, durationDays } = req.body;
    const data = {};

    if (price !== undefined) {
      const p = Number(price);
      if (isNaN(p) || p <= 0) return res.status(400).json({ error: "Price must be a positive number." });
      data.price = p;
    }
    if (name !== undefined && String(name).trim()) data.name = String(name).trim();
    if (durationDays !== undefined) data.durationDays = Number(durationDays) || 30;

    const plan = await prisma.plan.update({ where: { id: existing.id }, data });

    // 💥 Price increase/decrease now applies to existing customers on this plan
    if (data.price !== undefined) {
      await prisma.customer.updateMany({
        where: { planId: existing.id },
        data: { amount: data.price }
      });
    }

    res.json({
      success: true,
      message: "Plan updated — new price now live across Customers, Payments, Projections & Reports.",
      plan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   POST /api/settings/plans — add a new plan
===================================================== */
exports.createPlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { name, price, durationDays } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Plan name is required." });
    const p = Number(price);
    if (isNaN(p) || p <= 0) return res.status(400).json({ error: "Price must be a positive number." });

    const exists = await prisma.plan.findFirst({ where: { userId, name: String(name).trim() } });
    if (exists) return res.status(409).json({ error: "A plan with this name already exists." });

    const plan = await prisma.plan.create({
      data: {
        userId,
        name: String(name).trim(),
        price: p,
        durationDays: Number(durationDays) || 30,
        status: "ACTIVE"
      }
    });

    res.status(201).json({ success: true, message: "Plan created.", plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   DELETE /api/settings/plans/:id — PERMANENTLY DELETE
   🔥 Cascades: removes ALL customers, payments, projections
      on this plan, then the plan itself. Gone forever.
===================================================== */
exports.deletePlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const plan = await prisma.plan.findFirst({ where: { id: req.params.id, userId } });
    if (!plan) return res.status(404).json({ error: "Plan not found." });

    // Count related data before deletion (for the confirmation message)
    const customerCount = await prisma.customer.count({ where: { planId: plan.id } });
    const paymentCount = await prisma.payment.count({ where: { planId: plan.id } });
    const projectionCount = await prisma.projection.count({ where: { planId: plan.id } });

    // CASCADE DELETE in a single transaction (all-or-nothing)
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { planId: plan.id } }),
      prisma.projection.deleteMany({ where: { planId: plan.id } }),
      prisma.customer.deleteMany({ where: { planId: plan.id } }),
      prisma.plan.delete({ where: { id: plan.id } })
    ]);

    const parts = [];
    if (customerCount) parts.push(`${customerCount} customer(s)`);
    if (paymentCount) parts.push(`${paymentCount} payment(s)`);
    if (projectionCount) parts.push(`${projectionCount} projection(s)`);

    res.json({
      success: true,
      message: `🗑️ Plan "${plan.name}" deleted permanently.` +
        (parts.length ? ` Also removed ${parts.join(", ")}.` : '')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};