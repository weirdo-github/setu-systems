# SPEC

## [dlk710/setu-systems] [Finance][Invoices] discountPct not bounded to 0-100; negative discount overcharges the customer

Task id: `github:dlk710/setu-systems#2`

## Goal
### Summary
Invoice `discountPct` is not bounded to 0–100. A **negative** discount inflates the amount the customer is billed (overcharge); a discount **over 100%** is also accepted. The value is stored and used in payable math verbatim.

### Environment
- Repo: dlk710/setu-systems @ e20bb35 (branch main)
- Local, http://127.0.0.1:4173, Node v26.0.0, macOS 26.5
- Seed: db:setup default

### Severity & impact
S2-major — wrong monetary result with direct customer impact. A `discountPct: -50` on a $1000 invoice produces a **$1500 payable** (zelle_amount), i.e. the customer is billed 50% *more* than the base. If such an invoice is sent, the customer is asked to overpay. No validation prevents it.

### Preconditions
- Logged in as Finance admin.

### Steps to reproduce
```
curl -b <fin_cookie> -X POST http://127.0.0.1:4173/api/invoices \
  -H 'Content-Type: application/json' \
  -d '{"form":{"selectedCustomerId":"new","customerName":"QA DiscNeg","customerEmail":"qa.dn@example.com","service":"Authorship","milestone":"QA-DISCNEG","amount":1000,"discountPct":-50,"dueDate":"2026-09-01"},"sendNow":false}'
```
Also try `"discountPct":150` (accepted, stored as 150.00).

### Expected
400 validation error; `discountPct` constrained to 0–100. Negative or >100 rejected.

### Actual
HTTP 200, persisted:
```
 milestone  | base_amount | discount_pct | zelle_amount | card_amount
 QA-DISC    |   1000.00   |    150.00    |     0.00     |   1000.00
 QA-DISCNEG |   1000.00   |    -50.00    |   1500.00    |   1000.00   <- overcharge
```

### Evidence
- DB query above (`select milestone, base_amount, discount_pct, zelle_amount, card_amount from invoices where milestone in ('QA-DISC','QA-DISCNEG')`).

### Suspected area
server/stateStore.js → `createInvoiceRecord` (~line 5973): `const discountPct = Number(form.discountPct || 0)` then `calculateInvoiceAmounts(amount, discountPct, 0)` with no range clamp/validation.

### Regression?
Not checked against prior commits.


## Acceptance criteria
- Repo: dlk710/setu-systems @ e20bb35 (branch main)
- Local, http://127.0.0.1:4173, Node v26.0.0, macOS 26.5
- Seed: db:setup default
- Logged in as Finance admin.
- DB query above (`select milestone, base_amount, discount_pct, zelle_amount, card_amount from invoices where milestone in ('QA-DISC','QA-DISCNEG')`).

## Stack hints
(any)



Produce ALL files as a single JSON response. No markdown fences, no prose — just the JSON object.
