const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountPct, validateInvoiceForm, ValidationError } = require('../server/validation/invoiceValidation');

describe('validateDiscountPct', () => {
  it('accepts 0', () => {
    const result = validateDiscountPct(0);
    assert.equal(result.valid, true);
    assert.equal(result.value, 0);
  });

  it('accepts 50', () => {
    const result = validateDiscountPct(50);
    assert.equal(result.valid, true);
    assert.equal(result.value, 50);
  });

  it('accepts 100', () => {
    const result = validateDiscountPct(100);
    assert.equal(result.valid, true);
    assert.equal(result.value, 100);
  });

  it('accepts string "25"', () => {
    const result = validateDiscountPct('25');
    assert.equal(result.valid, true);
    assert.equal(result.value, 25);
  });

  it('accepts null/undefined as 0', () => {
    assert.equal(validateDiscountPct(null).valid, true);
    assert.equal(validateDiscountPct(null).value, 0);
    assert.equal(validateDiscountPct(undefined).valid, true);
    assert.equal(validateDiscountPct(undefined).value, 0);
  });

  it('accepts empty string as 0', () => {
    const result = validateDiscountPct('');
    assert.equal(result.valid, true);
    assert.equal(result.value, 0);
  });

  it('rejects negative value -1', () => {
    const result = validateDiscountPct(-1);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects negative value -50', () => {
    const result = validateDiscountPct(-50);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects value over 100 (101)', () => {
    const result = validateDiscountPct(101);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects value over 100 (150)', () => {
    const result = validateDiscountPct(150);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects value over 100 (999)', () => {
    const result = validateDiscountPct(999);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects NaN input', () => {
    const result = validateDiscountPct('abc');
    assert.equal(result.valid, false);
    assert.match(result.error, /valid number/);
  });

  it('accepts decimal 33.33', () => {
    const result = validateDiscountPct(33.33);
    assert.equal(result.valid, true);
    assert.equal(result.value, 33.33);
  });

  it('accepts boundary 0.01', () => {
    const result = validateDiscountPct(0.01);
    assert.equal(result.valid, true);
    assert.equal(result.value, 0.01);
  });

  it('accepts boundary 99.99', () => {
    const result = validateDiscountPct(99.99);
    assert.equal(result.valid, true);
    assert.equal(result.value, 99.99);
  });

  it('rejects -0.01', () => {
    const result = validateDiscountPct(-0.01);
    assert.equal(result.valid, false);
  });

  it('rejects 100.01', () => {
    const result = validateDiscountPct(100.01);
    assert.equal(result.valid, false);
  });
});

describe('validateInvoiceForm', () => {
  it('throws ValidationError for negative discountPct', () => {
    assert.throws(
      () => validateInvoiceForm({ discountPct: -50 }),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.field, 'discountPct');
        return true;
      }
    );
  });

  it('throws ValidationError for discountPct > 100', () => {
    assert.throws(
      () => validateInvoiceForm({ discountPct: 150 }),
      (err) => {
        assert(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it('does not throw for valid discountPct', () => {
    assert.doesNotThrow(() => validateInvoiceForm({ discountPct: 10 }));
    assert.doesNotThrow(() => validateInvoiceForm({ discountPct: 0 }));
    assert.doesNotThrow(() => validateInvoiceForm({ discountPct: 100 }));
  });

  it('does not throw for missing discountPct (defaults to 0)', () => {
    assert.doesNotThrow(() => validateInvoiceForm({}));
    assert.doesNotThrow(() => validateInvoiceForm({ discountPct: null }));
    assert.doesNotThrow(() => validateInvoiceForm({ discountPct: undefined }));
  });
});

describe('Regression: overcharge scenario', () => {
  it('discountPct of -50 on $1000 must be rejected (would have produced $1500 payable)', () => {
    const result = validateDiscountPct(-50);
    assert.equal(result.valid, false);
    // If this were allowed: zelleAmount = 1000 * (1 - (-50/100)) = 1000 * 1.5 = 1500
    // That's an overcharge. Validation must prevent it.
  });

  it('discountPct of 150 on $1000 must be rejected (would have produced negative/zero payable)', () => {
    const result = validateDiscountPct(150);
    assert.equal(result.valid, false);
    // If this were allowed: zelleAmount = 1000 * (1 - (150/100)) = 1000 * -0.5 = -500
    // Negative payable is nonsensical. Validation must prevent it.
  });
});
