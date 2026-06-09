/**
 * Drop-in replacement logic for the discountPct handling in createInvoiceRecord.
 * 
 * Apply this fix to server/stateStore.js in the createInvoiceRecord function
 * (approximately line 5973).
 *
 * BEFORE:
 *   const discountPct = Number(form.discountPct || 0)
 *
 * AFTER (paste this block):
 */

// --- START FIX: discountPct bounded to 0-100 (GitHub issue #2) ---
const { validateDiscountPct } = require('./validation/invoiceValidation');

// Inside createInvoiceRecord, replace the discountPct assignment:
function getValidatedDiscountPct(form) {
  const { validateDiscountPct } = require('./validation/invoiceValidation');
  return validateDiscountPct(form.discountPct);
}
// --- END FIX ---

module.exports = { getValidatedDiscountPct };
