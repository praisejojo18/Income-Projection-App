const prisma = require('../config/database');
const Customer = require('../models/Customer');
const { validateCustomerData } = require('../utils/validators');

// Helper to calculate the "Display Status" (Active, Expired, Inactive)
const calculateStatus = (customer) => {
  if (customer.status === 'INACTIVE') return 'Inactive';
  const now = new Date();
  const expiry = new Date(customer.expiryDate);
  return expiry < now ? 'Expired' : 'Active';
};

// 1. GET ALL CUSTOMERS (With Filters)
exports.getCustomers = async (req, res) => {
  try {
    const { plan, status, search } = req.query;
    let whereClause = {};

    if (plan) whereClause.planId = parseInt(plan);
    if (search) whereClause.name = { contains: search };

    // Status filtering logic based on our previous agreement
    if (status === 'Active') {
      whereClause.status = 'ACTIVE';
      whereClause.expiryDate = { gte: new Date() };
    } else if (status === 'Expired') {
      whereClause.status = 'ACTIVE';
      whereClause.expiryDate = { lt: new Date() };
    } else if (status === 'Inactive') {
      whereClause.status = 'INACTIVE';
    }

    const customers = await Customer.findMany({
      where: whereClause,
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    // Format data for the frontend
    const formatted = customers.map(c => ({ ...c, displayStatus: calculateStatus(c) }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. GET SINGLE CUSTOMER
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { plan: true }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    res.json({ ...customer, displayStatus: calculateStatus(customer) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. CREATE CUSTOMER
exports.createCustomer = async (req, res) => {
  try {
    const { isValid, errors } = validateCustomerData(req.body);
    if (!isValid) return res.status(400).json({ errors });

    const newCustomer = await Customer.create({
      data: {
        name: req.body.name,
        email: req.body.email || null,
        phone: req.body.phone || null,
        address: req.body.address || null,
        amount: parseFloat(req.body.amount),
        expiryDate: new Date(req.body.expiryDate),
        planId: parseInt(req.body.planId),
        status: 'ACTIVE'
      },
      include: { plan: true }
    });

    res.status(201).json({ ...newCustomer, displayStatus: calculateStatus(newCustomer) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. UPDATE CUSTOMER
exports.updateCustomer = async (req, res) => {
  try {
    const updated = await Customer.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        amount: req.body.amount ? parseFloat(req.body.amount) : undefined,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
        planId: req.body.planId ? parseInt(req.body.planId) : undefined
      },
      include: { plan: true }
    });
    
    res.json({ ...updated, displayStatus: calculateStatus(updated) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. EXTEND SERVICE (With optional Payment recording)
exports.extendService = async (req, res) => {
  try {
    const { id } = req.params;
    const { extensionType, extensionValue, recordPayment, paymentMethod, paymentReference } = req.body;

    const customer = await Customer.findUnique({ where: { id: parseInt(id) }, include: { plan: true } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Calculate new expiry date
    let currentExpiry = new Date(customer.expiryDate);
    if (currentExpiry < new Date()) currentExpiry = new Date(); // If expired, extend from today

    if (extensionType === 'days') currentExpiry.setDate(currentExpiry.getDate() + parseInt(extensionValue));
    if (extensionType === 'weeks') currentExpiry.setDate(currentExpiry.getDate() + (parseInt(extensionValue) * 7));
    if (extensionType === 'months') currentExpiry.setMonth(currentExpiry.getMonth() + parseInt(extensionValue));

    // Use transaction if recording payment
    if (recordPayment) {
       await prisma.$transaction(async (tx) => {
          await tx.customer.update({ where: { id: parseInt(id) }, data: { expiryDate: currentExpiry } });
          
          // This relies on your colleague's Payment schema
          await tx.payment.create({
             data: {
                amount: customer.plan.amount,
                paymentDate: new Date(),
                status: 'SUCCESS',
                method: paymentMethod || 'Cash',
                reference: paymentReference || `EXT-${Date.now()}`,
                customerId: parseInt(id),
                planId: customer.planId
             }
          });
       });
    } else {
       await Customer.update({ where: { id: parseInt(id) }, data: { expiryDate: currentExpiry } });
    }

    const updatedCustomer = await Customer.findUnique({ where: { id: parseInt(id) }, include: { plan: true } });
    res.json({ message: 'Service extended successfully', customer: { ...updatedCustomer, displayStatus: calculateStatus(updatedCustomer) } });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. CHANGE PLAN
exports.changePlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await prisma.plan.findUnique({ where: { id: parseInt(planId) } });
    if (!plan) return res.status(404).json({ error: 'New plan not found' });

    const updated = await Customer.update({
      where: { id: parseInt(req.params.id) },
      data: {
        planId: parseInt(planId),
        amount: plan.amount // Update amount immediately as agreed
      },
      include: { plan: true }
    });

    res.json({ message: 'Plan changed successfully', customer: { ...updated, displayStatus: calculateStatus(updated) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. DEACTIVATE CUSTOMER
exports.deactivateCustomer = async (req, res) => {
  try {
    const updated = await Customer.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'INACTIVE' },
      include: { plan: true }
    });

    res.json({ message: 'Customer deactivated', customer: { ...updated, displayStatus: calculateStatus(updated) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};