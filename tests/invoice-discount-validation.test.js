'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountPct } = require('../server/validation/invoiceValidation');

describe('validateDiscountPct', () => {
  it('accepts 0 (no discount)', () => {
    const result = validateDiscountPct(0);
    assert.equal(result.valid, true);
    assert.equal(result.value, 0);
  });

  it('accepts 50 (50% discount)', () => {
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

  it('accepts decimal 10.5', () => {
    const result = validateDiscountPct(10.5);
    assert.equal(result.valid, true);
    assert.equal(result.value, 10.5);
  });

  it('rejects negative discount (-1)', () => {
    const result = validateDiscountPct(-1);
    assert.equal(result.valid, false);
    assert.ok(result.error);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects negative discount (-50)', () => {
    const result = validateDiscountPct(-50);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects discount over 100 (101)', () => {
    const result = validateDiscountPct(101);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects discount over 100 (150)', () => {
    const result = validateDiscountPct(150);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects discount over 100 (200)', () => {
    const result = validateDiscountPct(200);
    assert.equal(result.valid, false);
    assert.match(result.error, /between 0 and 100/);
  });

  it('rejects NaN string', () => {
    const result = validateDiscountPct('abc');
    assert.equal(result.valid, false);
    assert.match(result.error, /valid number/);
  });

  it('rejects very large negative (-9999)', () => {
    const result = validateDiscountPct(-9999);
    assert.equal(result.valid, false);
  });

  it('boundary: rejects -0.01', () => {
    const result = validateDiscountPct(-0.01);
    assert.equal(result.valid, false);
  });

  it('boundary: rejects 100.01', () => {
    const result = validateDiscountPct(100.01);
    assert.equal(result.valid, false);
  });
});
