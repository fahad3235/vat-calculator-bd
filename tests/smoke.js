// Headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js — exits non-zero on any failure or page error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9347;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const pageErrors = [];
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/vat-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const click = async (id) => ev(`document.getElementById('${id}').click()`);
  const setVal = async (id, v) => ev(`document.getElementById('${id}').value = '${v}'`);
  const text = async (id) => ev(`document.getElementById('${id}').textContent`);

  check('title contains VAT', (await ev('document.title'))?.includes('VAT'));
  check('4 tabs present', (await ev(`document.querySelectorAll('.tab-btn').length`)) === 4);
  check('5 rate presets', (await ev(`document.querySelectorAll('.rate-btn').length`)) === 5);
  check('quick result hint initially', (await text('qResult')).includes('Enter an amount'));

  // Exclusive: 1000 @15% -> VAT 150, gross 1150
  await setVal('qAmount', '1000');
  await click('qCalc'); await wait(200);
  let res = await text('qResult');
  check('exclusive net 1,000.00', res.includes('৳1,000.00'), res);
  check('exclusive VAT 150.00', res.includes('৳150.00'), res);
  check('exclusive gross 1,150.00', res.includes('৳1,150.00'), res);
  check('save button enabled after calc', (await ev(`document.getElementById('qSave').disabled`)) === false);

  // Inclusive: 1150 @15% -> net 1000
  await setVal('qAmount', '1150');
  await ev(`document.querySelector('input[name="qMode"][value="inclusive"]').click()`);
  await click('qCalc'); await wait(200);
  res = await text('qResult');
  check('inclusive net 1,000.00', res.includes('৳1,000.00'), res);
  check('inclusive VAT 150.00', res.includes('৳150.00'), res);

  // Custom rate 12.5% on 1000 exclusive -> VAT 125
  await ev(`document.querySelector('input[name="qMode"][value="exclusive"]').click()`);
  await setVal('qAmount', '1000');
  await setVal('customRate', '12.5');
  await click('qCalc'); await wait(200);
  res = await text('qResult');
  check('custom 12.5% VAT 125.00', res.includes('৳125.00'), res);

  // Validation: empty amount shows inline error
  await setVal('qAmount', '');
  await setVal('customRate', '');
  await click('qCalc'); await wait(200);
  check('empty amount error visible', (await ev(`document.getElementById('qAmountErr').style.display`)) === 'block');
  await setVal('qAmount', '100');
  await setVal('customRate', '150');
  await click('qCalc'); await wait(200);
  check('bad custom rate error', (await ev(`document.getElementById('customRateErr').style.display`)) === 'block');

  // Save quick calc, then invoice flow
  await setVal('qAmount', '1000'); await setVal('customRate', '');
  await click('qCalc'); await wait(200);
  await click('qSave'); await wait(300);
  check('history has 1 entry after quick save', (await ev(`window.__vat.getState().history.length`)) === 1);

  await ev(`document.querySelector('[data-tab="invoice"]').click()`); await wait(200);
  await setVal('lineDesc', 'Notebook');
  await setVal('lineQty', '2');
  await setVal('linePrice', '500');
  await click('lineAdd'); await wait(300);
  check('invoice line row added', (await ev(`document.querySelectorAll('#lineBody tr').length`)) === 1);
  check('invoice net 1,000.00', (await text('invNet')) === '৳1,000.00', await text('invNet'));
  check('invoice VAT 150.00', (await text('invVat')) === '৳150.00', await text('invVat'));
  check('invoice gross 1,150.00', (await text('invGross')) === '৳1,150.00', await text('invGross'));
  await click('invSave'); await wait(300);
  check('history has 2 entries after invoice save', (await ev(`window.__vat.getState().history.length`)) === 2);

  // Invalid line rejected inline
  await setVal('lineDesc', 'Bad'); await setVal('lineQty', '2.5'); await setVal('linePrice', '10');
  await click('lineAdd'); await wait(200);
  check('fractional qty rejected', (await ev(`document.getElementById('lineQtyErr').style.display`)) === 'block');
  check('row count still 1', (await ev(`document.querySelectorAll('#lineBody tr').length`)) === 1);

  // History tab renders 2 items
  await ev(`document.querySelector('[data-tab="history"]').click()`); await wait(200);
  check('history tab shows 2 items', (await ev(`document.querySelectorAll('.hist-item').length`)) === 2);

  // Reload persistence (same user-data-dir keeps localStorage)
  await send('Page.navigate', { url: FILE }); await wait(1500);
  check('history persists after reload', (await ev(`window.__vat.getState().history.length`)) === 2);
  check('invoice lines persist after reload', (await ev(`window.__vat.getState().lines.length`)) === 1);

  // BN toggle: Bengali title + Bengali digits in results
  await click('langBtn'); await wait(400);
  check('BN title', (await ev(`document.querySelector('[data-i18n="title"]').textContent`)) === 'ভ্যাট ক্যালকুলেটর বিডি');
  await ev(`document.querySelector('[data-tab="quick"]').click()`); await wait(200);
  await setVal('qAmount', '1000'); await setVal('customRate', '');
  await click('qCalc'); await wait(200);
  res = await text('qResult');
  check('BN digits in result', res.includes('৳১,০০০.০০') && res.includes('৳১৫০.০০'), res);
  check('lang persisted as bn', (await ev(`window.__vat.getLang()`)) === 'bn');
  await click('langBtn'); await wait(300);

  // 390px mobile: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: FILE }); await wait(1500);
  const overflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  check('390px no horizontal overflow', overflow === false, 'scrollWidth overflow');
  check('390px tabs still visible', (await ev(`document.querySelectorAll('.tab-btn').length`)) === 4);

  check('zero console/page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 400));
  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' FAILURES'}`);
  chrome.kill('SIGKILL');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); process.exit(2); });
