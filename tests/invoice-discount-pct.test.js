'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateInvoiceForm, isValidDiscountPct } = require('../server/validation/invoiceValidation');

describe('discountPct validation', () => {
  describe('isValidDiscountPct', () => {
    it('should accept 0', () => {
      assert.strictEqual(isValidDiscountPct(0), true);
    });

    it('should accept 50', () => {
      assert.strictEqual(isValidDiscountPct(50), true);
    });

    it('should accept 100', () => {
      assert.strictEqual(isValidDiscountPct(100), true);
    });

    it('should accept decimal values like 10.5', () => {
      assert.strictEqual(isValidDiscountPct(10.5), true);
    });

    it('should reject -1', () => {
      assert.strictEqual(isValidDiscountPct(-1), false);
    });

    it('should reject -50', () => {
      assert.strictEqual(isValidDiscountPct(-50), false);
    });

    it('should reject 101', () => {
      assert.strictEqual(isValidDiscountPct(101), false);
    });

    it('should reject 150', () => {
      assert.strictEqual(isValidDiscountPct(150), false);
    });

    it('should reject NaN', () => {
      assert.strictEqual(isValidDiscountPct(NaN), false);
    });

    it('should reject non-numeric string', () => {
      assert.strictEqual(isValidDiscountPct('abc'), false);
    });

    it('should accept numeric string "25"', () => {
      assert.strictEqual(isValidDiscountPct('25'), true);
    });
  });

  describe('validateInvoiceForm', () => {
    const validForm = {
      selectedCustomerId: 'new',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      service: 'Authorship',
      milestone: 'TEST-001',
      amount: 1000,
      discountPct: 10,
      dueDate: '2026-09-01'
    };

    it('should pass with valid discountPct of 0', () => {
      const form = { ...validForm, discountPct: 0 };
      const result = validateInvoiceForm(form);
      assert.strictEqual(result.discountPct, 0);
    });

    it('should pass with valid discountPct of 100', () => {
      const form = { ...validForm, discountPct: 100 };
      const result = validateInvoiceForm(form);
      assert.strictEqual(result.discountPct, 100);
    });

    it('should pass with valid discountPct of 25', () => {
      const form = { ...validForm, discountPct: 25 };
      const result = validateInvoiceForm(form);
      assert.strictEqual(result.discountPct, 25);
    });

    it('should pass with missing discountPct (defaults to 0)', () => {
      const form = { ...validForm };
      delete form.discountPct;
      const result = validateInvoiceForm(form);
      assert.strictEqual(result.discountPct, 0);
    });

    it('should reject negative discountPct (-50) with 400 status', () => {
      const form = { ...validForm, discountPct: -50 };
      assert.throws(
        () => validateInvoiceForm(form),
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /discountPct must be between 0 and 100/);
          return true;
        }
      );
    });

    it('should reject discountPct over 100 (150) with 400 status', () => {
      const form = { ...validForm, discountPct: 150 };
      assert.throws(
        () => validateInvoiceForm(form),
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /discountPct must be between 0 and 100/);
          return true;
        }
      );
    });

    it('should reject discountPct of -0.01 with 400 status', () => {
      const form = { ...validForm, discountPct: -0.01 };
      assert.throws(
        () => validateInvoiceForm(form),
        (err) => {
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('should reject discountPct of 100.01 with 400 status', () => {
      const form = { ...validForm, discountPct: 100.01 };
      assert.throws(
        () => validateInvoiceForm(form),
        (err) => {
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('should reject null form with 400 status', () => {
      assert.throws(
        () => validateInvoiceForm(null),
        (err) => {
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('should reject negative amount', () => {
      const form = { ...validForm, amount: -100 };
      assert.throws(
        () => validateInvoiceForm(form),
        (err) => {
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });
});
