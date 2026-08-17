const { z } = require('zod');
const { LANGUAGES } = require('../config/constants');

// Accepts "Bank Transfer", "cash", "pos", "BANK_TRANSFER" → normalizes to enum
const normalizeMethod = (val) =>
  typeof val === 'string' ? val.toUpperCase().replace(/\s+/g, '_') : val;

const methodEnum = z.enum(['BANK_TRANSFER', 'CASH', 'POS'], {
  errorMap: () => ({ message: 'Method must be Bank Transfer, Cash, or POS' }),
});

const planSchemas = {
  create: z.object({
    name: z.string({ required_error: 'Plan name is required' }).trim().min(2).max(50),
    price: z.coerce.number({ invalid_type_error: 'Price must be a number' }).positive('Price must be greater than 0'),
    durationDays: z.coerce.number().int().positive('Duration must be at least 1 day').max(3650),
  }),
  update: z
    .object({
      name: z.string().trim().min(2).max(50).optional(),
      price: z.coerce.number().positive().optional(),
      durationDays: z.coerce.number().int().positive().max(3650).optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' }),
};

const settingsSchema = z
  .object({
    workspaceName: z.string().trim().min(1).max(100).optional(),
    darkMode: z.boolean().optional(),
    language: z.enum(LANGUAGES, { errorMap: () => ({ message: `Language must be one of: ${LANGUAGES.join(', ')}` }) }).optional(),
    notifications: z.boolean().optional(),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter code (e.g., NGN)').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const paymentSchemas = {
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
const projectionSchemas = {
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
      (d) =>
        d.threeDay !== undefined || d.oneWeek !== undefined ||
        d.oneMonth !== undefined || d.oneYear !== undefined,
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
module.exports = { planSchemas, settingsSchema, paymentSchemas, projectionSchemas };