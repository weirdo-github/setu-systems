/**
 * Unit tests for discountPct validation (issue #2).
 * Run: node tests/invoiceValidation.test.js
 */

'use strict';

const assert = require('assert');
const { validateDiscountPct, validateInvoiceForm } = require('../server/validation/invoiceValidation');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log('\nvalidateDiscountPct');
console.log('-------------------');

test('accepts 0', () => {
  const r = validateDiscountPct(0);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, 0);
});

test('accepts 50', () => {
  const r = validateDiscountPct(50);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, 50);
});

test('accepts 100', () => {
  const r = validateDiscountPct(100);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, 100);
});

test('accepts string "25"', () => {
  const r = validateDiscountPct('25');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, 25);
});

test('accepts null/undefined as 0', () => {
  assert.strictEqual(validateDiscountPct(null).valid, true);
  assert.strictEqual(validateDiscountPct(null).value, 0);
  assert.strictEqual(validateDiscountPct(undefined).valid, true);
  assert.strictEqual(validateDiscountPct(undefined).value, 0);
});

test('rejects -1', () => {
  const r = validateDiscountPct(-1);
  assert.strictEqual(r.valid, false);
  assert(r.error.includes('between 0 and 100'));
});

test('rejects -50', () => {
  const r = validateDiscountPct(-50);
  assert.strictEqual(r.valid, false);
});

test('rejects 101', () => {
  const r = validateDiscountPct(101);
  assert.strictEqual(r.valid, false);
});

test('rejects 150', () => {
  const r = validateDiscountPct(150);
  assert.strictEqual(r.valid, false);
});

test('rejects -0.01', () => {
  const r = validateDiscountPct(-0.01);
  assert.strictEqual(r.valid, false);
});

test('rejects 100.01', () => {
  const r = validateDiscountPct(100.01);
  assert.strictEqual(r.valid, false);
});

test('rejects NaN', () => {
  const r = validateDiscountPct(NaN);
  assert.strictEqual(r.valid, false);
});

test('rejects Infinity', () => {
  const r = validateDiscountPct(Infinity);
  assert.strictEqual(r.valid, false);
});

test('rejects non-numeric string', () => {
  const r = validateDiscountPct('abc');
  assert.strictEqual(r.valid, false);
});

console.log('\nvalidateInvoiceForm');
console.log('-------------------');

test('valid form passes', () => {
  const r = validateInvoiceForm({ amount: 1000, discountPct: 10 });
  assert.strictEqual(r.valid, true);
});

test('negative discount in form fails', () => {
  const r = validateInvoiceForm({ amount: 1000, discountPct: -50 });
  assert.strictEqual(r.valid, false);
  assert(r.errors.length > 0);
});

test('discount over 100 in form fails', () => {
  const r = validateInvoiceForm({ amount: 1000, discountPct: 150 });
  assert.strictEqual(r.valid, false);
});

test('zero amount fails', () => {
  const r = validateInvoiceForm({ amount: 0, discountPct: 10 });
  assert.strictEqual(r.valid, false);
});

console.log('\n-------------------');
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  process.exit(1);
}
console.log('\nAll tests passed! ✓\n');
