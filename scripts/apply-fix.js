#!/usr/bin/env node
'use strict';

/**
 * Patches server/stateStore.js to add discountPct [0,100] validation
 * in the createInvoiceRecord function.
 */

const fs = require('fs');
const path = require('path');

const stateStorePath = path.resolve(__dirname, '..', 'server', 'stateStore.js');

if (!fs.existsSync(stateStorePath)) {
  console.error(`ERROR: Cannot find ${stateStorePath}`);
  process.exit(1);
}

let content = fs.readFileSync(stateStorePath, 'utf8');

// Check if fix is already applied
if (content.includes('discountPct must be between 0 and 100')) {
  console.log('Fix already applied. Skipping.');
  process.exit(0);
}

// Pattern 1: with semicolon
const pattern1 = /const\s+discountPct\s*=\s*Number\(form\.discountPct\s*\|\|\s*0\)\s*;?/;

const match = content.match(pattern1);
if (!match) {
  console.error('ERROR: Could not locate discountPct assignment in createInvoiceRecord.');
  console.error('Please apply the fix manually. See DELIVERY.md for details.');
  process.exit(1);
}

const originalLine = match[0];
const indent = (function() {
  const lineStart = content.lastIndexOf('\n', match.index) + 1;
  const prefix = content.substring(lineStart, match.index);
  return prefix;
})();

const replacement = `const discountPct = Number(form.discountPct || 0);
${indent}if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
${indent}  return { success: false, status: 400, error: 'discountPct must be between 0 and 100 (inclusive)' };
${indent}}`;

content = content.replace(originalLine, replacement);

// Also patch the route handler if it doesn't already check result.status for 400
// Look for the POST /api/invoices route handler and ensure it returns the status from the result
const routePattern = /(\.post\(['"`]\/api\/invoices['"`])/;
const routeMatch = content.match(routePattern);

if (routeMatch) {
  // Find the area where result is returned
  // Try to locate: res.json(result) or similar after createInvoiceRecord call
  // and ensure that if result.success === false, we return the right status
  const afterRoute = content.indexOf(routeMatch[0]);
  const routeBlock = content.substring(afterRoute, afterRoute + 2000);
  
  // Check if there's already a status check
  if (!routeBlock.includes('result.status') && !routeBlock.includes('!result.success')) {
    // Add a status check before the json response
    const resJsonPattern = /(res\.json\(result\))/;
    const resJsonMatch = routeBlock.match(resJsonPattern);
    if (resJsonMatch) {
      const fullMatch = resJsonMatch[0];
      const insertionPoint = afterRoute + resJsonMatch.index;
      const lineIndentStart = content.lastIndexOf('\n', insertionPoint) + 1;
      const lineIndent = content.substring(lineIndentStart, insertionPoint).match(/^(\s*)/)[1];
      const guard = `if (!result.success) {\n${lineIndent}  return res.status(result.status || 400).json({ error: result.error });\n${lineIndent}}\n${lineIndent}`;
      content = content.substring(0, insertionPoint) + guard + content.substring(insertionPoint);
    }
  }
}

// Backup original
fs.writeFileSync(stateStorePath + '.bak', fs.readFileSync(stateStorePath));

// Write patched file
fs.writeFileSync(stateStorePath, content, 'utf8');
console.log('Fix applied successfully to server/stateStore.js');
console.log(`Backup saved to ${stateStorePath}.bak`);
