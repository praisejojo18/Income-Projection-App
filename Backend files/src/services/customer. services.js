const prisma = require("../lib/prisma");

// Helper: Calculate Display Status based on rules we agreed on
const getDisplayStatus = (customer) => {
  if (customer.status === "INACTIVE") return "Inactive";
  const now = new Date();
  const expiry = new Date(customer.expiryDate);
  return expiry < now ? "Expired" : "Active";
};

// 1. Get All Customers (with filters)
const getAllCustomers = async (filters) => {
  const { planId, status, search } = filters;
  const where = {};

  if (planId) where.planId = parseInt(planId);
  
  // Search by name, email, or phone
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } }
    ];
  }

  // Note: We filter by database status (ACTIVE/INACTIVE)
  // "Expired" is calculated on the fly in the map function below
  if (status && status !== "Expired") {
    where.status = status.toUpperCase(); 
  }

  const customers = await prisma.customer.findMany({
    where,
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });

  // Format response and calculate "Expired" status
  return customers.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    amount: c.amount,
    expiryDate: c.expiryDate,
    planName: c.plan.name,
    status: getDisplayStatus(c) // Returns Active, Expired, or Inactive
  }));
};

// 2. Get Single Customer
const getCustomerById = async (id) => {
  const customer = await prisma.customer.findUnique({
    where: { id: parseInt(id) },
    include: { plan: true }
  });
  if (!customer) throw new Error("Customer not found");
  
  return { ...customer, displayStatus: getDisplayStatus(customer) };
};

// 3. Create Customer
const createCustomer = async (data) => {
  return prisma.customer.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      amount: parseFloat(data.amount),
      expiryDate: new Date(data.expiryDate),
      planId: parseInt(data.planId),
      status: "ACTIVE"
    },
    include: { plan: true }
  });
};

// 4. Extend Service (With or Without Payment)
const extendService = async (id, data) => {
  const { days, weeks, months, payment } = data;
  const customer = await prisma.customer.findUnique({ where: { id: parseInt(id) } });
  if (!customer) throw new Error("Customer not found");

  // Calculate new expiry date
  // If expired, start extending from today. If active, extend from current expiry.
  const now = new Date();
  let baseDate = new Date(customer.expiryDate) > now ? new Date(customer.expiryDate) : now;

  if (days) baseDate.setDate(baseDate.getDate() + parseInt(days));
  if (weeks) baseDate.setDate(baseDate.getDate() + (parseInt(weeks) * 7));
  if (months) baseDate.setMonth(baseDate.getMonth() + parseInt(months));

  const updateData = { expiryDate: baseDate, status: "ACTIVE" };

  // If payment data is provided, create payment AND extend in a transaction
  if (payment && payment.amount > 0) {
    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({ where: { id: parseInt(id) }, data: updateData }),
      prisma.payment.create({
        data: {
          amount: parseFloat(payment.amount),
          method: payment.method || "Cash",
          status: "SUCCESS",
          customerId: parseInt(id),
          planId: customer.planId // Records the plan they paid for
        }
      })
    ]);
    return updatedCustomer;
  }

  // Just extend without payment
  return prisma.customer.update({ where: { id: parseInt(id) }, data: updateData });
};

// 5. Change Plan (Updates amount immediately)
const changePlan = async (id, newPlanId) => {
  const newPlan = await prisma.plan.findUnique({ where: { id: parseInt(newPlanId) } });
  if (!newPlan) throw new Error("New plan not found");

  return prisma.customer.update({
    where: { id: parseInt(id) },
    data: {
      planId: parseInt(newPlanId),
      amount: newPlan.amount // Automatically updates amount
    },
    include: { plan: true }
  });
};

// 6. Deactivate Customer
const deactivateCustomer = async (id) => {
  return prisma.customer.update({
    where: { id: parseInt(id) },
    data: { status: "INACTIVE" }
  });
};

module.exports = {
  getAllCustomers, getCustomerById, createCustomer,
  extendService, changePlan, deactivateCustomer
};