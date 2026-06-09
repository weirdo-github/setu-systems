#!/usr/bin/env node
/**
 * Patch: Bound discountPct to 0–100 in server/stateStore.js
 * Applies to dlk710/setu-systems @ e20bb35
 */
const fs = require('fs');
const path = require('path');

const STATSTORE_PATH = path.resolve(__dirname, '..', 'server', 'stateStore.js');

function applyPatch() {
  if (!fs.existsSync(STATSTORE_PATH)) {
    console.error(`ERROR: ${STATSTORE_PATH} not found. Run from repo root.`);
    process.exit(1);
  }

  let src = fs.readFileSync(STATSTORE_PATH, 'utf8');

  // Pattern 1: validate after discountPct is parsed in createInvoiceRecord
  const discountLine = `const discountPct = Number(form.discountPct || 0)`;
  const discountLineAlt = `const discountPct = Number(form.discountPct || 0);`;

  const validationBlock = [
    '',
    '    // Validate discountPct bounds (fix: github issue #2)',
    '    if (discountPct < 0 || discountPct > 100) {',
    '      return { success: false, error: "discountPct must be between 0 and 100" };',
    '    }',
  ].join('\n');

  // Check if already patched
  if (src.includes('discountPct must be between 0 and 100')) {
    console.log('Patch already applied.');
    return;
  }

  let patched = false;

  // Try with semicolon
  if (src.includes(discountLineAlt)) {
    src = src.replace(discountLineAlt, discountLineAlt + validationBlock);
    patched = true;
  } else if (src.includes(discountLine)) {
    src = src.replace(discountLine, discountLine + ';' + validationBlock);
    patched = true;
  }

  if (!patched) {
    // Fallback: use regex to find the pattern
    const regex = /const\s+discountPct\s*=\s*Number\(form\.discountPct\s*\|\|\s*0\)\s*;?/;
    const match = src.match(regex);
    if (match) {
      src = src.replace(regex, match[0] + (match[0].endsWith(';') ? '' : ';') + validationBlock);
      patched = true;
    }
  }

  if (!patched) {
    console.error('ERROR: Could not locate discountPct assignment in stateStore.js');
    console.error('Manual patch required. Add validation after discountPct parsing:');
    console.error(validationBlock);
    process.exit(1);
  }

  // Also ensure the route handler returns 400 for validation failures
  // Look for the API route handling pattern
  const routePatterns = [
    // Pattern: if result has success: false, ensure 400 is returned
    /if\s*\(\s*!result\.success\s*\)/,
    /if\s*\(\s*result\.success\s*===\s*false\s*\)/,
    /if\s*\(!\s*result\s*\)/
  ];

  // Check if there's a route handler in the same file that needs patching
  // The API route may be in src/routes/api/invoices/+server.js or .ts
  const possibleRoutePaths = [
    path.resolve(__dirname, '..', 'src', 'routes', 'api', 'invoices', '+server.js'),
    path.resolve(__dirname, '..', 'src', 'routes', 'api', 'invoices', '+server.ts'),
  ];

  for (const routePath of possibleRoutePaths) {
    if (fs.existsSync(routePath)) {
      let routeSrc = fs.readFileSync(routePath, 'utf8');
      if (!routeSrc.includes('status: 400') && !routeSrc.includes('{ status: 400 }')) {
        // If route doesn't already handle 400, check if it returns result directly
        // Add validation error handling
        const postFnRegex = /(export\s+(async\s+)?function\s+POST[^{]*\{)/;
        if (postFnRegex.test(routeSrc) && !routeSrc.includes('result.success === false') && !routeSrc.includes('!result.success')) {
          console.log(`Note: Route file ${routePath} may need manual update to return 400 on validation failure.`);
        }
      }
      break;
    }
  }

  fs.writeFileSync(STATSTORE_PATH, src, 'utf8');
  console.log('Patch applied successfully to server/stateStore.js');
  console.log('discountPct is now bounded to 0–100');
}

applyPatch();
