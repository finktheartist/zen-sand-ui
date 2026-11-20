// node look.mjs URL OUT.png [seconds,seconds,...] [selector]
// Opens a page with the CPU slowed four times (most phones and laptops are slower than the machine you build on),
// photographs the element at each time, puts the frames side by side in OUT.png, and prints the median and 90th
// percentile frame time. 16.7 ms is 60 fps. Run something on the page first with JS='...' (a click, a state change).
// Needs Chrome or Chromium (CHROME=... if it is somewhere unusual); no npm packages.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [URL_, OUT = 'look.png', TIMES = '0.5,1.5,3', SEL = 'body > *'] = process.argv.slice(2);
if (!URL_) { console.log('node look.mjs URL OUT.png [seconds,...] [selector]'); process.exit(1); }
const PORT = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const PROFILE = mkdtempSync(join(tmpdir(), 'look-'));
const chrome = spawn(process.env.CHROME || 'chromium', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=900,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') console.log('ERROR', m.params.exceptionDetails.exception?.description); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, (m) => res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: URL_ }); await sleep(1500);
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
await ev(`window.__fr = []; { let l = performance.now(); const f = (t) => { __fr.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); }`);
if (process.env.JS) await ev(process.env.JS);
const box = JSON.parse(await ev(`JSON.stringify(document.querySelector(${JSON.stringify(SEL)}).getBoundingClientRect())`));
const shots = []; let t0 = Date.now();
for (const s of TIMES.split(',').map(Number)) {
  await sleep(Math.max(0, s * 1000 - (Date.now() - t0)));
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16, scale: 1 } });
  shots.push(r.data);
}
const fr = (await ev('JSON.stringify(__fr.slice(5).sort((a, b) => a - b))')) || '[]', a = JSON.parse(fr), q = (x) => a[Math.floor(a.length * x)]?.toFixed(1);
console.log(`frames ${a.length}, median ${q(0.5)} ms, p90 ${q(0.9)} ms, worst ${a[a.length - 1]?.toFixed(1)} ms (CPU slowed 4x)`);
// side by side, in the page itself so nothing else is needed
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
const sheet = await ev(`(async () => {
  const imgs = await Promise.all(${JSON.stringify(shots)}.map((d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; })));
  const c = document.createElement('canvas'), w = imgs[0].width, h = imgs[0].height; c.width = w * imgs.length + 8 * (imgs.length - 1); c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); imgs.forEach((im, i) => g.drawImage(im, i * (w + 8), 0));
  return c.toDataURL('image/png').split(',')[1]; })()`);
writeFileSync(OUT, Buffer.from(sheet, 'base64')); console.log('wrote', OUT);
ws.close(); chrome.kill(); await sleep(300); try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
