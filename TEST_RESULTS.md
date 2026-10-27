# TEST RESULTS — vat-calculator-bd (run #154, 2026-10-27)

## Node unit tests — 39/39 passed
`node tests/logic.test.js` — exclusive/inclusive VAT math (incl. 7.5%, 12.5%,
0%, 100%, rounding edges), invoice totals (2×500 @15% + 1×1000 @5% → net 2000 /
VAT 200 / gross 2200), paisa + Bengali-digit formatting, amount/qty/rate/desc
validation, and strict import validation (wrong app, bad sum, bad kind, float
money, non-object root all rejected).

## Headless-Chrome smoke — 29/29 passed
`node tests/smoke.js` (raw CDP, /opt/meta-chromium/chrome, file://) — title,
4 tabs, 5 rate presets, exclusive 1000 @15% → 150/1150, inclusive 1150 @15% →
net 1000, custom 12.5% → VAT 125, empty-amount + out-of-range-rate inline
errors, quick save → history 1, invoice line 2×500 @15% → 1000/150/1150,
invoice save → history 2, fractional qty rejected with row count intact,
history tab renders 2 items, history + invoice lines persist after reload,
বাংলা toggle (title + Bengali digits ৳১,০০০.০০) + lang persisted, 390px mobile
no horizontal overflow, 0 console/page errors.

## Repairs
- 1 test-harness fix only: a smoke assertion referenced `document` in Node
  context instead of through the CDP evaluate helper. 0 app-logic bugs.
