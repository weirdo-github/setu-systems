'use strict';

/**
 * Integration tests for the invoice API discount validation.
 * These tests require the server to be running at http://127.0.0.1:4173
 * and a valid finance admin cookie.
 *
 * Run with: FIN_COOKIE="your_cookie" node --test tests/invoice-api-integration.test.js
 */

const { describe, it, before, skip } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const FIN_COOKIE = process.env.FIN_COOKIE || '';

function makeInvoicePayload(overrides = {}) {
  return {
    form: {
      selectedCustomerId: 'new',
      customerName: `QA Test ${Date.now()}`,
      customerEmail: `qa.test.${Date.now()}@example.com`,
      service: 'Authorship',
      milestone: `QA-${Date.now()}`,
      amount: 1000,
      discountPct: 10,
      dueDate: '2026-09-01',
      ...overrides
    },
    sendNow: false
  };
}

async function postInvoice(payload) {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': FIN_COOKIE
    },
    body: JSON.stringify(payload)
  });
  return res;
}

describe('Invoice API - discountPct validation (integration)', () => {
  before(() => {
    if (!FIN_COOKIE) {
      console.log('SKIPPING integration tests: FIN_COOKIE env var not set.');
      console.log('Set FIN_COOKIE to a valid finance admin session cookie to run these tests.');
    }
  });

  it('should return 400 for negative discountPct (-50)', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: -50 });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 400, `Expected 400 but got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error || body.message, 'Response should contain error message');
  });

  it('should return 400 for discountPct over 100 (150)', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: 150 });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 400, `Expected 400 but got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error || body.message, 'Response should contain error message');
  });

  it('should return 400 for discountPct of -0.01', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: -0.01 });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 400, `Expected 400 but got ${res.status}`);
  });

  it('should return 400 for discountPct of 100.01', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: 100.01 });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 400, `Expected 400 but got ${res.status}`);
  });

  it('should accept discountPct of 0 (boundary)', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: 0, milestone: `QA-ZERO-${Date.now()}` });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
  });

  it('should accept discountPct of 100 (boundary)', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: 100, milestone: `QA-FULL-${Date.now()}` });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
  });

  it('should accept discountPct of 50 (valid mid-range)', async () => {
    if (!FIN_COOKIE) return skip('No FIN_COOKIE');

    const payload = makeInvoicePayload({ discountPct: 50, milestone: `QA-MID-${Date.now()}` });
    const res = await postInvoice(payload);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
  });
});
