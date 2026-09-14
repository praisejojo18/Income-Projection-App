const prisma = require("../config/database");

const TOLERANCE = 100; // ±₦100 for rounding

async function analyzePayment(userId, customer, amount, allPlansOverride) {
  if (!customer || !customer.plan || !amount || amount <= 0) {
    return { type: "manual", monthsPaid: null, discountPercent: 0, applyEffect: null };
  }

  const currentPlan = customer.plan;
  const currentPrice = Number(currentPlan.price);
  const dailyRate = currentPrice / 30;

  // Load plans if not provided
  let allPlans = allPlansOverride;
  if (!allPlans) {
    allPlans = await prisma.plan.findMany({ where: { userId, status: "ACTIVE" } });
  }

  // --- TEST 1: Exact 1-month renewal ---
  if (Math.abs(amount - currentPrice) <= TOLERANCE) {
    return {
      type: "renewal",
      monthsPaid: 1,
      discountPercent: 0,
      description: "1-month renewal",
      applyEffect: { addMonths: 1 }
    };
  }

  // --- TEST 2: Multi-month renewal with discount ---
  for (let months = 2; months <= 12; months++) {
    let discount = 0;
    if (months >= 6 && months <= 11) discount = 4;
    if (months === 12) discount = 8;
    const expected = currentPrice * months * (1 - discount / 100);
    if (Math.abs(amount - expected) <= TOLERANCE) {
      return {
        type: "multi_month",
        monthsPaid: months,
        discountPercent: discount,
        description: `${months}-month renewal (${discount}% off)`,
        applyEffect: { addMonths: months }
      };
    }
  }

  // --- TEST 3: Upgrade to higher plan ---
  const now = new Date();
  const expiry = new Date(customer.expiryDate);
  const remainingDays = Math.max(0, Math.ceil((expiry - now) / 86400000));

  for (const plan of allPlans) {
    if (plan.id === currentPlan.id) continue;
    if (Number(plan.price) <= currentPrice) continue; // only upgrades

    const nextDaily = Number(plan.price) / 30;
    const adjustment = (nextDaily - dailyRate) * remainingDays + Number(plan.price);

    if (Math.abs(amount - adjustment) <= TOLERANCE) {
      return {
        type: "upgrade",
        monthsPaid: 1,
        discountPercent: 0,
        newPlanId: plan.id,
        newPlanName: plan.name,
        oldPlanName: currentPlan.name,
        remainingDays,
        adjustment: Math.round(adjustment),
        description: `Upgrade: ${currentPlan.name} → ${plan.name} (${remainingDays}d left)`,
        applyEffect: { changePlanId: plan.id, addMonths: 1 }
      };
    }
  }

  // --- TEST 4: Nothing matched ---
  return {
    type: "manual",
    monthsPaid: null,
    discountPercent: 0,
    description: "Manual (no formula matched)",
    applyEffect: { addMonths: 1 }
  };
}

module.exports = { analyzePayment };