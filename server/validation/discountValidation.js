/**
 * Validates that discountPct is within the allowed range [0, 100].
 * @param {number|string} discountPct - The discount percentage to validate
 * @returns {{ valid: boolean, value: number, error?: string }}
 */
function validateDiscountPct(discountPct) {
  const value = Number(discountPct || 0);

  if (Number.isNaN(value)) {
    return { valid: false, value: 0, error: 'discountPct must be a valid number' };
  }

  if (value < 0) {
    return { valid: false, value, error: 'discountPct must not be negative' };
  }

  if (value > 100) {
    return { valid: false, value, error: 'discountPct must not exceed 100' };
  }

  return { valid: true, value };
}

module.exports = { validateDiscountPct };
