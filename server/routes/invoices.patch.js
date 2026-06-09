/**
 * This file demonstrates the exact integration point for the validation
 * in the invoices API route handler.
 *
 * Apply this pattern to your existing POST /api/invoices route.
 */

'use strict';

const { validateDiscountPct } = require('../validation/invoiceValidation');

/**
 * Wrap this validation around the existing createInvoiceRecord call
 * in your POST /api/invoices handler.
 *
 * Example integration (adapt to your router framework):
 */
function applyDiscountValidationMiddleware(handler) {
  return async (req, res, next) => {
    try {
      const form = req.body?.form || req.body;

      // Validate discountPct before proceeding
      if (form && 'discountPct' in form) {
        const result = validateDiscountPct(form.discountPct);
        if (!result.valid) {
          return res.status(400).json({
            error: result.error,
            field: 'discountPct',
            value: form.discountPct
          });
        }
      }

      return handler(req, res, next);
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };
}

module.exports = { applyDiscountValidationMiddleware };
