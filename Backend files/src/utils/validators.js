const { z } = require("zod");

// ==========================================
// SUPERVISOR'S CUSTOM VALIDATORS (Customers)
// ==========================================
const ALLOWED_CUSTOMER_STATUSES = ["ACTIVE", "EXPIRED", "INACTIVE"];
const ALLOWED_PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "POS"];

exports.validateCustomerData = (data, { isUpdate = false } = {}) => {
  const errors = [];

  if (!isUpdate) {
    if (!data.name || data.name.trim() === "") {
      errors.push("Customer name is required.");
    }
    if (!data.planId || typeof data.planId !== "string") {
      errors.push("A valid planId is required.");
    }
    if (!data.expiryDate || isNaN(Date.parse(data.expiryDate))) {
      errors.push("A valid expiryDate is required.");
    }
  }

  if (isUpdate && data.expiryDate && isNaN(Date.parse(data.expiryDate))) {
    errors.push("expiryDate must be a valid date.");
  }

  if (data.status && !ALLOWED_CUSTOMER_STATUSES.includes(data.status)) {
    errors.push("Invalid customer status.");
  }

  return { isValid: errors.length === 0, errors };
};

exports.validateExtendData = (data) => {
  const errors = [];
  const hasDirectDate = !!data.newExpiryDate;
  const hasExtension = !!data.extensionType || !!data.extensionValue;

  if (!hasDirectDate && !hasExtension) {
    errors.push("Provide newExpiryDate (from the modal) or extensionType + extensionValue.");
  }

  if (hasDirectDate && isNaN(Date.parse(data.newExpiryDate))) {
    errors.push("newExpiryDate must be a valid date.");
  }

  if (hasExtension) {
    if (!["days", "weeks", "months"].includes(data.extensionType)) {
      errors.push("extensionType must be days, weeks, or months.");
    }
    const value = Number(data.extensionValue);
    if (!Number.isInteger(value) || value <= 0) {
      errors.push("extensionValue must be a positive whole number.");
    }
  }

  if (data.recordPayment && data.paymentMethod && !ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)) {
    errors.push("paymentMethod must be BANK_TRANSFER, CASH, or POS.");
  }

  return { isValid: errors.length === 0, errors };
};

// ==========================================
// ZOD SCHEMAS: SUPERVISOR'S (Plans)
// ==========================================
exports.planSchemas = {
  create: z.object({
    name: z.string().trim().min(1, "Plan name is required."),
    price: z.coerce.number().positive("Price must be greater than 0."),
    durationDays: z.coerce.number().int().positive("Duration must be a positive whole number."),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  }),
  update: z.object({
    name: z.string().trim().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    durationDays: z.coerce.number().int().positive().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  })
};

// ==========================================
// ZOD SCHEMAS: YOURS (Settings, Payments, Projections)
// ==========================================
exports.settingsSchema = z
  .object({
    workspaceName: z.string().trim().min(1).max(100).optional(),
    darkMode: z.boolean().optional(),
    language: z.string().trim().optional(),
    notifications: z.boolean().optional(),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter code (e.g., NGN)').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const normalizeMethod = (val) =>
  typeof val === 'string' ? val.toUpperCase().replace(/\s+/g, '_') : val;

const methodEnum = z.enum(['BANK_TRANSFER', 'CASH', 'POS'], {
  errorMap: () => ({ message: 'Method must be Bank Transfer, Cash, or POS' }),
});

exports.paymentSchemas = {
  create: z.object({
    customerId: z.string({ required_error: 'Customer is required' }).min(1, 'Customer is required'),
    planId: z.string({ required_error: 'Service plan is required' }).min(1, 'Service plan is required'),
    amount: z.coerce.number({ invalid_type_error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
    paymentDate: z.coerce.date().optional(),
    method: z.preprocess(normalizeMethod, methodEnum),
    reference: z.string().trim().max(100).optional(),
  }),
  update: z
    .object({
      amount: z.coerce.number().positive().optional(),
      paymentDate: z.coerce.date().optional(),
      method: z.preprocess(normalizeMethod, methodEnum).optional(),
      reference: z.string().trim().max(100).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' }),
};

exports.projectionSchemas = {
  create: z
    .object({
      planId: z.string({ required_error: 'Plan is required' }).min(1, 'Plan is required'),
      date: z.coerce.date({ required_error: 'Date is required', invalid_type_error: 'Invalid date' }),
      threeDay: z.coerce.number().nonnegative('Cannot be negative').optional(),
      oneWeek: z.coerce.number().nonnegative('Cannot be negative').optional(),
      oneMonth: z.coerce.number().nonnegative('Cannot be negative').optional(),
      oneYear: z.coerce.number().nonnegative('Cannot be negative').optional(),
    })
    .refine(
      (d) => d.threeDay !== undefined || d.oneWeek !== undefined || d.oneMonth !== undefined || d.oneYear !== undefined,
      { message: 'Provide at least one timeframe amount' }
    ),
  update: z
    .object({
      threeDay: z.coerce.number().nonnegative().optional(),
      oneWeek: z.coerce.number().nonnegative().optional(),
      oneMonth: z.coerce.number().nonnegative().optional(),
      oneYear: z.coerce.number().nonnegative().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one timeframe amount' }),
};
