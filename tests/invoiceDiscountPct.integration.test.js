/**
 * Integration test for the discountPct validation on POST /api/invoices.
 * 
 * Requires the app to be running on http://127.0.0.1:4173
 * and a valid finance admin cookie.
 *
 * Run with:
 *   FINANCE_COOKIE="connect.sid=..." node --test tests/invoiceDiscountPct.integration.test.js
 */
const { test, describe, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const FINANCE_COOKIE = process.env.FINANCE_COOKIE || '';

function makeInvoicePayload(discountPct, milestone) {
  return JSON.stringify({
    form: {
      selectedCustomerId: 'new',
      customerName: 'QA DiscountTest',
      customerEmail: 'qa.discount@example.com',
      service: 'Authorship',
      milestone: milestone || `QA-DISC-${Date.now()}`,
      amount: 1000,
      discountPct: discountPct,
      dueDate: '2026-09-01'
    },
    sendNow: false
  });
}

async function postInvoice(discountPct, milestone) {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': FINANCE_COOKIE
    },
    body: makeInvoicePayload(discountPct, milestone)
  });
  return res;
}

describe('POST /api/invoices discountPct validation (integration)', () => {
  before(() => {
    if (!FINANCE_COOKIE) {
      console.log('⚠️  FINANCE_COOKIE not set. Integration tests will be skipped.');
      console.log('   Set FINANCE_COOKIE env var to run integration tests.');
    }
  });

  test('rejects discountPct = -50 with 400', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(-50, 'QA-NEG50');
    assert.equal(res.status, 400, `Expected 400 but got ${res.status}`);
    const body = await res.json();
    assert(body.error, 'Response should contain error message');
    assert.match(body.error, /between 0 and 100/);
  });

  test('rejects discountPct = -1 with 400', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(-1, 'QA-NEG1');
    assert.equal(res.status, 400);
  });

  test('rejects discountPct = 150 with 400', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(150, 'QA-OVER150');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert(body.error);
  });

  test('rejects discountPct = 101 with 400', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(101, 'QA-OVER101');
    assert.equal(res.status, 400);
  });

  test('accepts discountPct = 0 (200)', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(0, `QA-ZERO-${Date.now()}`);
    assert.equal(res.status, 200);
  });

  test('accepts discountPct = 50 (200)', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(50, `QA-FIFTY-${Date.now()}`);
    assert.equal(res.status, 200);
  });

  test('accepts discountPct = 100 (200)', async (t) => {
    if (!FINANCE_COOKIE) return t.skip('No FINANCE_COOKIE');
    const res = await postInvoice(100, `QA-HUND-${Date.now()}`);
    assert.equal(res.status, 200);
  });
});
