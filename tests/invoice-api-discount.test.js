/**
 * Integration-style test for POST /api/invoices discount validation.
 * Tests HTTP responses using a minimal mock server or direct fetch.
 *
 * Run: node --test tests/invoice-api-discount.test.js
 *
 * NOTE: For full integration testing, start the app first:
 *   npm run preview (or your start command)
 *   Then run this with: TEST_BASE_URL=http://127.0.0.1:4173 node --test tests/invoice-api-discount.test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const COOKIE = process.env.TEST_COOKIE || '';

// Skip integration tests if no server is running
const skipIntegration = !process.env.TEST_BASE_URL;

describe('POST /api/invoices - discountPct validation (integration)', { skip: skipIntegration }, () => {
  const makeRequest = async (discountPct, milestone) => {
    const res = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE
      },
      body: JSON.stringify({
        form: {
          selectedCustomerId: 'new',
          customerName: 'QA DiscTest',
          customerEmail: 'qa.disc@example.com',
          service: 'Authorship',
          milestone: milestone,
          amount: 1000,
          discountPct: discountPct,
          dueDate: '2026-09-01'
        },
        sendNow: false
      })
    });
    return res;
  };

  it('rejects discountPct = -50 with 400', async () => {
    const res = await makeRequest(-50, 'QA-NEG-50');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert(body.error, 'Response should contain error message');
  });

  it('rejects discountPct = -1 with 400', async () => {
    const res = await makeRequest(-1, 'QA-NEG-1');
    assert.equal(res.status, 400);
  });

  it('rejects discountPct = 150 with 400', async () => {
    const res = await makeRequest(150, 'QA-OVER-150');
    assert.equal(res.status, 400);
  });

  it('rejects discountPct = 101 with 400', async () => {
    const res = await makeRequest(101, 'QA-OVER-101');
    assert.equal(res.status, 400);
  });

  it('accepts discountPct = 0 with 200', async () => {
    const res = await makeRequest(0, 'QA-ZERO-DISC');
    assert.equal(res.status, 200);
  });

  it('accepts discountPct = 50 with 200', async () => {
    const res = await makeRequest(50, 'QA-HALF-DISC');
    assert.equal(res.status, 200);
  });

  it('accepts discountPct = 100 with 200', async () => {
    const res = await makeRequest(100, 'QA-FULL-DISC');
    assert.equal(res.status, 200);
  });
});
