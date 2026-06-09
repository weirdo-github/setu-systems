/**
 * Apply the discountPct bounds fix to server/stateStore.js
 * Usage: node apply-fix.js
 *
 * This script patches server/stateStore.js in-place to add
 * discountPct validation (0-100 bounds check).
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'server', 'stateStore.js');

if (!fs.existsSync(STORE_PATH)) {
  console.error(`Error: ${STORE_PATH} not found. Run from repo root.`);
  process.exit(1);
}

let content = fs.readFileSync(STORE_PATH, 'utf8');

// 1. Add import at the top (after first require block or at the top)
const validationImport = `const { validateDiscountPct } = require('./validation/invoiceValidation');\n`;

if (!content.includes('invoiceValidation')) {
  // Insert after the first line or after existing requires
  const firstRequireIdx = content.indexOf('require(');
  if (firstRequireIdx !== -1) {
    // Find end of that line
    const lineEnd = content.indexOf('\n', firstRequireIdx);
    content = content.slice(0, lineEnd + 1) + validationImport + content.slice(lineEnd + 1);
  } else {
    content = validationImport + content;
  }
}

// 2. Replace the unbounded discountPct assignment
const oldPattern = /const\s+discountPct\s*=\s*Number\(form\.discountPct\s*\|\|\s*0\)/g;
const newCode = `const _discountPctResult = validateDiscountPct(form.discountPct);
    if (!_discountPctResult.valid) {
      const _err = new Error(_discountPctResult.error);
      _err.statusCode = 400;
      throw _err;
    }
    const discountPct = _discountPctResult.value`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(STORE_PATH, content, 'utf8');
  console.log('✅ Patched server/stateStore.js — discountPct now bounded to [0, 100]');
} else if (content.includes('_discountPctResult')) {
  console.log('ℹ️  Patch already applied.');
} else {
  console.error('⚠️  Could not find the target pattern. Manual patch required.');
  console.error('   Look for: const discountPct = Number(form.discountPct || 0)');
  console.error('   Replace with bounded validation (see fix-discount-pct-bounds.patch)');
  process.exit(1);
}
