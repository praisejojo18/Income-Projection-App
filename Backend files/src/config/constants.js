const CONSTANTS = {
  PAYMENT_METHODS: ['bank_transfer', 'cash', 'pos'],

  PLAN_STATUS: { ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' },

  CUSTOMER_STATUS: { ACTIVE: 'ACTIVE', EXPIRED: 'EXPIRED', INACTIVE: 'INACTIVE' },

  PROJECTION_TIMEFRAMES: ['daily', 'weekly', 'monthly', 'annually'],

  // Matches Settings page dropdown: English (US), Spanish, French, German
  LANGUAGES: ['en-US', 'es', 'fr', 'de'],

  DEFAULT_SETTINGS: {
    workspaceName: 'My Workspace',
    darkMode: false,
    language: 'en-US',
    notifications: true,
    currency: 'NGN', // ₦ Naira
  },

  PAGINATION: { DEFAULT_LIMIT: 20, MAX_LIMIT: 100 },
};

module.exports = CONSTANTS;