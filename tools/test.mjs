// node tools/test.mjs [URL]   drives every control in the gallery with real touch and key events at phone width,
// checks form values and sideways scroll, and exits 1 on a failure. Needs Chrome or Chromium (CHROME=... if it is
// somewhere unusual) and the repo being served: python3 -m http.server 8000, then the default URL works.
import { spawn } from 'node:child_process';
import { rmSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const URL_ = process.argv[2] || 'http://localhost:8000/gallery/';
const PORT = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const PROFILE = mkdtempSync(join(tmpdir(), 'zs-'));
const chrome = spawn(process.env.CHROME || 'chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (Array.isArray(targets) && targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) logs.push('EVAL ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await send('Page.enable'); await send('Page.navigate', { url: URL_ }); await sleep(1800);
// E(tag) is the element; a point in it is given as fractions of its box
const E = (tag) => `document.querySelector('${tag}')`;
const at = async (tag, fx = 0.5, fy = 0.5) => JSON.parse(await ev(`(() => { const e = ${E(tag)}; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return JSON.stringify([b.left + b.width * ${fx}, b.top + b.height * ${fy}]); })()`));
const touch = (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const tap = async (tag, fx, fy) => { const [x, y] = await at(tag, fx, fy); await sleep(150); await touch('touchStart', x, y); await touch('touchEnd', x, y); };
const swipe = async (x0, y0, x1, y1) => { await touch('touchStart', x0, y0); for (let i = 1; i <= 6; i++) { await touch('touchMove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await sleep(30); } await touch('touchEnd', x1, y1); };
const key = async (k, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code, ...(k === 'Enter' ? { text: '\r' } : k === ' ' ? { text: ' ' } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code }); };
const focus = (tag) => ev(`${E(tag)}.focus()`);
// count the events each element fires, so a check can ask whether change really reached the page
await ev(`window.__n = {}; for (const t of ['click', 'input', 'change', 'submit']) document.addEventListener(t, (e) => { const k = e.target.localName + ' ' + t; __n[k] = (__n[k] || 0) + 1; })`);
const fired = (k) => ev(`__n[${JSON.stringify(k)}] || 0`);
let fails = 0;
const check = (name, ok, got) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${got !== undefined ? `  ->  ${got}` : ''}`); };

{ // slider: a sideways drag moves it, a vertical swipe does not, and the arrow keys do
  const val = () => ev(`${E('sand-slider')}.value`);
  const [x0, y] = await at('sand-slider', 0.45, 0.5), [x1] = await at('sand-slider', 0.9, 0.5); await sleep(200);
  await swipe(x0, y, x1, y); await sleep(1200); const v1 = await val();
  check('slider: sideways drag raises it, with input and a change', v1 > 75 && (await fired('sand-slider input')) > 0 && (await fired('sand-slider change')) >= 1, v1);
  await swipe(x0, y, x0 + 2, y - 70); await sleep(600);
  check('slider: a vertical swipe leaves it alone', (await val()) === v1, await val());
  await focus('sand-slider'); await key('ArrowLeft', 37); await sleep(900);
  check('slider: ArrowLeft lowers it by one step', (await val()) === v1 - 1, await val());
  await key('Home', 36); await sleep(1500);
  check('slider: Home takes it to the minimum', (await val()) === 0, await val());
}
{ // toggle: tap on, Space off, a vertical swipe switches nothing
  const on = () => ev(`${E('sand-toggle')}.checked`);
  await tap('sand-toggle'); await sleep(300);
  check('toggle: tap switches it on and fires change', (await on()) === true && (await fired('sand-toggle change')) === 1);
  await focus('sand-toggle'); await key(' ', 32); await sleep(300);
  check('toggle: Space switches it off', (await on()) === false);
  const [x, y] = await at('sand-toggle', 0.5, 0.5); await sleep(150); await swipe(x, y, x + 3, y - 80); await sleep(400);
  check('toggle: a vertical swipe switches nothing', (await on()) === false && (await fired('sand-toggle change')) === 2, await fired('sand-toggle change'));
}
{ // signature: a stroke, then Backspace takes it away
  const [x0, y0] = await at('sand-signature', 0.25, 0.5), [x1, y1] = await at('sand-signature', 0.7, 0.4); await sleep(200);
  await swipe(x0, y0, x1, y1); await sleep(300);
  check('signature: a stroke signs it and fires input', (await ev(`${E('sand-signature')}.empty`)) === false && (await fired('sand-signature input')) >= 1);
  check('signature: toDataURL gives a PNG', /^data:image\/png;base64,/.test(await ev(`${E('sand-signature')}.toDataURL()`)));
  await focus('sand-signature'); await key('Backspace', 8); await sleep(500);
  check('signature: Backspace undoes it', (await ev(`${E('sand-signature')}.empty`)) === true);
}
{ // thinking: the state is what a screen reader hears
  await ev(`${E('sand-thinking')}.state = 'searching'`); await sleep(200);
  check('thinking: searching is read out as Searching', (await ev(`${E('sand-thinking')}.getAttribute('aria-label')`)) === 'Searching');
  await ev(`${E('sand-thinking')}.state = 'idle'`); await sleep(200);
  check('thinking: idle is Ready and not busy', (await ev(`${E('sand-thinking')}.getAttribute('aria-label') + ' ' + ${E('sand-thinking')}.getAttribute('aria-busy')`)) === 'Ready false');
}
{ // forms: the value controls are sent with a form
  const got = await ev(`(() => {
    const f = document.createElement('form');
    f.innerHTML = '<sand-slider name="s" value="30"></sand-slider><sand-toggle name="t" checked></sand-toggle>';
    document.body.append(f); const out = JSON.stringify(Object.fromEntries(new FormData(f))); f.remove(); return out; })()`);
  check('forms: slider and toggle are in the FormData', got === JSON.stringify({ s: '30', t: 'on' }), got);
}
{ // scaling: the height follows the width
  const got = await ev(`(() => { const e = document.createElement('sand-toggle'); e.style.width = '150px'; document.body.append(e); const b = e.getBoundingClientRect(); e.remove(); return b.width + ' ' + Math.round(b.height); })()`);
  check('scaling: a toggle 150 wide is 66 high', got === '150 66', got);
}
const wide = await ev('document.documentElement.scrollWidth'); check('no sideways scroll at 390', wide <= 390, wide);
check('no script errors', !logs.length, logs.join(' | '));
ws.close(); chrome.kill(); await sleep(300); try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(fails ? 1 : 0);
