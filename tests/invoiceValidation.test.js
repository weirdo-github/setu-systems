const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountPct, validateInvoiceForm, ValidationError } = require('../server/validation/invoiceValidation');

describe('validateDiscountPct', () => {
  test('accepts 0 (no discount)', () => {
    assert.equal(validateDiscountPct(0), 0);
  });

  test('accepts 100 (full discount)', () => {
    assert.equal(validateDiscountPct(100), 100);
  });

  test('accepts 50 (normal discount)', () => {
    assert.equal(validateDiscountPct(50), 50);
  });

  test('accepts decimal values like 12.5', () => {
    assert.equal(validateDiscountPct(12.5), 12.5);
  });

  test('accepts string "25" (coerced to number)', () => {
    assert.equal(validateDiscountPct('25'), 25);
  });

  test('treats null/undefined/empty as 0', () => {
    assert.equal(validateDiscountPct(null), 0);
    assert.equal(validateDiscountPct(undefined), 0);
    assert.equal(validateDiscountPct(''), 0);
  });

  test('rejects negative value -1', () => {
    assert.throws(
      () => validateDiscountPct(-1),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /between 0 and 100/);
        return true;
      }
    );
  });

  test('rejects negative value -50 (the reported bug)', () => {
    assert.throws(
      () => validateDiscountPct(-50),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('rejects value over 100 (e.g., 101)', () => {
    assert.throws(
      () => validateDiscountPct(101),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /between 0 and 100/);
        return true;
      }
    );
  });

  test('rejects 150 (the other reported bug)', () => {
    assert.throws(
      () => validateDiscountPct(150),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('rejects -0.01 (just below zero boundary)', () => {
    assert.throws(
      () => validateDiscountPct(-0.01),
      (err) => {
        assert(err instanceof ValidationError);
        return true;
      }
    );
  });

  test('rejects 100.01 (just above 100 boundary)', () => {
    assert.throws(
      () => validateDiscountPct(100.01),
      (err) => {
        assert(err instanceof ValidationError);
        return true;
      }
    );
  });

  test('rejects NaN-producing input', () => {
    assert.throws(
      () => validateDiscountPct('abc'),
      (err) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /valid number/);
        return true;
      }
    );
  });

  test('rejects Infinity', () => {
    assert.throws(
      () => validateDiscountPct(Infinity),
      (err) => {
        assert(err instanceof ValidationError);
        return true;
      }
    );
  });

  test('rejects -Infinity', () => {
    assert.throws(
      () => validateDiscountPct(-Infinity),
      (err) => {
        assert(err instanceof ValidationError);
        return true;
      }
    );
  });
});

describe('validateInvoiceForm', () => {
  test('passes through form with valid discountPct', () => {
    const form = {
      customerName: 'Test',
      amount: 1000,
      discountPct: 10
    };
    const result = validateInvoiceForm(form);
    assert.equal(result.discountPct, 10);
    assert.equal(result.customerName, 'Test');
    assert.equal(result.amount, 1000);
  });

  test('rejects null form', () => {
    assert.throws(
      () => validateInvoiceForm(null),
      (err) => {
        assert(err instanceof ValidationError);
        return true;
      }
    );
  });

  test('rejects form with negative discountPct', () => {
    assert.throws(
      () => validateInvoiceForm({ discountPct: -50, amount: 1000 }),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('rejects form with discountPct > 100', () => {
    assert.throws(
      () => validateInvoiceForm({ discountPct: 150, amount: 1000 }),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

describe('ValidationError', () => {
  test('has correct name property', () => {
    const err = new ValidationError('test');
    assert.equal(err.name, 'ValidationError');
  });

  test('has statusCode 400', () => {
    const err = new ValidationError('test');
    assert.equal(err.statusCode, 400);
  });

  test('is an instance of Error', () => {
    const err = new ValidationError('test');
    assert(err instanceof Error);
  });
});
