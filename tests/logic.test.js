// Node unit tests for VAT logic. Run: node tests/logic.test.js
const VAT = require('../js/logic.js');
let pass = 0, fail = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'ok - ' : 'FAIL - ') + name + (ok ? '' : ' :: got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)));
  ok ? pass++ : fail++;
}

// Exclusive (add VAT)
eq('1000 @15% exclusive', VAT.calcExclusive(100000, 1500), { net: 100000, vat: 15000, gross: 115000 });
eq('1000 @7.5% exclusive', VAT.calcExclusive(100000, 750), { net: 100000, vat: 7500, gross: 107500 });
eq('0 @15% exclusive', VAT.calcExclusive(0, 1500), { net: 0, vat: 0, gross: 0 });
eq('999.99 @15% rounds half-up', VAT.calcExclusive(99999, 1500), { net: 99999, vat: 15000, gross: 114999 });
eq('333.33 @10% rounds down', VAT.calcExclusive(33333, 1000), { net: 33333, vat: 3333, gross: 36666 });
eq('100 @0% exclusive', VAT.calcExclusive(10000, 0), { net: 10000, vat: 0, gross: 10000 });
eq('100 @100% exclusive doubles', VAT.calcExclusive(10000, 10000), { net: 10000, vat: 10000, gross: 20000 });

// Inclusive (extract VAT)
eq('1150 @15% inclusive', VAT.calcInclusive(115000, 1500), { net: 100000, vat: 15000, gross: 115000 });
eq('1075 @7.5% inclusive', VAT.calcInclusive(107500, 750), { net: 100000, vat: 7500, gross: 107500 });
eq('1150 @15% round-trip inverse', (() => { const e = VAT.calcExclusive(100000, 1500); return VAT.calcInclusive(e.gross, 1500); })(), { net: 100000, vat: 15000, gross: 115000 });
eq('100 @0% inclusive', VAT.calcInclusive(10000, 0), { net: 10000, vat: 0, gross: 10000 });

// Invoice totals: 2x500 @15% + 1x1000 @5%
const lines = [
  { desc: 'A', qty: 2, unitPaisa: 50000, rateBp: 1500 },
  { desc: 'B', qty: 1, unitPaisa: 100000, rateBp: 500 }
];
eq('invoice net/vat/gross', VAT.invoiceTotals(lines), { net: 200000, vat: 20000, gross: 220000 });
eq('line totals A', VAT.lineTotals(lines[0]), { net: 100000, vat: 15000, gross: 115000 });
eq('empty invoice', VAT.invoiceTotals([]), { net: 0, vat: 0, gross: 0 });

// Formatting
eq('fmt 115000 EN', VAT.fmtPaisa(115000, false), '1,150.00');
eq('fmt 115000 BN', VAT.fmtPaisa(115000, true), '১,১৫০.০০');
eq('fmt 0', VAT.fmtPaisa(0, false), '0.00');
eq('fmt 5 paisa', VAT.fmtPaisa(5, false), '0.05');
eq('fmtRate 750', VAT.fmtRateBp(750, false), '7.5%');
eq('fmtRate 1500 BN', VAT.fmtRateBp(1500, true), '১৫%');
eq('toPaisa 1000.005 rounds', VAT.toPaisa(1000.005), 100001);
eq('toBnDigits', VAT.toBnDigits('2026-10-27'), '২০২৬-১০-২৭');

// Validation
eq('errAmount empty', VAT.errAmount(''), 'errRequired');
eq('errAmount abc', VAT.errAmount('abc'), 'errNumber');
eq('errAmount negative', VAT.errAmount('-5'), 'errNegative');
eq('errAmount ok', VAT.errAmount('1000'), null);
eq('errQty 2.5', VAT.errQty('2.5'), 'errQtyInt');
eq('errQty 0', VAT.errQty('0'), 'errQtyMin');
eq('errQty ok', VAT.errQty('3'), null);
eq('errRate 10001bp', VAT.errRateBp(10001), 'errRateRange');
eq('errRate ok', VAT.errRateBp(750), null);
eq('errDesc empty', VAT.errDesc('  '), 'errRequired');
eq('errDesc ok', VAT.errDesc('Rice'), null);

// Strict import validation
const good = { app: 'vat-calculator-bd', version: 1, history: [
  { kind: 'quick', net: 100000, vat: 15000, gross: 115000, rateBp: 1500, at: 1700000000000 },
  { kind: 'invoice', net: 200000, vat: 20000, gross: 220000, at: 1700000000000 }
]};
eq('import good', VAT.validateImport(good), null);
eq('import wrong app', VAT.validateImport({ app: 'other', version: 1, history: [] }), 'badApp');
eq('import bad sum', VAT.validateImport({ app: 'vat-calculator-bd', version: 1, history: [
  { kind: 'quick', net: 100000, vat: 15000, gross: 999999, rateBp: 1500, at: 1 } ] }), 'badSum');
eq('import bad kind', VAT.validateImport({ app: 'vat-calculator-bd', version: 1, history: [
  { kind: 'x', net: 0, vat: 0, gross: 0, at: 1 } ] }), 'badKind');
eq('import float money', VAT.validateImport({ app: 'vat-calculator-bd', version: 1, history: [
  { kind: 'quick', net: 1000.5, vat: 0, gross: 1000.5, at: 1 } ] }), 'badMoney');
eq('import not object', VAT.validateImport([1, 2]), 'badRoot');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
