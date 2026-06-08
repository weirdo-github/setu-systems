/**
 * Integration tests for POST /api/invoices discountPct validation.
 * Requires the server to be running at http://127.0.0.1:4173
 * Run with: node --test tests/invoice-api-integration.test.js
 */
const { describe, it, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
let cookie = process.env.FIN_COOKIE || '';

const canRunIntegration = !!cookie;

describe('POST /api/invoices - discountPct validation (integration)', { skip: !canRunIntegration }, () => {

  async function postInvoice(discountPct, milestone) {
    const body = {
      form: {
        selectedCustomerId: 'new',
        customerName: `QA Test ${milestone}`,
        customerEmail: `qa.${milestone.toLowerCase()}@example.com`,
        service: 'Authorship',
        milestone: milestone,
        amount: 1000,
        discountPct: discountPct,
        dueDate: '2026-09-01'
      },
      sendNow: false
    };

    const res = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify(body)
    });

    return { status: res.status, data: await res.json().catch(() => null) };
  }

  it('rejects discountPct = -50 with 400', async () => {
    const { status, data } = await postInvoice(-50, 'TEST-NEG50');
    assert.equal(status, 400, `Expected 400 but got ${status}`);
    assert.ok(data && data.error, 'Response should contain error message');
  });

  it('rejects discountPct = -1 with 400', async () => {
    const { status } = await postInvoice(-1, 'TEST-NEG1');
    assert.equal(status, 400);
  });

  it('rejects discountPct = 150 with 400', async () => {
    const { status } = await postInvoice(150, 'TEST-OVER150');
    assert.equal(status, 400);
  });

  it('rejects discountPct = 101 with 400', async () => {
    const { status } = await postInvoice(101, 'TEST-OVER101');
    assert.equal(status, 400);
  });

  it('accepts discountPct = 0 with 200', async () => {
    const { status } = await postInvoice(0, 'TEST-ZERO');
    assert.equal(status, 200);
  });

  it('accepts discountPct = 50 with 200', async () => {
    const { status } = await postInvoice(50, 'TEST-FIFTY');
    assert.equal(status, 200);
  });

  it('accepts discountPct = 100 with 200', async () => {
    const { status } = await postInvoice(100, 'TEST-HUNDRED');
    assert.equal(status, 200);
  });
});
