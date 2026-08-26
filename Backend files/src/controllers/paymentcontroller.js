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

/* Pretty method names for frontend display */
const METHOD_DISPLAY = {
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  POS: "POS"
};

const toMethodEnum = (str) => {
  if (!str) return "CASH";
  const upper = String(str).toUpperCase().replace(/ /g, "_");
  if (["BANK_TRANSFER", "CASH", "POS"].includes(upper)) return upper;
  return "CASH";
};

/* =====================================================
   GET /api/payments
   Returns all payments (newest first) + summary cards
   + plans list + customers list (for modal dropdowns)
===================================================== */
exports.getPayments = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true } }
      },
      orderBy: { paymentDate: "desc" }
    });

    /* Format each payment row for the frontend table */
    const formatted = payments.map((p) => ({
      id: p.id,
      date: p.paymentDate ? p.paymentDate.toISOString().slice(0, 10) : null,
      paymentDate: p.paymentDate ? p.paymentDate.toISOString().slice(0, 10) : null,
      customer: p.customer?.name || "Unknown",
      customerName: p.customer?.name || "Unknown",
      customerId: p.customerId,
      plan: p.plan?.name || "Unknown",
      planName: p.plan?.name || "Unknown",
      planId: p.planId,
      amount: round2(Number(p.amount)),
      method: METHOD_DISPLAY[p.method] || p.method,
      reference: p.reference || "—"
    }));

    /* Summary card values */
    const total = formatted.reduce((s, p) => s + p.amount, 0);
    const avg = formatted.length > 0 ? total / formatted.length : 0;
    const now = new Date();
    const thisMonthCount = formatted.filter((p) => {
      const d = new Date(p.paymentDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const lastPay = formatted.length > 0 ? formatted[0].amount : 0;

    res.json({
      success: true,
      summary: {
        totalReceived: round2(total),
        paymentsThisMonth: thisMonthCount,
        averagePayment: round2(avg),
        lastPayment: round2(lastPay)
      },
      payments: formatted
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   GET /api/payments/:id
   Returns a single payment's full details
===================================================== */
exports.getPaymentById = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, userId },
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true } }
      }
    });

    if (!payment) return res.status(404).json({ error: "Payment not found." });

    res.json({
      id: payment.id,
      paymentDate: payment.paymentDate ? payment.paymentDate.toISOString().slice(0, 10) : null,
      customerName: payment.customer?.name || "Unknown",
      customerId: payment.customerId,
      planName: payment.plan?.name || "Unknown",
      planId: payment.planId,
      amount: round2(Number(payment.amount)),
      method: METHOD_DISPLAY[payment.method] || payment.method,
      reference: payment.reference || "—"
    });
  } catch (error) {
    console.error("GET /api/payments/:id error:", error);
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   POST /api/payments
   Records a new payment.
   - Auto-generates reference if left blank.
   - Looks up customer by name if customerId is missing.
   - Looks up plan by name if planId is missing.
===================================================== */
exports.createPayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    let { customerId, customerName, planId, planName, amount, paymentDate, method, reference } = req.body;

    amount = Number(amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount must be greater than 0." });
    if (!paymentDate) return res.status(400).json({ error: "Payment date is required." });

    /* Resolve customer: by ID first, then by name */
    if (!customerId && customerName) {
      const cust = await prisma.customer.findFirst({
        where: { userId, name: customerName }
      });
      if (cust) customerId = cust.id;
    }
    if (!customerId) return res.status(400).json({ error: "Customer is required. Please select a valid customer." });

    /* Resolve plan: by ID first, then by name */
    if (!planId && planName) {
      const plan = await prisma.plan.findFirst({
        where: { userId, name: planName }
      });
      if (plan) planId = plan.id;
    }
    if (!planId) return res.status(400).json({ error: "Service Plan is required. Please select a valid plan." });

    /* Auto-generate reference if blank */
    if (!reference) {
      const count = await prisma.payment.count({ where: { userId } });
      reference = "PAY-" + String(count + 1).padStart(5, "0");
    }

    /* Check for duplicate reference */
    const existing = await prisma.payment.findFirst({
      where: { userId, reference }
    });
    if (existing) {
      /* Append timestamp to make it unique */
      reference = reference + "-" + Date.now().toString(36).toUpperCase();
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        customerId,
        planId,
        amount,
        paymentDate: new Date(paymentDate),
        method: toMethodEnum(method),
        reference
      },
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      payment: {
        id: payment.id,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        customerName: payment.customer?.name || "Unknown",
        customerId: payment.customerId,
        planName: payment.plan?.name || "Unknown",
        planId: payment.planId,
        amount: round2(Number(payment.amount)),
        method: METHOD_DISPLAY[payment.method] || payment.method,
        reference: payment.reference
      }
    });
  } catch (error) {
    console.error("POST /api/payments error:", error);
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   PUT /api/payments/:id
   Edit a payment (fix amount, method, date, reference)
===================================================== */
exports.updatePayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!existing) return res.status(404).json({ error: "Payment not found." });

    const { amount, paymentDate, method, reference, planId, customerId } = req.body;

    const updateData = {};
    if (amount !== undefined) {
      const num = Number(amount);
      if (num <= 0) return res.status(400).json({ error: "Amount must be greater than 0." });
      updateData.amount = num;
    }
    if (paymentDate) updateData.paymentDate = new Date(paymentDate);
    if (method) updateData.method = toMethodEnum(method);
    if (reference !== undefined) updateData.reference = reference;
    if (planId) updateData.planId = planId;
    if (customerId) updateData.customerId = customerId;

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true } }
      }
    });

    res.json({
      success: true,
      message: "Payment updated successfully.",
      payment: {
        id: payment.id,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        customerName: payment.customer?.name || "Unknown",
        customerId: payment.customerId,
        planName: payment.plan?.name || "Unknown",
        planId: payment.planId,
        amount: round2(Number(payment.amount)),
        method: METHOD_DISPLAY[payment.method] || payment.method,
        reference: payment.reference
      }
    });
  } catch (error) {
    console.error("PUT /api/payments/:id error:", error);
    res.status(500).json({ error: error.message });
  }
};

/* =====================================================
   DELETE /api/payments/:id
   Remove a payment entry
===================================================== */
exports.deletePayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!existing) return res.status(404).json({ error: "Payment not found." });

    await prisma.payment.delete({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: "Payment deleted successfully."
    });
  } catch (error) {
    console.error("DELETE /api/payments/:id error:", error);
    res.status(500).json({ error: error.message });
  }
};