'use strict';

/**
 * Integration tests for the /api/invoices endpoint discountPct validation.
 * Requires the server to be running at http://127.0.0.1:4173
 * and a valid Finance admin session cookie.
 *
 * Set environment variable FIN_COOKIE to the session cookie value.
 * Example: FIN_COOKIE="connect.sid=s%3A..." node --test tests/invoice-api-discount.test.js
 */

const { describe, it, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const FIN_COOKIE = process.env.FIN_COOKIE;

function makeInvoicePayload(discountPct) {
  return {
    form: {
      selectedCustomerId: 'new',
      customerName: `QA DiscTest ${discountPct}`,
      customerEmail: `qa.disc${Date.now()}@example.com`,
      service: 'Authorship',
      milestone: `QA-DISC-${discountPct}-${Date.now()}`,
      amount: 1000,
      discountPct: discountPct,
      dueDate: '2026-09-01'
    },
    sendNow: false
  };
}

async function postInvoice(discountPct) {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(FIN_COOKIE ? { Cookie: FIN_COOKIE } : {})
    },
    body: JSON.stringify(makeInvoicePayload(discountPct))
  });
  return res;
}

describe('POST /api/invoices discountPct validation (integration)', () => {
  before(() => {
    if (!FIN_COOKIE) {
      console.log('Skipping integration tests: FIN_COOKIE not set');
    }
  });

  it('rejects discountPct = -50 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(-50);
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error, 'Response should have error message');
    assert.match(body.error, /discount/i);
  });

  it('rejects discountPct = -1 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(-1);
    assert.equal(res.status, 400);
  });

  it('rejects discountPct = 150 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(150);
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('rejects discountPct = 101 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(101);
    assert.equal(res.status, 400);
  });

  it('accepts discountPct = 0 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(0);
    assert.equal(res.status, 200);
  });

  it('accepts discountPct = 50 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(50);
    assert.equal(res.status, 200);
  });

  it('accepts discountPct = 100 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(100);
    assert.equal(res.status, 200);
  });
});
