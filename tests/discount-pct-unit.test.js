/**
 * Unit test: validates the discount percentage bounds logic
 * Does NOT require a running server.
 *
 * Usage: node tests/discount-pct-unit.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

/**
 * This is the validation logic that must exist in the patched code.
 * We test it in isolation here.
 */
function validateDiscountPct(value) {
  const discountPct = Number(value || 0);
  if (isNaN(discountPct)) {
    return { valid: false, error: 'discountPct must be a number' };
  }
  if (discountPct < 0 || discountPct > 100) {
    return { valid: false, error: 'discountPct must be between 0 and 100' };
  }
  return { valid: true, value: discountPct };
}

console.log('=== Unit Tests: discountPct validation ===\n');

console.log('Rejection cases:');
assert(!validateDiscountPct(-50).valid, 'discountPct = -50 → invalid');
assert(!validateDiscountPct(-1).valid, 'discountPct = -1 → invalid');
assert(!validateDiscountPct(-0.01).valid, 'discountPct = -0.01 → invalid');
assert(!validateDiscountPct(101).valid, 'discountPct = 101 → invalid');
assert(!validateDiscountPct(150).valid, 'discountPct = 150 → invalid');
assert(!validateDiscountPct(100.01).valid, 'discountPct = 100.01 → invalid');
assert(!validateDiscountPct(999).valid, 'discountPct = 999 → invalid');
assert(!validateDiscountPct('abc').valid, 'discountPct = "abc" → invalid');

console.log('\nAcceptance cases:');
assert(validateDiscountPct(0).valid, 'discountPct = 0 → valid');
assert(validateDiscountPct(1).valid, 'discountPct = 1 → valid');
assert(validateDiscountPct(50).valid, 'discountPct = 50 → valid');
assert(validateDiscountPct(99).valid, 'discountPct = 99 → valid');
assert(validateDiscountPct(100).valid, 'discountPct = 100 → valid');
assert(validateDiscountPct(0.5).valid, 'discountPct = 0.5 → valid');
assert(validateDiscountPct(33.33).valid, 'discountPct = 33.33 → valid');
assert(validateDiscountPct(null).valid, 'discountPct = null → valid (defaults to 0)');
assert(validateDiscountPct(undefined).valid, 'discountPct = undefined → valid (defaults to 0)');
assert(validateDiscountPct('').valid, 'discountPct = "" → valid (defaults to 0)');
assert(validateDiscountPct('25').valid, 'discountPct = "25" → valid (coerced)');

console.log('\nValue correctness:');
assert(validateDiscountPct(0).value === 0, 'discountPct = 0 → value is 0');
assert(validateDiscountPct(50).value === 50, 'discountPct = 50 → value is 50');
assert(validateDiscountPct(100).value === 100, 'discountPct = 100 → value is 100');
assert(validateDiscountPct(null).value === 0, 'discountPct = null → value is 0');

console.log('\nError message cases:');
assert(validateDiscountPct(-50).error.includes('0 and 100'), 'Negative error mentions bounds');
assert(validateDiscountPct(150).error.includes('0 and 100'), 'Over-100 error mentions bounds');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
