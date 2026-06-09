/**
 * Validates invoice form fields.
 */

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * Validates that discountPct is a number within [0, 100].
 * @param {*} value - The raw discountPct value from the form.
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
function validateDiscountPct(value) {
  const num = Number(value || 0);
  if (isNaN(num)) {
    return { valid: false, error: 'discountPct must be a valid number' };
  }
  if (num < 0 || num > 100) {
    return { valid: false, error: 'discountPct must be between 0 and 100' };
  }
  return { valid: true, value: num };
}

/**
 * Validates the full invoice form object.
 * Throws ValidationError on first invalid field.
 * @param {object} form
 */
function validateInvoiceForm(form) {
  if (form.discountPct !== undefined && form.discountPct !== null && form.discountPct !== '') {
    const result = validateDiscountPct(form.discountPct);
    if (!result.valid) {
      throw new ValidationError(result.error, 'discountPct');
    }
  } else {
    const result = validateDiscountPct(0);
    if (!result.valid) {
      throw new ValidationError(result.error, 'discountPct');
    }
  }
}

module.exports = { validateDiscountPct, validateInvoiceForm, ValidationError };
