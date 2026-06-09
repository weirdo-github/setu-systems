/**
 * Unit tests for discountPct validation logic.
 * Run with: node --test tests/invoice-discount-validation.unit.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountPct } = require('../server/validation/invoiceValidation');

describe('validateDiscountPct', () => {
  it('accepts 0', () => {
    const result = validateDiscountPct(0);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 0);
  });

  it('accepts 50', () => {
    const result = validateDiscountPct(50);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 50);
  });

  it('accepts 100', () => {
    const result = validateDiscountPct(100);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 100);
  });

  it('accepts string "25"', () => {
    const result = validateDiscountPct('25');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 25);
  });

  it('accepts undefined (defaults to 0)', () => {
    const result = validateDiscountPct(undefined);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 0);
  });

  it('accepts null (defaults to 0)', () => {
    const result = validateDiscountPct(null);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 0);
  });

  it('rejects -1', () => {
    const result = validateDiscountPct(-1);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
  });

  it('rejects -50', () => {
    const result = validateDiscountPct(-50);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('between 0 and 100'));
  });

  it('rejects 101', () => {
    const result = validateDiscountPct(101);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
  });

  it('rejects 150', () => {
    const result = validateDiscountPct(150);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('between 0 and 100'));
  });

  it('rejects NaN string', () => {
    const result = validateDiscountPct('abc');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
  });

  it('rejects -0.01', () => {
    const result = validateDiscountPct(-0.01);
    assert.strictEqual(result.valid, false);
  });

  it('rejects 100.01', () => {
    const result = validateDiscountPct(100.01);
    assert.strictEqual(result.valid, false);
  });

  it('accepts 99.99', () => {
    const result = validateDiscountPct(99.99);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 99.99);
  });

  it('accepts 0.01', () => {
    const result = validateDiscountPct(0.01);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value, 0.01);
  });
});
