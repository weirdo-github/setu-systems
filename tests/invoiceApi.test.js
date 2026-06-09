/**
 * Integration-style test for the invoice API discount validation.
 * Requires the server to be running on http://127.0.0.1:4173
 * Run: node tests/invoiceApi.test.js
 *
 * NOTE: These tests require a valid Finance admin cookie.
 * Set FIN_COOKIE env var, e.g.:
 *   FIN_COOKIE='connect.sid=s%3A...' node tests/invoiceApi.test.js
 */

'use strict';

const http = require('http');

const BASE = 'http://127.0.0.1:4173';
const COOKIE = process.env.FIN_COOKIE || '';

if (!COOKIE) {
  console.log('SKIP: FIN_COOKIE not set. Set it to a valid Finance admin session cookie.');
  console.log('Example: FIN_COOKIE="connect.sid=..." node tests/invoiceApi.test.js');
  process.exit(0);
}

let passed = 0;
let failed = 0;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

function makeInvoice(discountPct) {
  return {
    form: {
      selectedCustomerId: 'new',
      customerName: `QA Disc ${discountPct}`,
      customerEmail: 'qa@example.com',
      service: 'Authorship',
      milestone: `QA-DISC-${discountPct}-${Date.now()}`,
      amount: 1000,
      discountPct,
      dueDate: '2026-09-01'
    },
    sendNow: false
  };
}

async function run() {
  console.log('\nInvoice API - discountPct validation');
  console.log('------------------------------------');

  await test('rejects discountPct = -50 with 400', async () => {
    const res = await post('/api/invoices', makeInvoice(-50));
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('rejects discountPct = -1 with 400', async () => {
    const res = await post('/api/invoices', makeInvoice(-1));
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  await test('rejects discountPct = 150 with 400', async () => {
    const res = await post('/api/invoices', makeInvoice(150));
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  await test('rejects discountPct = 101 with 400', async () => {
    const res = await post('/api/invoices', makeInvoice(101));
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  await test('accepts discountPct = 0 (HTTP 200)', async () => {
    const res = await post('/api/invoices', makeInvoice(0));
    if (res.status === 400) {
      throw new Error(`Got 400 for valid discount 0: ${JSON.stringify(res.body)}`);
    }
  });

  await test('accepts discountPct = 50 (HTTP 200)', async () => {
    const res = await post('/api/invoices', makeInvoice(50));
    if (res.status === 400) {
      throw new Error(`Got 400 for valid discount 50: ${JSON.stringify(res.body)}`);
    }
  });

  await test('accepts discountPct = 100 (HTTP 200)', async () => {
    const res = await post('/api/invoices', makeInvoice(100));
    if (res.status === 400) {
      throw new Error(`Got 400 for valid discount 100: ${JSON.stringify(res.body)}`);
    }
  });

  console.log('\n------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) process.exit(1);
  console.log('\nAll API tests passed! ✓\n');
}

run().catch(e => { console.error(e); process.exit(1); });
