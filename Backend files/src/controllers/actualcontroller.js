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

const formatMonth = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const formatDay = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;

/* =====================================================
   MONTHLY INCOME (already working, timezone bug fixed)
===================================================== */
exports.getMonthlyIncome = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const requestedMonth = req.query.month;
    let startDate, endDate, prevStartDate, prevEndDate;

    if (requestedMonth) {
      const [year, month] = requestedMonth.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
      prevStartDate = new Date(year, month - 2, 1);
      prevEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    const currentPayments = await prisma.payment.findMany({
      where: { userId, paymentDate: { gte: startDate, lte: endDate } },
      include: { plan: true }
    });

    const prevPayments = await prisma.payment.findMany({
      where: { userId, paymentDate: { gte: prevStartDate, lte: prevEndDate } }
    });

    const totalIncome = currentPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const payingCustomers = new Set(currentPayments.map((p) => p.customerId)).size;
    const averagePayment = currentPayments.length > 0 ? totalIncome / currentPayments.length : 0;

    const prevTotalIncome = prevPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    let vsPreviousMonth = 0;
    if (prevTotalIncome > 0) {
      vsPreviousMonth = ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100;
    } else if (totalIncome > 0) {
      vsPreviousMonth = 100;
    }

    const planMap = {};
    currentPayments.forEach((p) => {
      const planName = p.plan?.name || "Unknown Plan";
      const planPrice = parseFloat(p.plan?.price || 0);
      if (!planMap[planName]) {
        planMap[planName] = {
          planName,
          payingCustomers: new Set(),
          amountPerPlan: planPrice,
          totalReceived: 0
        };
      }
      planMap[planName].payingCustomers.add(p.customerId);
      planMap[planName].totalReceived += parseFloat(p.amount);
    });

    const incomeByPlan = Object.values(planMap).map((p) => ({
      planName: p.planName,
      payingCustomers: p.payingCustomers.size,
      amountPerPlan: p.amountPerPlan,
      totalReceived: p.totalReceived
    }));

    const trendMonths = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthPayments = await prisma.payment.findMany({
        where: { userId, paymentDate: { gte: d, lte: nextD } }
      });

      trendMonths.push({
        month: formatMonth(d),
        income: round2(monthPayments.reduce((s, p) => s + parseFloat(p.amount), 0))
      });
    }

    res.json({
      month: formatMonth(startDate),
      totalIncome: round2(totalIncome),
      payingCustomers,
      averagePayment: round2(averagePayment),
      vsPreviousMonth: round2(vsPreviousMonth),
      incomeByPlan,
      monthlyTrend: trendMonths
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   PROJECTION VS ACTUAL (new — powers the report page)
===================================================== */
const TIMEFRAMES = {
  daily: { field: "threeDay", label: "Daily (3-day)" },
  weekly: { field: "oneWeek", label: "Weekly" },
  monthly: { field: "oneMonth", label: "Monthly" },
  annually: { field: "oneYear", label: "Annually" }
};

const windowEnd = (start, timeframe) => {
  const end = new Date(start);
  if (timeframe === "daily") end.setUTCDate(end.getUTCDate() + 3);
  else if (timeframe === "weekly") end.setUTCDate(end.getUTCDate() + 7);
  else if (timeframe === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end;
};

exports.getProjectionVsActual = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const requested = (req.query.timeframe || "monthly").toLowerCase();
    const timeframe = TIMEFRAMES[requested] ? requested : "monthly";
    const field = TIMEFRAMES[timeframe].field;
    const planFilter = req.query.planId;

    // 1) Projections + all plans (for the "All Plans" dropdown)
    const [projections, allPlans] = await Promise.all([
      prisma.projection.findMany({
        where: { userId, ...(planFilter ? { planId: planFilter } : {}) },
        include: { plan: true },
        orderBy: { date: "asc" }
      }),
      prisma.plan.findMany({ where: { userId }, orderBy: { name: "asc" } })
    ]);

    // 2) Payments fetched once, filtered in memory per projection window
    const payments = await prisma.payment.findMany({
      where: { userId, ...(planFilter ? { planId: planFilter } : {}) }
    });

    const now = new Date();

    // 3) Build one row per projection
    const rows = [];
    projections.forEach((proj) => {
      const projected =
        proj[field] === null || proj[field] === undefined ? null : Number(proj[field]);
      if (projected === null) return; // no value stored for this timeframe

      const start = new Date(proj.date);
      const end = windowEnd(start, timeframe);

      const actual = payments
        .filter(
          (p) => p.planId === proj.planId && p.paymentDate >= start && p.paymentDate < end
        )
        .reduce((s, p) => s + Number(p.amount), 0);

      const variance = actual - projected;
      const accuracy = projected > 0 ? Math.min(100, (actual / projected) * 100) : 0;

      let status;
      if (now < end) status = "In Progress";
      else if (accuracy >= 100) status = "Achieved";
      else if (accuracy >= 80) status = "On Track";
      else status = "Below Target";

      rows.push({
        period: formatDay(start),
        plan: proj.plan?.name || "Unknown Plan",
        projection: round2(projected),
        actual: round2(actual),
        variance: round2(variance),
        accuracy: round2(accuracy),
        status
      });
    });

    // Table rows: newest first
    const tableRows = [...rows].sort((a, b) => (a.period < b.period ? 1 : -1));

    // Chart data: aggregated per period (oldest first) for a grouped BAR chart
    const chartMap = {};
    rows.forEach((r) => {
      if (!chartMap[r.period])
        chartMap[r.period] = { period: r.period, projection: 0, actual: 0 };
      chartMap[r.period].projection = round2(chartMap[r.period].projection + r.projection);
      chartMap[r.period].actual = round2(chartMap[r.period].actual + r.actual);
    });
    const chart = Object.values(chartMap).sort((a, b) =>
      a.period < b.period ? -1 : 1
    );

    // 4) Summary cards
    const totalProjected = rows.reduce((s, r) => s + r.projection, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const totalVariance = totalActual - totalProjected;
    const overallAccuracy =
      totalProjected > 0 ? Math.min(100, (totalActual / totalProjected) * 100) : 0;

    res.json({
      timeframe,
      timeframeLabel: TIMEFRAMES[timeframe].label,
      summary: {
        totalProjected: round2(totalProjected),
        totalActual: round2(totalActual),
        variance: round2(totalVariance),
        accuracy: round2(overallAccuracy)
      },
      chart,
      rows: tableRows,
      plans: allPlans.map((p) => ({ id: p.id, name: p.name })) // 👈 feeds the "All Plans" dropdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};