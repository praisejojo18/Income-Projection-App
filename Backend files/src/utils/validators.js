exports.validateCustomerData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim() === '') {
    errors.push('Customer name is required.');
  }
  if (!data.planId || isNaN(data.planId)) {
    errors.push('A valid Plan ID is required.');
  }
  if (!data.amount || isNaN(data.amount)) {
    errors.push('A valid amount is required.');
  }
  if (!data.expiryDate || isNaN(Date.parse(data.expiryDate))) {
    errors.push('A valid expiry date is required (YYYY-MM-DD).');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};