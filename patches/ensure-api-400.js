#!/usr/bin/env node
/**
 * Ensures the API route for invoices returns 400 when stateStore returns { success: false }
 * Scans common SvelteKit route locations.
 */
const fs = require('fs');
const path = require('path');

const ROUTE_CANDIDATES = [
  'src/routes/api/invoices/+server.js',
  'src/routes/api/invoices/+server.ts',
  'src/routes/(app)/api/invoices/+server.js',
  'src/routes/(app)/api/invoices/+server.ts',
];

function findRouteFile() {
  for (const rel of ROUTE_CANDIDATES) {
    const abs = path.resolve(__dirname, '..', rel);
    if (fs.existsSync(abs)) return { abs, rel };
  }
  return null;
}

function patchRoute() {
  const found = findRouteFile();
  if (!found) {
    // Check if route is embedded in stateStore (monolith pattern)
    const stateStore = path.resolve(__dirname, '..', 'server', 'stateStore.js');
    if (fs.existsSync(stateStore)) {
      const src = fs.readFileSync(stateStore, 'utf8');
      // Look for express-style or native http route handlers
      // Pattern: res.json(result) without checking success
      if (src.includes('res.json(result)') || src.includes('res.send(result)')) {
        // Patch to check success field
        let patched = src;
        // Find invoice POST handler context
        const invoiceHandlerRegex = /(createInvoiceRecord\([^)]*\)[\s\S]{0,200}?)(res\.(?:json|send)\(result\))/g;
        let match;
        let applied = false;
        while ((match = invoiceHandlerRegex.exec(src)) !== null) {
          const before = match[1];
          const resCall = match[2];
          if (!before.includes('!result.success')) {
            const replacement = before + 
              `if (!result.success) { res.status(400).json({ error: result.error }); return; }\n    ` + resCall;
            patched = patched.replace(match[0], replacement);
            applied = true;
          }
        }
        if (applied) {
          fs.writeFileSync(stateStore, patched, 'utf8');
          console.log('Patched stateStore.js route handler to return 400 on validation failure.');
        } else {
          // Check for json({ success pattern
          if (src.includes('json({ success: true') || src.includes('.success)')) {
            console.log('Route handler appears to already handle success/failure.');
          } else {
            console.log('WARNING: Could not auto-patch route handler. Manual review needed.');
          }
        }
      } else if (src.includes('return new Response') || src.includes('json(')) {
        // SvelteKit-style in monolith - look for pattern where result is returned
        console.log('Route handling detected in stateStore.js - checking...');
        if (src.includes('!result.success') || src.includes('result.error')) {
          console.log('Error handling already present.');
        }
      }
    }
    return;
  }

  let src = fs.readFileSync(found.abs, 'utf8');
  
  if (src.includes('status: 400') || src.includes('!result.success')) {
    console.log(`${found.rel} already handles validation errors.`);
    return;
  }

  // SvelteKit pattern: find where result is returned as JSON
  // Add check before the success response
  const returnJsonPattern = /(const\s+result\s*=\s*await\s+[^;]+;)([\s\S]*?)(return\s+(?:new\s+Response|json))/;
  const match = src.match(returnJsonPattern);
  
  if (match) {
    const insertion = `\n    if (!result.success) {\n      return new Response(JSON.stringify({ error: result.error || 'Validation failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });\n    }\n`;
    src = src.replace(returnJsonPattern, match[1] + insertion + match[2] + match[3]);
    fs.writeFileSync(found.abs, src, 'utf8');
    console.log(`Patched ${found.rel} to return 400 on validation failure.`);
  } else {
    console.log(`WARNING: Could not auto-patch ${found.rel}. Manual review needed.`);
  }
}

patchRoute();
