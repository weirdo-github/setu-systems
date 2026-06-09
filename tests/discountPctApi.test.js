/**
 * Integration-style test that verifies the API endpoint rejects
 * out-of-bounds discountPct values.
 *
 * Requires the server to be running at http://127.0.0.1:4173
 * and a valid finance admin session cookie.
 *
 * Run with: FIN_COOKIE="your_cookie" node --test tests/discountPctApi.test.js
 */

const { describe, it, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:4173';
const FIN_COOKIE = process.env.FIN_COOKIE || '';

describe('POST /api/invoices - discountPct bounds (integration)', () => {
  before(() => {
    if (!FIN_COOKIE) {
      console.log('Skipping integration tests: FIN_COOKIE not set');
    }
  });

  async function postInvoice(discountPct) {
    if (!FIN_COOKIE) return null;
    const res = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': FIN_COOKIE,
      },
      body: JSON.stringify({
        form: {
          selectedCustomerId: 'new',
          customerName: `QA DiscBound ${discountPct}`,
          customerEmail: `qa.bound${discountPct}@example.com`,
          service: 'Authorship',
          milestone: `QA-BOUND-${discountPct}`,
          amount: 1000,
          discountPct: discountPct,
          dueDate: '2026-09-01',
        },
        sendNow: false,
      }),
    });
    return res;
  }

  it('rejects discountPct = -50 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(-50);
    assert.equal(res.status, 400, 'Expected 400 for negative discountPct');
  });

  it('rejects discountPct = -1 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(-1);
    assert.equal(res.status, 400, 'Expected 400 for discountPct = -1');
  });

  it('rejects discountPct = 101 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(101);
    assert.equal(res.status, 400, 'Expected 400 for discountPct = 101');
  });

  it('rejects discountPct = 150 with 400', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(150);
    assert.equal(res.status, 400, 'Expected 400 for discountPct = 150');
  });

  it('accepts discountPct = 0 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(0);
    assert.equal(res.status, 200, 'Expected 200 for discountPct = 0');
  });

  it('accepts discountPct = 50 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(50);
    assert.equal(res.status, 200, 'Expected 200 for discountPct = 50');
  });

  it('accepts discountPct = 100 with 200', async () => {
    if (!FIN_COOKIE) return skip('FIN_COOKIE not set');
    const res = await postInvoice(100);
    assert.equal(res.status, 200, 'Expected 200 for discountPct = 100');
  });
});
