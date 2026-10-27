# VAT Calculator BD

A free, fully offline, bilingual (English / বাংলা) VAT calculator for Bangladesh.
Calculate VAT on any amount, build multi-line invoices with per-line rates, and
keep a saved history — all in your browser, with no account and no network calls.

Live: https://fahad3235.github.io/vat-calculator-bd/

## Features

1. **Quick VAT calculation** — enter an amount and a rate; get net, VAT, and gross.
   Works both ways: amount excluding VAT (VAT added on top) or amount already
   including VAT (net extracted).
2. **VAT rate presets + custom rate** — one-tap 15%, 10%, 7.5%, 5%, and 0% presets,
   or any custom rate from 0% to 100%.
3. **Invoice builder** — add lines (description, quantity, unit price, per-line
   rate) with live net / VAT / total per line and grand totals.
4. **Saved history** — save quick results and invoice totals; entries persist
   across reloads and can be deleted individually or cleared.
5. **Export / import / erase** — download history as JSON, import a previous
   export (strictly validated — malformed files are rejected with data intact),
   or erase everything with a typed `DELETE` confirmation.
6. **Bilingual + Bengali digits** — EN/বাংলা toggle persisted across reloads;
   amounts render in Bengali digits in বাংলা mode. Fully responsive at 390px.

## Money math

All amounts are integer **paisa** (1 taka = 100 paisa) and rates are integer
**basis points** (15% = 1500), so 7.5% and 12.5% are exact and there is no
floating-point drift. VAT is rounded to the nearest paisa per calculation.

Hand-verified examples:

| Case | Result |
|---|---|
| ৳1,000 @ 15% (net) | VAT ৳150.00, gross ৳1,150.00 |
| ৳1,150 @ 15% (gross) | net ৳1,000.00, VAT ৳150.00 |
| ৳1,000 @ 12.5% custom (net) | VAT ৳125.00 |
| Invoice 2×৳500 @15% + 1×৳1,000 @5% | net ৳2,000.00, VAT ৳200.00, gross ৳2,200.00 |

## Stack

Vanilla HTML / CSS / JavaScript — no frameworks, no build step, no CDN, no
network requests. Data lives only in the browser's `localStorage`.

## Run locally

```sh
# any static server, or just open the file:
open index.html
# tests (needs node + the Chromium at /opt/meta-chromium/chrome for smoke):
node tests/logic.test.js
node tests/smoke.js
```

## Project layout

```
index.html        UI shell (4 tabs: Quick / Invoice / History / Data)
css/style.css     Responsive styles
js/logic.js       Pure VAT math + validation (node- and browser-compatible)
js/i18n.js        English / বাংলা strings
js/app.js         UI controller + localStorage persistence
tests/logic.test.js  39 node unit tests
tests/smoke.js    29 headless-Chrome checks (raw CDP)
```

## Limitations

- The rate presets are **common NBR VAT rates for reference only**. Bangladesh's
  VAT schedule has reduced rates, exemptions, and supplementary duty that vary
  by goods and services — always verify the current schedule before filing or
  charging a customer.
- This is a personal calculator, **not tax advice** and not accounting software.
- History is stored only in this browser's `localStorage`; clearing browser
  data erases it (export first if it matters).

## Status

Complete and verified: 39/39 unit tests + 29/29 headless-Chrome checks,
0 console/page errors. Ships empty — no demo data, no fabricated prices.
