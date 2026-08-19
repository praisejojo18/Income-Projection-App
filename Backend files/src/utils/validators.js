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

  return {
    isValid: errors.length === 0,
    errors
  };
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

  if (
    data.recordPayment &&
    data.paymentMethod &&
    !ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)
  ) {
    errors.push("paymentMethod must be BANK_TRANSFER, CASH, or POS.");
  }

  return { 
    isValid: errors.length === 0, 
    errors 
  };
};


/* =====================================================
   ZOD SCHEMAS FOR COLLEAGUE'S ROUTES (PLANS)
===================================================== */
const { z } = require("zod");

exports.planSchemas = {
  create: z.object({
    name: z.string().trim().min(1, "Plan name is required."),
    price: z.coerce.number().positive("Price must be greater than 0."),
    durationDays: z.coerce
      .number()
      .int()
      .positive("Duration must be a positive whole number."),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  }),

  update: z.object({
    name: z.string().trim().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    durationDays: z.coerce.number().int().positive().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  })
};
