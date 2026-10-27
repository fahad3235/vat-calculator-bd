// VAT Calculator BD — UI controller. All money in integer paisa (see logic.js).
(function () {
  'use strict';
  var VAT = window.VAT;
  var I18N = window.VAT_I18N;
  var LS_KEY = 'vat-calculator-bd-v1';

  var state = load() || { lang: 'en', history: [], lines: [] };
  var rateBp = 1500;          // currently selected quick-calc rate
  var lastQuick = null;       // last calculated quick result (for Save)

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return null;
      return {
        lang: d.lang === 'bn' ? 'bn' : 'en',
        history: Array.isArray(d.history) ? d.history : [],
        lines: Array.isArray(d.lines) ? d.lines : []
      };
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function t(key) { return I18N[state.lang][key] || I18N.en[key] || key; }
  function bn() { return state.lang === 'bn'; }
  function fmt(paisa) { return '৳' + VAT.fmtPaisa(paisa, bn()); }
  function $ (id) { return document.getElementById(id); }
  function showErr(id, key) {
    var el = $(id);
    el.textContent = key ? t(key) : '';
    el.style.display = key ? 'block' : 'none';
  }
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }

  // ---------- Language + tabs ----------
  function renderLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('langBtn').textContent = bn() ? 'English' : 'বাংলা';
    document.documentElement.lang = bn() ? 'bn' : 'en';
    renderQuickResult(); renderLines(); renderHistory();
  }
  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.style.display = p.id === 'panel-' + name ? 'block' : 'none';
    });
  }

  // ---------- Quick calc ----------
  function renderRateButtons() {
    var wrap = $('ratePresets');
    wrap.innerHTML = '';
    VAT.RATE_PRESETS.forEach(function (bp) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rate-btn' + (bp === rateBp ? ' active' : '');
      b.textContent = VAT.fmtRateBp(bp, bn());
      b.onclick = function () {
        rateBp = bp; $('customRate').value = '';
        renderRateButtons();
      };
      wrap.appendChild(b);
    });
  }
  function effectiveRate() {
    var custom = $('customRate').value.trim();
    if (custom !== '') {
      var n = Number(custom);
      if (!isFinite(n)) return { err: 'errNumber' };
      var bp = Math.round(n * 100);
      var e = VAT.errRateBp(bp);
      if (e) return { err: e };
      return { bp: bp };
    }
    return { bp: rateBp };
  }
  function doQuickCalc() {
    var aErr = VAT.errAmount($('qAmount').value);
    showErr('qAmountErr', aErr);
    var r = effectiveRate();
    showErr('customRateErr', r.err || null);
    if (aErr || r.err) { lastQuick = null; renderQuickResult(); return; }
    var paisa = VAT.toPaisa($('qAmount').value);
    var mode = document.querySelector('input[name="qMode"]:checked').value;
    lastQuick = mode === 'inclusive'
      ? VAT.calcInclusive(paisa, r.bp)
      : VAT.calcExclusive(paisa, r.bp);
    lastQuick.rateBp = r.bp;
    lastQuick.mode = mode;
    renderQuickResult();
  }
  function renderQuickResult() {
    var box = $('qResult');
    if (!lastQuick) { box.innerHTML = '<p class="hint">' + t('resultHint') + '</p>'; $('qSave').disabled = true; return; }
    box.innerHTML =
      '<div class="result-row"><span>' + t('net') + '</span><strong>' + fmt(lastQuick.net) + '</strong></div>' +
      '<div class="result-row"><span>' + t('vat') + ' (' + VAT.fmtRateBp(lastQuick.rateBp, bn()) + ')</span><strong>' + fmt(lastQuick.vat) + '</strong></div>' +
      '<div class="result-row total"><span>' + t('gross') + '</span><strong>' + fmt(lastQuick.gross) + '</strong></div>';
    $('qSave').disabled = false;
  }

  // ---------- Invoice ----------
  function renderLines() {
    var body = $('lineBody');
    body.innerHTML = '';
    if (!state.lines.length) {
      $('lineEmpty').style.display = 'block';
    } else {
      $('lineEmpty').style.display = 'none';
      state.lines.forEach(function (line, i) {
        var lt = VAT.lineTotals(line);
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(line.desc) + '</td>' +
          '<td>' + (bn() ? VAT.toBnDigits(String(line.qty)) : line.qty) + '</td>' +
          '<td>' + fmt(line.unitPaisa) + '</td>' +
          '<td>' + VAT.fmtRateBp(line.rateBp, bn()) + '</td>' +
          '<td>' + fmt(lt.net) + '</td>' +
          '<td>' + fmt(lt.vat) + '</td>' +
          '<td>' + fmt(lt.gross) + '</td>' +
          '<td><button type="button" class="mini-btn" data-i="' + i + '">✕</button></td>';
        tr.querySelector('button').onclick = function () {
          state.lines.splice(i, 1); save(); renderLines();
        };
        body.appendChild(tr);
      });
    }
    var tot = VAT.invoiceTotals(state.lines);
    $('invNet').textContent = fmt(tot.net);
    $('invVat').textContent = fmt(tot.vat);
    $('invGross').textContent = fmt(tot.gross);
    $('invSave').disabled = !state.lines.length;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function addLine() {
    var dErr = VAT.errDesc($('lineDesc').value);
    var qErr = VAT.errQty($('lineQty').value);
    var pErr = VAT.errAmount($('linePrice').value);
    showErr('lineDescErr', dErr); showErr('lineQtyErr', qErr); showErr('linePriceErr', pErr);
    if (dErr || qErr || pErr) return;
    state.lines.push({
      desc: $('lineDesc').value.trim(),
      qty: Number($('lineQty').value),
      unitPaisa: VAT.toPaisa($('linePrice').value),
      rateBp: Number($('lineRate').value)
    });
    $('lineDesc').value = ''; $('lineQty').value = ''; $('linePrice').value = '';
    save(); renderLines(); toast(t('lineAdded'));
  }

  // ---------- History ----------
  function renderHistory() {
    var list = $('historyList');
    list.innerHTML = '';
    if (!state.history.length) {
      list.innerHTML = '<p class="hint">' + t('noHistory') + '</p>';
      $('histClear').disabled = true;
      return;
    }
    $('histClear').disabled = false;
    state.history.slice().reverse().forEach(function (h, ri) {
      var i = state.history.length - 1 - ri;
      var d = new Date(h.at);
      var when = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if (bn()) when = VAT.toBnDigits(when);
      var div = document.createElement('div');
      div.className = 'hist-item';
      div.innerHTML =
        '<div><strong>' + (h.kind === 'invoice' ? t('tabInvoice') : t('tabQuick')) + '</strong>' +
        (h.rateBp !== undefined ? ' · ' + VAT.fmtRateBp(h.rateBp, bn()) : '') +
        ' · <span class="muted">' + when + '</span></div>' +
        '<div>' + t('net') + ' ' + fmt(h.net) + ' · ' + t('vat') + ' ' + fmt(h.vat) +
        ' · <strong>' + t('gross') + ' ' + fmt(h.gross) + '</strong></div>' +
        '<button type="button" class="mini-btn">' + t('deleteBtn') + '</button>';
      div.querySelector('button').onclick = function () {
        state.history.splice(i, 1); save(); renderHistory();
      };
      list.appendChild(div);
    });
  }
  function pushHistory(entry) {
    entry.at = Date.now();
    state.history.push(entry);
    if (state.history.length > 500) state.history = state.history.slice(-500);
    save(); renderHistory();
  }

  // ---------- Data tab ----------
  function exportJSON() {
    var data = { app: 'vat-calculator-bd', version: 1, history: state.history };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vat-calculator-bd-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var err = VAT.validateImport(data);
        if (err) { toast(t('importBad')); return; }
        state.history = data.history;
        save(); renderHistory(); toast(t('importOk'));
      } catch (e) { toast(t('importBad')); }
    };
    reader.readAsText(file);
  }

  // ---------- Wire-up ----------
  document.addEventListener('DOMContentLoaded', function () {
    $('langBtn').onclick = function () {
      state.lang = bn() ? 'en' : 'bn'; save(); renderLang(); renderRateButtons();
    };
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-tab')); };
    });
    $('qCalc').onclick = doQuickCalc;
    $('qAmount').addEventListener('keydown', function (e) { if (e.key === 'Enter') doQuickCalc(); });
    $('qSave').onclick = function () {
      if (!lastQuick) return;
      pushHistory({ kind: 'quick', net: lastQuick.net, vat: lastQuick.vat, gross: lastQuick.gross, rateBp: lastQuick.rateBp });
      toast(t('quickSaved'));
    };
    $('lineAdd').onclick = addLine;
    $('lineClear').onclick = function () { state.lines = []; save(); renderLines(); };
    $('invSave').onclick = function () {
      var tot = VAT.invoiceTotals(state.lines);
      pushHistory({ kind: 'invoice', net: tot.net, vat: tot.vat, gross: tot.gross });
      toast(t('invoiceSaved'));
    };
    $('histClear').onclick = function () { state.history = []; save(); renderHistory(); };
    $('exportBtn').onclick = exportJSON;
    $('importFile').addEventListener('change', function () {
      if (this.files[0]) importJSON(this.files[0]);
      this.value = '';
    });
    $('eraseBtn').onclick = function () {
      if ($('eraseConfirm').value.trim() !== 'DELETE') return;
      state.history = []; state.lines = []; lastQuick = null;
      $('eraseConfirm').value = '';
      save(); renderHistory(); renderLines(); renderQuickResult(); toast(t('erased'));
    };
    // Invoice rate select options
    var sel = $('lineRate');
    VAT.RATE_PRESETS.forEach(function (bp) {
      var o = document.createElement('option');
      o.value = bp; o.textContent = VAT.fmtRateBp(bp, false);
      sel.appendChild(o);
    });
    renderLang(); renderRateButtons(); renderQuickResult();
    switchTab('quick');
  });

  // Smoke-test hooks.
  window.__vat = {
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    getLastQuick: function () { return lastQuick; },
    getLang: function () { return state.lang; }
  };
})();
