/**
 * Integration test: discountPct must be bounded to 0-100
 * Run against a live server at BASE_URL (default http://127.0.0.1:4173)
 *
 * Usage: node tests/discount-pct-bounds.test.js [cookie]
 *
 * If no cookie provided, attempts to login as finance admin.
 */
const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const COOKIE = process.env.FIN_COOKIE || process.argv[2] || '';

let passed = 0;
let failed = 0;

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (cookie) options.headers['Cookie'] = cookie;

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function testDiscountPctNegative() {
  console.log('\nTest: discountPct = -50 should be rejected (400)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA DiscNeg Test',
      customerEmail: 'qa.neg@example.com',
      service: 'Authorship',
      milestone: 'TEST-NEG-' + Date.now(),
      amount: 1000,
      discountPct: -50,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(
    (typeof res.body === 'object' && res.body.error && res.body.error.toLowerCase().includes('discount')),
    `Response contains discount error message: ${JSON.stringify(res.body)}`
  );
}

async function testDiscountPctOver100() {
  console.log('\nTest: discountPct = 150 should be rejected (400)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA DiscOver Test',
      customerEmail: 'qa.over@example.com',
      service: 'Authorship',
      milestone: 'TEST-OVER-' + Date.now(),
      amount: 1000,
      discountPct: 150,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(
    (typeof res.body === 'object' && res.body.error && res.body.error.toLowerCase().includes('discount')),
    `Response contains discount error message: ${JSON.stringify(res.body)}`
  );
}

async function testDiscountPctAt101() {
  console.log('\nTest: discountPct = 101 should be rejected (400)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA Disc101 Test',
      customerEmail: 'qa.101@example.com',
      service: 'Authorship',
      milestone: 'TEST-101-' + Date.now(),
      amount: 1000,
      discountPct: 101,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 400, `Expected 400, got ${res.status}`);
}

async function testDiscountPctAtMinus1() {
  console.log('\nTest: discountPct = -1 should be rejected (400)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA DiscM1 Test',
      customerEmail: 'qa.m1@example.com',
      service: 'Authorship',
      milestone: 'TEST-M1-' + Date.now(),
      amount: 1000,
      discountPct: -1,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 400, `Expected 400, got ${res.status}`);
}

async function testDiscountPctZero() {
  console.log('\nTest: discountPct = 0 should be accepted (200)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA Disc0 Test',
      customerEmail: 'qa.zero@example.com',
      service: 'Authorship',
      milestone: 'TEST-ZERO-' + Date.now(),
      amount: 1000,
      discountPct: 0,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
}

async function testDiscountPct50() {
  console.log('\nTest: discountPct = 50 should be accepted (200)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA Disc50 Test',
      customerEmail: 'qa.fifty@example.com',
      service: 'Authorship',
      milestone: 'TEST-50-' + Date.now(),
      amount: 1000,
      discountPct: 50,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
}

async function testDiscountPct100() {
  console.log('\nTest: discountPct = 100 should be accepted (200)');
  const res = await request('POST', '/api/invoices', {
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA Disc100 Test',
      customerEmail: 'qa.hundred@example.com',
      service: 'Authorship',
      milestone: 'TEST-100-' + Date.now(),
      amount: 1000,
      discountPct: 100,
      dueDate: '2026-09-01'
    },
    sendNow: false
  }, COOKIE);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
}

async function run() {
  console.log('=== discountPct Bounds Validation Tests ===');
  console.log(`Target: ${BASE_URL}`);
  
  if (!COOKIE) {
    console.log('WARNING: No cookie provided. Tests may fail with 401.');
    console.log('Usage: FIN_COOKIE="session=..." node tests/discount-pct-bounds.test.js');
    console.log('   or: node tests/discount-pct-bounds.test.js "session=..."');
    console.log('');
  }

  try {
    // Rejection tests (must return 400)
    await testDiscountPctNegative();
    await testDiscountPctOver100();
    await testDiscountPctAt101();
    await testDiscountPctAtMinus1();

    // Acceptance tests (must return 200)
    await testDiscountPctZero();
    await testDiscountPct50();
    await testDiscountPct100();
  } catch (err) {
    console.error('\nTest execution error:', err.message);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ==="`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
