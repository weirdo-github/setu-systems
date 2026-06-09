/**
 * Integration tests for invoice discountPct validation.
 * Requires the server running at http://127.0.0.1:4173
 * and a valid Finance admin session cookie.
 *
 * Run with:
 *   FINANCE_COOKIE="connect.sid=s%3A..." node --test tests/invoice-discount-validation.integration.test.js
 *
 * Or set up via the login flow first.
 */

const { describe, it, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const COOKIE = process.env.FINANCE_COOKIE || '';

function makeInvoicePayload(discountPct, milestone) {
  return {
    form: {
      selectedCustomerId: 'new',
      customerName: `QA Test ${milestone}`,
      customerEmail: `qa.${milestone.toLowerCase()}@example.com`,
      service: 'Authorship',
      milestone: milestone,
      amount: 1000,
      discountPct: discountPct,
      dueDate: '2026-09-01',
    },
    sendNow: false,
  };
}

async function postInvoice(discountPct, milestone) {
  const resp = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIE,
    },
    body: JSON.stringify(makeInvoicePayload(discountPct, milestone)),
  });
  return resp;
}

describe('POST /api/invoices discountPct validation (integration)', () => {
  before(() => {
    if (!COOKIE) {
      console.log('FINANCE_COOKIE not set — skipping integration tests.');
      console.log('Set FINANCE_COOKIE env var with a valid session cookie to run.');
    }
  });

  it('rejects discountPct = -50 with 400', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(-50, 'QA-NEG50');
    assert.strictEqual(resp.status, 400, `Expected 400, got ${resp.status}`);
    const body = await resp.json();
    assert.ok(body.error, 'Response should contain error message');
    assert.ok(
      body.error.toLowerCase().includes('discount') ||
        body.error.includes('0') ||
        body.error.includes('100'),
      `Error message should mention discount bounds: ${body.error}`
    );
  });

  it('rejects discountPct = -1 with 400', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(-1, 'QA-NEG1');
    assert.strictEqual(resp.status, 400);
  });

  it('rejects discountPct = 101 with 400', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(101, 'QA-OVER101');
    assert.strictEqual(resp.status, 400);
  });

  it('rejects discountPct = 150 with 400', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(150, 'QA-OVER150');
    assert.strictEqual(resp.status, 400);
  });

  it('accepts discountPct = 0', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(0, 'QA-ZERO-OK');
    assert.strictEqual(resp.status, 200, `Expected 200, got ${resp.status}`);
  });

  it('accepts discountPct = 50', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(50, 'QA-FIFTY-OK');
    assert.strictEqual(resp.status, 200, `Expected 200, got ${resp.status}`);
  });

  it('accepts discountPct = 100', async () => {
    if (!COOKIE) return skip('No cookie');
    const resp = await postInvoice(100, 'QA-HUNDO-OK');
    assert.strictEqual(resp.status, 200, `Expected 200, got ${resp.status}`);
  });
});
