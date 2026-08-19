const prisma = require("../config/database");

const getUserId = (req) => {
  return (
    req.user?.id ||
    req.user?.userId ||
    req.headers["x-user-id"] ||
    process.env.DEFAULT_USER_ID
  );
};

const round2 = (n) => Math.round(n * 100) / 100;

const PROJECTION_FIELDS = {
  daily: "threeDay",
  weekly: "oneWeek",
  monthly: "oneMonth"
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const requested = (req.query.timeframe || "monthly").toLowerCase();
    const timeframe = PROJECTION_FIELDS[requested] ? requested : "monthly";
    const projectionField = PROJECTION_FIELDS[timeframe];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const [customers, paymentsThisMonth, projections] = await Promise.all([
      prisma.customer.findMany({ where: { userId }, include: { plan: true } }),
      prisma.payment.findMany({
        where: { userId, paymentDate: { gte: startOfMonth, lte: endOfMonth } }
      }),
      prisma.projection.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { date: "desc" }
      })
    ]);

    /* Latest projection per plan = the user's current expectation */
    const latestByPlan = {};
    projections.forEach((p) => {
      if (!latestByPlan[p.planId]) latestByPlan[p.planId] = p;
    });
    const latestProjections = Object.values(latestByPlan);

    /* ---- Cards (widgets 2–5) ---- */
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(
      (c) => c.status === "ACTIVE" && new Date(c.expiryDate) >= now
    ).length;

    const receivedThisMonth = round2(
      paymentsThisMonth.reduce((s, p) => s + Number(p.amount), 0)
    );

    const monthlyProjection = round2(
      latestProjections.reduce((s, p) => s + Number(p.oneMonth || 0), 0)
    );

    const totalProjection = round2(
      latestProjections.reduce((s, p) => s + Number(p[projectionField] || 0), 0)
    );

    const projectionPercentage =
      monthlyProjection > 0 ? Math.round((receivedThisMonth / monthlyProjection) * 100) : 0;

    let avgPaymentSpeed = 0;
    if (paymentsThisMonth.length > 0) {
      const totalDays = paymentsThisMonth.reduce(
        (s, p) => s + new Date(p.paymentDate).getDate(), 0
      );
      avgPaymentSpeed = Math.round(totalDays / paymentsThisMonth.length);
    }

    /* ---- Plan Summary + Distribution (widgets 6 & 8) ---- */
    const planMap = {};
    customers.forEach((c) => {
      const planName = c.plan?.name || "Unknown";
      if (!planMap[planName]) planMap[planName] = { planName, total: 0, paid: 0, unpaid: 0 };
      planMap[planName].total++;
      const hasPaid = paymentsThisMonth.some((p) => p.customerId === c.id);
      if (hasPaid) planMap[planName].paid++;
      else if (c.status === "ACTIVE") planMap[planName].unpaid++;
    });

    latestProjections.forEach((p) => {
      const planName = p.plan?.name || "Unknown";
      if (!planMap[planName]) planMap[planName] = { planName, total: 0, paid: 0, unpaid: 0 };
      planMap[planName].projected = round2(Number(p[projectionField] || 0));
    });

    const planSummary = Object.values(planMap).map((d) => ({
      planName: d.planName,
      total: d.total,
      paid: d.paid,
      unpaid: d.unpaid,
      paymentRate: d.total > 0 ? `${Math.round((d.paid / d.total) * 100)}%` : "0%",
      projected: d.projected || 0
    }));

    const planDistribution = planSummary.map((d) => ({
      plan: d.planName,
      customers: d.total,
      percentage: totalCustomers > 0 ? Math.round((d.total / totalCustomers) * 100) : 0,
      projected: d.projected
    }));

    /* ---- Expiring Soon (widget 9) ---- */
    const expiringSoon = customers
      .filter((c) => {
        const exp = new Date(c.expiryDate);
        return c.status === "ACTIVE" && exp > endOfToday && exp <= in5Days;
      })
      .map((c) => ({
        customer: c.name,
        plan: c.plan?.name,
        expiryDate: c.expiryDate,
        daysLeft: Math.ceil((new Date(c.expiryDate) - now) / (1000 * 60 * 60 * 24)),
        status: "Active"
      }));

    /* ---- Today's Expirations (widget 10) ---- */
    const todaysExpirations = customers
      .filter((c) => {
        const exp = new Date(c.expiryDate);
        return exp >= startOfToday && exp <= endOfToday;
      })
      .map((c) => ({
        customer: c.name,
        plan: c.plan?.name,
        expiryDate: c.expiryDate,
        status: new Date(c.expiryDate) < now ? "Expired" : "Active"
      }));

    res.json({
      timeframe,
      totalCustomers,
      activeCustomers,
      monthlyProjection,
      totalProjection,
      receivedThisMonth,
      projectionPercentage,
      avgPaymentSpeed,
      planSummary,
      planDistribution,
      expiringSoon,
      todaysExpirations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};