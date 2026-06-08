/**
 * Invoice field validation utilities.
 * Can be used both server-side and shared with client.
 */

/**
 * Validates discountPct is within acceptable range [0, 100].
 * @param {*} value - The discountPct value to validate
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
function validateDiscountPct(value) {
  const num = Number(value || 0);

  if (isNaN(num)) {
    return { valid: false, error: 'discountPct must be a valid number' };
  }

  if (num < 0) {
    return { valid: false, error: 'discountPct must not be negative' };
  }

  if (num > 100) {
    return { valid: false, error: 'discountPct must not exceed 100' };
  }

  return { valid: true, value: num };
}

/**
 * Validates all invoice form fields.
 * @param {object} form - The invoice form data
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateInvoiceForm(form) {
  const errors = [];

  if (!form) {
    return { valid: false, errors: ['form is required'] };
  }

  if (form.amount != null) {
    const amount = Number(form.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push('amount must be a non-negative number');
    }
  }

  const discountResult = validateDiscountPct(form.discountPct);
  if (!discountResult.valid) {
    errors.push(discountResult.error);
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true };
}

module.exports = { validateDiscountPct, validateInvoiceForm };
