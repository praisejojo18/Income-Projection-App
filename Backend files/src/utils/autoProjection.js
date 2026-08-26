/* ============================================================
   AUTO PROJECTION ENGINE (owner's rule) + MANUAL OVERRIDES
   - 1-Month = billable (ACTIVE + EXPIRED) × plan price
   - 1-Year  = 1-Month × 12
   - 3-Day / 1-Week = renewals (expiry dates) due inside the window
   - pastThreeDay / pastOneWeek = renewals due in the PAST window (for PVA)
   - A saved manual projection (latest per plan) overrides the horizons
============================================================ */

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

async function computeAutoProjections(prisma, userId) {
  const now = new Date();
  const today = startOfDay(now);
  const in3 = new Date(today.getTime() + 3 * 86400000);
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const past3 = new Date(today.getTime() - 3 * 86400000);
  const past7 = new Date(today.getTime() - 7 * 86400000);

  const [customers, saved] = await Promise.all([
    prisma.customer.findMany({ where: { userId }, include: { plan: true } }),
    prisma.projection.findMany({
      where: { userId, date: { lte: now } },
      include: { plan: true },
      orderBy: { date: "desc" }
    })
  ]);

  /* Latest saved manual projection per plan = override */
  const overrideByPlan = {};
  saved.forEach((p) => { if (!overrideByPlan[p.planId]) overrideByPlan[p.planId] = p; });

  /* Per-plan accumulators from live customers */
  const perPlanMap = {};
  customers.forEach((c) => {
    if (!perPlanMap[c.planId]) {
      perPlanMap[c.planId] = {
        planId: c.planId,
        planName: c.plan?.name || "Unknown",
        price: Number(c.plan?.price || 0),
        billable: 0, f3: 0, f7: 0, p3: 0, p7: 0
      };
    }
    const row = perPlanMap[c.planId];
    if (c.status === "ACTIVE" || c.status === "EXPIRED") row.billable += 1;
    const exp = new Date(c.expiryDate);
    if (exp >= today && exp <= in3) row.f3 += row.price;
    if (exp >= today && exp <= in7) row.f7 += row.price;
    if (exp >= past3 && exp < today) row.p3 += row.price;
    if (exp >= past7 && exp < today) row.p7 += row.price;
  });

  /* Build rows — manual override wins where the user typed a value */
  const perPlan = Object.values(perPlanMap).map((r) => {
    const o = overrideByPlan[r.planId];
    return {
      planId: r.planId,
      planName: r.planName,
      price: r.price,
      billableCustomers: r.billable,
      source: o ? "manual" : "auto",
      pastThreeDay: r.p3,
      pastOneWeek: r.p7,
      threeDay: o && o.threeDay != null ? Number(o.threeDay) : r.f3,
      oneWeek: o && o.oneWeek != null ? Number(o.oneWeek) : r.f7,
      oneMonth: o && o.oneMonth != null ? Number(o.oneMonth) : r.billable * r.price,
      oneYear: o && o.oneYear != null ? Number(o.oneYear) : r.billable * r.price * 12
    };
  });

  /* Plans with a manual target but zero customers today */
  Object.values(overrideByPlan).forEach((o) => {
    if (!perPlanMap[o.planId]) {
      perPlan.push({
        planId: o.planId,
        planName: o.plan?.name || "Unknown",
        price: Number(o.plan?.price || 0),
        billableCustomers: 0,
        source: "manual",
        pastThreeDay: 0,
        pastOneWeek: 0,
        threeDay: o.threeDay != null ? Number(o.threeDay) : 0,
        oneWeek: o.oneWeek != null ? Number(o.oneWeek) : 0,
        oneMonth: o.oneMonth != null ? Number(o.oneMonth) : 0,
        oneYear: o.oneYear != null ? Number(o.oneYear) : 0
      });
    }
  });

  const totals = perPlan.reduce(
    (t, p) => ({
      threeDay: t.threeDay + p.threeDay,
      oneWeek: t.oneWeek + p.oneWeek,
      oneMonth: t.oneMonth + p.oneMonth,
      oneYear: t.oneYear + p.oneYear
    }),
    { threeDay: 0, oneWeek: 0, oneMonth: 0, oneYear: 0 }
  );

  const renewalBook = customers
    .filter((c) => c.status === "ACTIVE" || c.status === "EXPIRED")
    .map((c) => ({
      customer: c.name,
      plan: c.plan?.name || "Unknown",
      amount: Number(c.plan?.price || 0),
      expectedDate: c.expiryDate,
      status: c.status === "ACTIVE" ? "Active" : "Expired"
    }))
    .sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));

  const counts = {
    billable: customers.filter((c) => c.status === "ACTIVE" || c.status === "EXPIRED").length,
    active: customers.filter((c) => c.status === "ACTIVE").length,
    expired: customers.filter((c) => c.status === "EXPIRED").length
  };

  return { perPlan, totals, renewalBook, counts, manualCount: Object.keys(overrideByPlan).length };
}

module.exports = { computeAutoProjections };