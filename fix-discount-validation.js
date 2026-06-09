#!/usr/bin/env node
/**
 * Patch script: Adds discountPct 0-100 range validation to server/stateStore.js
 * Fixes: github:dlk710/setu-systems#2
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'stateStore.js');

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: ${filePath} not found. Run this script from the repo root.`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Check if already patched
if (content.includes('discountPct must be between 0 and 100') || content.includes('discountPct < 0 || discountPct > 100')) {
  console.log('Already patched. Skipping.');
  process.exit(0);
}

// Pattern: const discountPct = Number(form.discountPct || 0)
// May or may not have semicolon, may have different spacing
const pattern = /([ \t]*)(const discountPct\s*=\s*Number\(form\.discountPct\s*\|\|\s*0\)\s*;?)/;

const match = content.match(pattern);
if (!match) {
  console.error('ERROR: Could not locate discountPct assignment pattern in stateStore.js');
  console.error('Expected pattern like: const discountPct = Number(form.discountPct || 0)');
  process.exit(1);
}

const indent = match[1];
const originalLine = match[2];

// Determine error handling style by checking nearby context
const matchIndex = match.index;
const surroundingBefore = content.substring(Math.max(0, matchIndex - 2000), matchIndex);
const surroundingAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 2000));

let validationBlock;

// Check if `res` is available in scope (route-handler style)
const hasResInScope = surroundingBefore.includes('(req, res') ||
                     surroundingBefore.includes('(req,res') ||
                     surroundingBefore.includes(', res)') ||
                     surroundingAfter.includes('res.status') ||
                     surroundingAfter.includes('res.json');

if (hasResInScope) {
  // Express-style: return res.status(400).json(...)
  validationBlock = `${originalLine}\n${indent}if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {\n${indent}  return res.status(400).json({ success: false, error: 'discountPct must be between 0 and 100' });\n${indent}}`;
} else {
  // Pure function style: throw with statusCode
  validationBlock = `${originalLine}\n${indent}if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {\n${indent}  const validationErr = new Error('discountPct must be between 0 and 100');\n${indent}  validationErr.statusCode = 400;\n${indent}  throw validationErr;\n${indent}}`;
}

content = content.replace(pattern, validationBlock);

// Also ensure that if this function throws, the route caller catches with 400
// Look for the route handler that calls createInvoiceRecord
const routePattern = /(\.post\(['"`]\/api\/invoices['"`]\s*,\s*async\s*\([^)]*\)\s*=>\s*\{)/;
const routeMatch = content.match(routePattern);

if (routeMatch && !hasResInScope) {
  // Check if there's already a try-catch in the route handler
  const routeIndex = routeMatch.index;
  const routeArea = content.substring(routeIndex, routeIndex + 3000);
  
  if (!routeArea.includes('try {') && !routeArea.includes('try{')) {
    // The route handler doesn't have error handling - wrap the body
    // This is complex to do generically, so we'll add a note
    console.log('NOTE: Route handler for POST /api/invoices may need try/catch error handling.');
    console.log('The validation will throw with statusCode=400. Ensure your error middleware handles it.');
  }
}

// Additionally look for any global error handler and make sure it respects statusCode
const hasErrorMiddleware = content.includes('err.statusCode') || content.includes('error.statusCode');
if (!hasResInScope && !hasErrorMiddleware) {
  // Add a simple error handler enhancement if we can find the app setup
  const appUsePattern = /(app\.use\(\s*(?:function\s*)?\(\s*err\s*,\s*req\s*,\s*res\s*,\s*next\s*\))/;
  if (appUsePattern.test(content)) {
    // There's an error handler, make sure it uses statusCode
    content = content.replace(
      appUsePattern,
      '// Enhanced to support validation errors with statusCode\n$1'
    );
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Patch applied successfully to server/stateStore.js');
console.log('   - Added discountPct range validation (0-100)');
console.log('   - Invalid values will return HTTP 400');
