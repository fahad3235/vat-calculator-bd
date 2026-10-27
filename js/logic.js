// VAT Calculator BD — pure logic (no DOM). Money is integer paisa to avoid
// float error. Rates are integer basis points (15% = 1500) so 7.5% is exact.
(function (root) {
  'use strict';

  // Common NBR VAT rate presets (basis points). Custom rates allowed 0–100%.
  var RATE_PRESETS = [1500, 1000, 750, 500, 0];
  var MAX_RATE_BP = 10000;

  function toPaisa(bdt) {
    var n = Number(bdt);
    if (!isFinite(n)) return NaN;
    return Math.round(n * 100);
  }

  function fromPaisa(paisa) { return paisa / 100; }

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBnDigits(str) {
    return String(str).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  // Format integer paisa as "1,150.00" (or with Bengali digits when bn=true).
  function fmtPaisa(paisa, bn) {
    var neg = paisa < 0;
    var abs = Math.abs(paisa);
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
      '.' + (frac < 10 ? '0' : '') + frac;
    if (neg) s = '-' + s;
    return bn ? toBnDigits(s) : s;
  }

  function fmtRateBp(bp, bn) {
    var whole = Math.floor(bp / 100);
    var frac = bp % 100;
    var s = frac === 0 ? String(whole) : (bp / 100).toFixed(2).replace(/0$/, '');
    return (bn ? toBnDigits(s) : s) + '%';
  }

  // Exclusive: amount is the net; VAT is added on top.
  function calcExclusive(netPaisa, rateBp) {
    var vat = Math.round(netPaisa * rateBp / 10000);
    return { net: netPaisa, vat: vat, gross: netPaisa + vat };
  }

  // Inclusive: amount already contains VAT; extract the net.
  function calcInclusive(grossPaisa, rateBp) {
    var net = Math.round(grossPaisa * 10000 / (10000 + rateBp));
    return { net: net, vat: grossPaisa - net, gross: grossPaisa };
  }

  function lineTotals(line) {
    var net = line.qty * line.unitPaisa;
    var vat = Math.round(net * line.rateBp / 10000);
    return { net: net, vat: vat, gross: net + vat };
  }

  function invoiceTotals(lines) {
    var t = { net: 0, vat: 0, gross: 0 };
    lines.forEach(function (l) {
      var lt = lineTotals(l);
      t.net += lt.net; t.vat += lt.vat; t.gross += lt.gross;
    });
    return t;
  }

  // ---- Validation (return error key string, or null when valid) ----
  function errAmount(v) {
    if (v === '' || v === null || v === undefined) return 'errRequired';
    var n = Number(v);
    if (!isFinite(n)) return 'errNumber';
    if (n < 0) return 'errNegative';
    if (n > 1000000000) return 'errTooLarge';
    return null;
  }
  function errQty(v) {
    if (v === '' || v === null || v === undefined) return 'errRequired';
    var n = Number(v);
    if (!isFinite(n) || Math.floor(n) !== n) return 'errQtyInt';
    if (n < 1) return 'errQtyMin';
    if (n > 100000) return 'errTooLarge';
    return null;
  }
  function errRateBp(bp) {
    if (!isFinite(bp) || Math.floor(bp) !== bp) return 'errNumber';
    if (bp < 0 || bp > MAX_RATE_BP) return 'errRateRange';
    return null;
  }
  function errDesc(v) {
    if (!v || !String(v).trim()) return 'errRequired';
    if (String(v).length > 80) return 'errTooLong';
    return null;
  }

  // ---- Strict import validation ----
  // Accepted shape: { app: 'vat-calculator-bd', version: 1, history: [...] }
  // History entries: { kind: 'quick'|'invoice', net, vat, gross, rateBp?, at }
  // (rateBp optional for invoice entries; all money fields integer paisa.)
  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'badRoot';
    if (data.app !== 'vat-calculator-bd' || data.version !== 1) return 'badApp';
    if (!Array.isArray(data.history)) return 'badHistory';
    if (data.history.length > 500) return 'tooMany';
    for (var i = 0; i < data.history.length; i++) {
      var h = data.history[i];
      if (!h || typeof h !== 'object') return 'badEntry';
      if (h.kind !== 'quick' && h.kind !== 'invoice') return 'badKind';
      if (!Number.isInteger(h.net) || !Number.isInteger(h.vat) ||
          !Number.isInteger(h.gross)) return 'badMoney';
      if (h.net < 0 || h.vat < 0 || h.gross < 0) return 'badMoney';
      if (h.net + h.vat !== h.gross) return 'badSum';
      if (h.rateBp !== undefined &&
          (!Number.isInteger(h.rateBp) || h.rateBp < 0 || h.rateBp > MAX_RATE_BP)) return 'badRate';
      if (typeof h.at !== 'number' || !isFinite(h.at)) return 'badTime';
    }
    return null;
  }

  var api = {
    RATE_PRESETS: RATE_PRESETS, MAX_RATE_BP: MAX_RATE_BP,
    toPaisa: toPaisa, fromPaisa: fromPaisa, toBnDigits: toBnDigits,
    fmtPaisa: fmtPaisa, fmtRateBp: fmtRateBp,
    calcExclusive: calcExclusive, calcInclusive: calcInclusive,
    lineTotals: lineTotals, invoiceTotals: invoiceTotals,
    errAmount: errAmount, errQty: errQty, errRateBp: errRateBp, errDesc: errDesc,
    validateImport: validateImport
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VAT = api;
})(typeof window !== 'undefined' ? window : globalThis);
