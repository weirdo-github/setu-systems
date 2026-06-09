const { validateDiscountPct, validateInvoiceForm } = require('../server/validation/invoiceValidation');

// Simple test runner (no external dependencies)
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('\n=== validateDiscountPct ===\n');

// Valid cases
(() => {
  const r = validateDiscountPct(0);
  assert(r.valid === true, 'accepts 0');
  assert(r.value === 0, 'value is 0');
})();

(() => {
  const r = validateDiscountPct(50);
  assert(r.valid === true, 'accepts 50');
  assert(r.value === 50, 'value is 50');
})();

(() => {
  const r = validateDiscountPct(100);
  assert(r.valid === true, 'accepts 100');
  assert(r.value === 100, 'value is 100');
})();

(() => {
  const r = validateDiscountPct(25.5);
  assert(r.valid === true, 'accepts 25.5 (fractional)');
  assert(r.value === 25.5, 'value is 25.5');
})();

(() => {
  const r = validateDiscountPct(null);
  assert(r.valid === true, 'accepts null (defaults to 0)');
  assert(r.value === 0, 'null defaults to 0');
})();

(() => {
  const r = validateDiscountPct(undefined);
  assert(r.valid === true, 'accepts undefined (defaults to 0)');
  assert(r.value === 0, 'undefined defaults to 0');
})();

(() => {
  const r = validateDiscountPct('10');
  assert(r.valid === true, 'accepts string "10"');
  assert(r.value === 10, 'string "10" parsed to 10');
})();

// Invalid: negative
(() => {
  const r = validateDiscountPct(-1);
  assert(r.valid === false, 'rejects -1');
  assert(r.error.includes('negative'), 'error mentions negative');
})();

(() => {
  const r = validateDiscountPct(-50);
  assert(r.valid === false, 'rejects -50 (overcharge scenario)');
})();

(() => {
  const r = validateDiscountPct(-0.01);
  assert(r.valid === false, 'rejects -0.01');
})();

// Invalid: over 100
(() => {
  const r = validateDiscountPct(101);
  assert(r.valid === false, 'rejects 101');
  assert(r.error.includes('100'), 'error mentions 100');
})();

(() => {
  const r = validateDiscountPct(150);
  assert(r.valid === false, 'rejects 150');
})();

(() => {
  const r = validateDiscountPct(100.01);
  assert(r.valid === false, 'rejects 100.01');
})();

// Invalid: NaN
(() => {
  const r = validateDiscountPct('abc');
  assert(r.valid === false, 'rejects "abc"');
  assert(r.error.includes('valid number'), 'error mentions valid number');
})();

(() => {
  const r = validateDiscountPct(NaN);
  assert(r.valid === false, 'rejects NaN');
})();

console.log('\n=== validateInvoiceForm ===\n');

(() => {
  const r = validateInvoiceForm({ discountPct: 10, amount: 1000 });
  assert(r.valid === true, 'valid form passes');
  assert(r.errors.length === 0, 'no errors');
})();

(() => {
  const r = validateInvoiceForm({ discountPct: -50, amount: 1000 });
  assert(r.valid === false, 'form with discountPct:-50 fails');
  assert(r.errors.length === 1, 'one error');
})();

(() => {
  const r = validateInvoiceForm({ discountPct: 150, amount: 1000 });
  assert(r.valid === false, 'form with discountPct:150 fails');
})();

(() => {
  const r = validateInvoiceForm({ discountPct: 10, amount: -100 });
  assert(r.valid === false, 'form with negative amount fails');
})();

(() => {
  const r = validateInvoiceForm({ discountPct: -10, amount: -100 });
  assert(r.valid === false, 'form with both invalid fails');
  assert(r.errors.length === 2, 'two errors');
})();

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
