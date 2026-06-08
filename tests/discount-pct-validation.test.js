const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountPct, validateInvoiceForm } = require('../server/validation/invoiceValidation');

describe('validateDiscountPct', () => {
  it('accepts 0 (no discount)', () => {
    const result = validateDiscountPct(0);
    assert.equal(result.valid, true);
    assert.equal(result.value, 0);
  });

  it('accepts 50 (valid discount)', () => {
    const result = validateDiscountPct(50);
    assert.equal(result.valid, true);
    assert.equal(result.value, 50);
  });

  it('accepts 100 (full discount)', () => {
    const result = validateDiscountPct(100);
    assert.equal(result.valid, true);
    assert.equal(result.value, 100);
  });

  it('accepts null/undefined as 0', () => {
    assert.equal(validateDiscountPct(null).valid, true);
    assert.equal(validateDiscountPct(null).value, 0);
    assert.equal(validateDiscountPct(undefined).valid, true);
    assert.equal(validateDiscountPct(undefined).value, 0);
  });

  it('accepts string "25" as 25', () => {
    const result = validateDiscountPct('25');
    assert.equal(result.valid, true);
    assert.equal(result.value, 25);
  });

  it('accepts decimal values like 10.5', () => {
    const result = validateDiscountPct(10.5);
    assert.equal(result.valid, true);
    assert.equal(result.value, 10.5);
  });

  it('rejects negative value -1', () => {
    const result = validateDiscountPct(-1);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('negative'));
  });

  it('rejects negative value -50 (the reported bug)', () => {
    const result = validateDiscountPct(-50);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('negative'));
  });

  it('rejects value over 100', () => {
    const result = validateDiscountPct(101);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('100'));
  });

  it('rejects 150 (the reported bug)', () => {
    const result = validateDiscountPct(150);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('100'));
  });

  it('rejects NaN', () => {
    const result = validateDiscountPct('abc');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('valid number'));
  });

  it('rejects -0.01 (barely negative)', () => {
    const result = validateDiscountPct(-0.01);
    assert.equal(result.valid, false);
  });

  it('rejects 100.01 (barely over 100)', () => {
    const result = validateDiscountPct(100.01);
    assert.equal(result.valid, false);
  });
});

describe('validateInvoiceForm', () => {
  it('passes with valid form data', () => {
    const result = validateInvoiceForm({
      amount: 1000,
      discountPct: 10
    });
    assert.equal(result.valid, true);
  });

  it('fails when discountPct is negative', () => {
    const result = validateInvoiceForm({
      amount: 1000,
      discountPct: -50
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('fails when discountPct exceeds 100', () => {
    const result = validateInvoiceForm({
      amount: 1000,
      discountPct: 150
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('fails when form is null', () => {
    const result = validateInvoiceForm(null);
    assert.equal(result.valid, false);
  });

  it('passes with discountPct omitted (defaults to 0)', () => {
    const result = validateInvoiceForm({ amount: 1000 });
    assert.equal(result.valid, true);
  });
});
