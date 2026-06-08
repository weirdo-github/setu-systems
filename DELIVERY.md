# DELIVERY - Fix discountPct validation (Issue #2)

## Summary

Fixes the bug where `discountPct` values outside 0–100 are accepted, allowing negative discounts to overcharge customers.

## Files Delivered

| File | Purpose |
|------|---------|
| `fix-discount-validation.js` | Patch script that modifies `server/stateStore.js` to add range validation |
| `server/validation/invoiceValidation.js` | Reusable validation module for invoice fields |
| `tests/discount-pct-validation.test.js` | Unit tests for the validation logic |
| `tests/invoice-api-integration.test.js` | Integration tests for the API endpoint |
| `Makefile` | Build/verify targets |

## How to Apply

```bash
# 1. Copy delivered files into the repo root
# 2. Apply the patch:
make apply

# 3. Run unit tests to verify:
make verify

# 4. (Optional) Run integration tests with a running server:
FIN_COOKIE='your_session_cookie' make test-integration
```

## What the Fix Does

1. **Server-side validation**: After `discountPct` is parsed from the form, validates it is a number in [0, 100]
2. **Returns HTTP 400** with error message `"discountPct must be between 0 and 100"` for invalid values
3. **Validation module** (`server/validation/invoiceValidation.js`) can also be imported for use in other areas or client-side

## Manual Patch (if script fails)

In `server/stateStore.js`, find:
```javascript
const discountPct = Number(form.discountPct || 0);
```

Add immediately after:
```javascript
if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
  return res.status(400).json({ success: false, error: 'discountPct must be between 0 and 100' });
}
```

(If `res` is not in scope, throw an error with `statusCode: 400` instead.)

## Verification

```bash
# Unit tests (no server needed)
node --test tests/discount-pct-validation.test.js

# Integration tests (server must be running)
FIN_COOKIE='...' node --test tests/invoice-api-integration.test.js
```

Expected: negative and >100 values return 400; values in [0,100] return 200.
