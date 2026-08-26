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

/* =====================================================
   MONTHLY INCOME  (GET /api/actual/monthly-income)
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
      totalReceived: round2(p.totalReceived)
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
   PROJECTION VS ACTUAL — AUTO MODEL (owner's rule)
   Projection = billable customers (ACTIVE + EXPIRED) × plan price,
                scaled by timeframe
   Actual     = payments received inside the period window
                (every recorded payment adds automatically)
   INACTIVE   = left the service completely → excluded
===================================================== */
/* =====================================================
   PROJECTION VS ACTUAL — Uses AUTO ENGINE + PAYMENTS
   Projection = AUTO engine (with manual overrides)
   Actual = real payments in the window
===================================================== */
exports.getProjectionVsActual = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const requested = (req.query.timeframe || "monthly").toLowerCase();
    const timeframe = ["daily", "weekly", "monthly", "annually"].includes(requested)
      ? requested
      : "monthly";
    const planFilter = req.query.planId;

    const now = new Date();
    const { computeAutoProjections } = require("../utils/autoProjection");

    // Get AUTO projections (includes manual overrides)
    const auto = await computeAutoProjections(prisma, userId);

    // Calculate payment window
    let windowStart, windowEnd, periodLabel;
    if (timeframe === "daily") {
      windowStart = new Date(now.getTime() - 3 * 86400000);
      windowEnd = now;
      periodLabel = "Last 3 days";
    } else if (timeframe === "weekly") {
      windowStart = new Date(now.getTime() - 7 * 86400000);
      windowEnd = now;
      periodLabel = "Last 7 days";
    } else if (timeframe === "monthly") {
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
      windowEnd = now;
      periodLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    } else {
      windowStart = new Date(now.getFullYear(), 0, 1);
      windowEnd = now;
      periodLabel = String(now.getFullYear());
    }

    // Fetch payments in window
    const payments = await prisma.payment.findMany({
      where: {
        userId,
        ...(planFilter ? { planId: planFilter } : {}),
        paymentDate: { gte: windowStart, lte: windowEnd }
      }
    });

    // Group actual payments by plan
    const actualByPlan = {};
    payments.forEach((p) => {
      actualByPlan[p.planId] = (actualByPlan[p.planId] || 0) + Number(p.amount);
    });

    // Build rows from AUTO engine data
    const rows = auto.perPlan
      .filter((p) => !planFilter || p.planId === planFilter)
      .map((p) => {
        const projection = timeframe === "daily" ? p.threeDay :
                          timeframe === "weekly" ? p.oneWeek :
                          timeframe === "monthly" ? p.oneMonth : p.oneYear;
        const actual = actualByPlan[p.planId] || 0;
        const variance = round2(actual - projection);
        const accuracy = projection > 0 ? Math.min(100, (actual / projection) * 100) : (actual > 0 ? 100 : 0);

        let status;
        if (accuracy >= 100) status = "Achieved";
        else if (accuracy >= 80) status = "On Track";
        else if (actual > 0) status = "Below Target";
        else status = "In Progress";

        return {
          period: periodLabel,
          plan: p.planName,
          customers: p.billableCustomers,
          projection: round2(projection),
          actual: round2(actual),
          variance,
          accuracy: round2(accuracy),
          status
        };
      })
      .filter((r) => r.projection > 0 || r.actual > 0);

    rows.sort((a, b) => b.projection - a.projection);

    // Summary
    const totalProjected = round2(rows.reduce((s, r) => s + r.projection, 0));
    const totalActual = round2(rows.reduce((s, r) => s + r.actual, 0));
    const totalVariance = round2(totalActual - totalProjected);
    const overallAccuracy = totalProjected > 0 ? Math.min(100, (totalActual / totalProjected) * 100) : 0;

    // Chart data
    const chart = rows.map((r) => ({
      period: r.plan,
      projection: r.projection,
      actual: r.actual
    }));

    // Plans list for filter dropdown
    const plans = await prisma.plan.findMany({ where: { userId } });

    res.json({
      timeframe,
      timeframeLabel: periodLabel,
      summary: {
        totalProjected,
        totalActual,
        variance: totalVariance,
        accuracy: round2(overallAccuracy)
      },
      chart,
      rows,
      plans: plans.map((p) => ({ id: p.id, name: p.name }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};