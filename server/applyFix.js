#!/usr/bin/env node
/**
 * Automated patch script: applies the discountPct validation fix to server/stateStore.js.
 * Usage: node server/applyFix.js
 *
 * This script finds the createInvoiceRecord function and injects validation.
 * Idempotent — will not re-apply if already patched.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_STORE = path.resolve(__dirname, 'stateStore.js');
const MARKER = '// FIX: discountPct bounded 0-100 (issue #2)';

function applyFix() {
  if (!fs.existsSync(STATE_STORE)) {
    console.error(`ERROR: ${STATE_STORE} not found.`);
    process.exit(1);
  }

  let src = fs.readFileSync(STATE_STORE, 'utf8');

  if (src.includes(MARKER)) {
    console.log('Fix already applied. Skipping.');
    return;
  }

  // Add require at top (after first line or after existing requires)
  const requireLine = "const { validateDiscountPct } = require('./validation/invoiceValidation');";
  if (!src.includes('invoiceValidation')) {
    // Insert after the last require/import block near top
    const insertIdx = src.lastIndexOf("require('") !== -1
      ? src.indexOf('\n', src.lastIndexOf("require('")) + 1
      : 0;
    src = src.slice(0, insertIdx) + requireLine + '\n' + src.slice(insertIdx);
  }

  // Find the discount line in createInvoiceRecord context
  const pattern = /const\s+discountPct\s*=\s*Number\(form\.discountPct\s*\|\|\s*0\)/;
  const match = pattern.exec(src);

  if (!match) {
    console.error('ERROR: Could not locate discountPct assignment pattern in stateStore.js');
    console.error('Manual patching required — see server/stateStore.patch');
    process.exit(1);
  }

  const replacement = `${MARKER}
    const discountPctResult = validateDiscountPct(form.discountPct);
    if (!discountPctResult.valid) {
      return res.status(400).json({ success: false, error: discountPctResult.error });
    }
    const discountPct = discountPctResult.value`;

  src = src.slice(0, match.index) + replacement + src.slice(match.index + match[0].length);

  fs.writeFileSync(STATE_STORE, src, 'utf8');
  console.log('Fix applied successfully to server/stateStore.js');
}

applyFix();
