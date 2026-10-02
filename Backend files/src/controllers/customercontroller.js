const prisma = require("../config/database");
const {
  validateCustomerData,
  validateExtendData
} = require("../utils/validators");

const getUserId = (req) => {
  return (
    req.userId ||
    req.user?.id ||
    req.user?.userId ||
    req.headers["x-user-id"] ||
    process.env.DEFAULT_USER_ID
  );
};

const getDisplayStatus = (customer) => {
  if (customer.status === "INACTIVE") return "Inactive";
  const now = new Date();
  const expiryDate = new Date(customer.expiryDate);
  return expiryDate < now ? "Expired" : "Active";
};

const normalizeStoredStatus = (expiryDate, currentStatus) => {
  if (currentStatus === "INACTIVE") return "INACTIVE";
  const now = new Date();
  const expiry = new Date(expiryDate);
  return expiry < now ? "EXPIRED" : "ACTIVE";
};

const formatCustomer = (customer) => {
  return {
    ...customer,
    amount: customer.plan?.price || null,
    displayStatus: getDisplayStatus(customer)
  };
};

/* GET /api/customers */
exports.getCustomers = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { plan, status, search } = req.query;
    const where = { userId };

    if (plan) where.planId = plan;
    if (search) where.name = { contains: search };

    const now = new Date();
    if (status) {
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus === "active") {
        where.status = "ACTIVE";
        where.expiryDate = { gte: now };
      } else if (normalizedStatus === "expired") {
        where.OR = [
          { status: "EXPIRED" },
          { status: "ACTIVE", expiryDate: { lt: now } }
        ];
      } else if (normalizedStatus === "inactive") {
        where.status = "INACTIVE";
      }
    }

    const customers = await prisma.customer.findMany({
      where,
      include: { plan: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(customers.map(formatCustomer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* GET /api/customers/:id */
exports.getCustomerById = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, userId },
      include: { plan: true }
    });

    if (!customer) return res.status(404).json({ error: "Customer not found." });
    res.json(formatCustomer(customer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* POST /api/customers */
exports.createCustomer = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { isValid, errors } = validateCustomerData(req.body);
    if (!isValid) return res.status(400).json({ errors });

    const plan = await prisma.plan.findFirst({
      where: { id: req.body.planId, userId, status: "ACTIVE" }
    });

    if (!plan) return res.status(404).json({ error: "Active plan not found." });

    const expiryDate = new Date(req.body.expiryDate);
    const status = normalizeStoredStatus(expiryDate, req.body.status || "ACTIVE");

    const newCustomer = await prisma.customer.create({
      data: {
        userId,
        name: req.body.name,
        email: req.body.email || null,
        phone: req.body.phone || null,
        externalId: req.body.externalId || null,
        planId: req.body.planId,
        expiryDate,
        status
      },
      include: { plan: true }
    });

    res.status(201).json(formatCustomer(newCustomer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* PUT /api/customers/:id */
exports.updateCustomer = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { isValid, errors } = validateCustomerData(req.body, { isUpdate: true });
    if (!isValid) return res.status(400).json({ errors });

    const existingCustomer = await prisma.customer.findFirst({
      where: { id: req.params.id, userId }
    });

    if (!existingCustomer) return res.status(404).json({ error: "Customer not found." });

    if (req.body.planId) {
      const plan = await prisma.plan.findFirst({
        where: { id: req.body.planId, userId, status: "ACTIVE" }
      });
      if (!plan) return res.status(404).json({ error: "Active plan not found." });
    }

    const updatedExpiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : existingCustomer.expiryDate;
    const updatedStatus = normalizeStoredStatus(updatedExpiryDate, req.body.status || existingCustomer.status);

    const updatedCustomer = await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        externalId: req.body.externalId || null,
        planId: req.body.planId,
        expiryDate: updatedExpiryDate,
        status: updatedStatus
      },
      include: { plan: true }
    });

    res.json(formatCustomer(updatedCustomer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* POST /api/customers/:id/extend */
exports.extendService = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { isValid, errors } = validateExtendData(req.body);
    if (!isValid) return res.status(400).json({ errors });

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, userId },
      include: { plan: true }
    });

    if (!customer) return res.status(404).json({ error: "Customer not found." });

    if (customer.status === "INACTIVE") {
      return res.status(400).json({ error: "Cannot extend an inactive customer." });
    }

    const {
      newExpiryDate, extensionType, extensionValue,
      recordPayment, paymentMethod, paymentReference, paymentAmount
    } = req.body;

    let targetExpiry;
    if (newExpiryDate) {
      targetExpiry = new Date(newExpiryDate);
    } else {
      const base = new Date(customer.expiryDate);
      const now = new Date();
      targetExpiry = base > now ? base : now;
      const value = Number(extensionValue);
      if (extensionType === "days") targetExpiry.setDate(targetExpiry.getDate() + value);
      if (extensionType === "weeks") targetExpiry.setDate(targetExpiry.getDate() + value * 7);
      if (extensionType === "months") targetExpiry.setMonth(targetExpiry.getMonth() + value);
    }

    const generatedReference = paymentReference || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const amountToCharge = paymentAmount !== undefined ? Number(paymentAmount) : Number(customer.plan.price);

    if (recordPayment) {
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customer.id },
          data: { expiryDate: targetExpiry, status: normalizeStoredStatus(targetExpiry, customer.status) }
        }),
        prisma.payment.create({
          data: {
            userId, customerId: customer.id, planId: customer.planId,
            amount: amountToCharge, paymentDate: new Date(),
            method: paymentMethod || "CASH", reference: generatedReference
          }
        })
      ]);
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { expiryDate: targetExpiry, status: normalizeStoredStatus(targetExpiry, customer.status) }
      });
    }

    const updatedCustomer = await prisma.customer.findFirst({
      where: { id: customer.id },
      include: { plan: true }
    });

    res.json({
      message: "Customer service extended successfully.",
      previousExpiry: customer.expiryDate,
      newExpiry: updatedCustomer.expiryDate,
      customer: formatCustomer(updatedCustomer)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* POST /api/customers/:id/change-plan */
exports.changePlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const { planId } = req.body;
    if (!planId || typeof planId !== "string") return res.status(400).json({ error: "A valid planId is required." });

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, userId } });
    if (!customer) return res.status(404).json({ error: "Customer not found." });

    const newPlan = await prisma.plan.findFirst({ where: { id: planId, userId, status: "ACTIVE" } });
    if (!newPlan) return res.status(404).json({ error: "Active plan not found." });

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { planId: newPlan.id },
      include: { plan: true }
    });

    res.json({ message: "Customer plan changed successfully.", customer: formatCustomer(updatedCustomer) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* POST /api/customers/:id/deactivate */
exports.deactivateCustomer = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, userId } });
    if (!customer) return res.status(404).json({ error: "Customer not found." });

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { status: "INACTIVE" },
      include: { plan: true }
    });

    res.json({ message: "Customer deactivated successfully.", customer: formatCustomer(updatedCustomer) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* GET /api/customers/plans */
exports.getUserPlans = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const plans = await prisma.plan.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { name: "asc" }
    });

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* DELETE /api/customers/all — 🛡️ SUPER_ADMIN ONLY: wipe ALL customers + payments */
exports.deleteAllCustomers = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    // 🛡️ ADMIN LOCK — only SUPER_ADMIN may wipe data
    const realId = req.realUserId || userId;
    const realUser = await prisma.user.findUnique({ where: { id: realId } });
    if (!realUser || realUser.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Admin privileges required to delete all customers." });
    }

    const customerCount = await prisma.customer.count({ where: { userId } });
    const paymentCount = await prisma.payment.count({ where: { userId } });

    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { userId } }),
      prisma.customer.deleteMany({ where: { userId } })
    ]);

    res.json({
      success: true,
      message: `🗑️ Deleted ${customerCount} customer(s) and ${paymentCount} payment(s). Ready for fresh import.`
    });
  } catch (error) {
    console.error('deleteAllCustomers error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/* DELETE /api/customers/:id — delete single customer */
exports.deleteCustomer = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "User ID is required." });

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, userId } });
    if (!customer) return res.status(404).json({ error: "Customer not found." });

    const paymentCount = await prisma.payment.count({ where: { customerId: customer.id } });

    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { customerId: customer.id } }),
      prisma.customer.delete({ where: { id: customer.id } })
    ]);

    res.json({
      success: true,
      message: `🗑️ Customer "${customer.name}" deleted.` +
        (paymentCount ? ` Also removed ${paymentCount} payment(s).` : '')
    });
  } catch (error) {
    console.error('deleteCustomer error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/* GET /api/customers/me/role — safe role checker */
exports.getMyRole = async (req, res) => {
  try {
    const realId = req.realUserId || getUserId(req);
    if (!realId) return res.json({ role: "USER", userId: null });

    const user = await prisma.user.findUnique({
      where: { id: realId },
      select: { role: true }
    });

    res.json({
      role: user ? user.role : "USER",
      userId: realId
    });
  } catch (error) {
    console.error("getMyRole error:", error.message);
    res.status(500).json({ error: error.message });
  }
};