// Write every folder's README.md and index.html, registry.json and llms.txt from tools/spec.mjs.
//   node tools/docs.mjs          (run it after editing tools/spec.mjs)
//   node tools/docs.mjs --check  (exits 1 if anything is out of date, and changes nothing)
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC, REPO, SITE, AUTHOR, COMMON_LIMITS, COUNT } from './spec.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), check = process.argv.includes('--check');
let stale = 0;
const put = (rel, next) => {
  let was = ''; try { was = readFileSync(join(root, rel), 'utf8'); } catch {}
  if (next !== was) { stale++; if (!check) writeFileSync(join(root, rel), next); console.log(`${check ? 'stale' : 'wrote'} ${rel}`); }
};
const kb = (id) => Math.round(statSync(join(root, id, id + '.js')).size / 1024 / 10) * 10;
const table = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${r.join(' | ')} |`).join('\n');

for (const c of SPEC) {
  // ---- the folder's README
  put(`${c.id}/README.md`, `# ${c.name}

${c.intro.join('\n\n')}

One of ${COUNT} files in this repo. Same idea in each (an ordinary control made of sand that moves like sand), different control.

## Run it

\`\`\`sh
python3 -m http.server 8000     # from the repo folder
# open http://localhost:8000/${c.id}/
\`\`\`

\`?embed=1\` hides the heading and the hint.

## Use it

\`${c.id}.js\` is the whole control: one file of about ${kb(c.id)} KB with the sand engine and its sounds${c.id === 'thinking' ? ' and the rock' : ''} inside it, and no dependencies.

\`\`\`html
${c.use}
\`\`\`

\`\`\`js
${c.js}
\`\`\`

${c.attrs.length ? table(['attribute', 'what it sets', 'default'], c.attrs) + '\n\n' : ''}${c.notes.map((n) => `- ${n}`).join('\n')}

## What happens

${table(['you', 'it'], c.happens)}

## Limits

${[...c.limits, ...COMMON_LIMITS].map((l) => `- ${l}`).join('\n')}
`);

  // ---- the folder's demo page
  const d = c.demo;
  put(`${c.id}/index.html`, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zen Sand ${c.name}</title>
<link rel="icon" href="data:,">
<style>
  :root { --page: #e9e4da; --card: #f1ede5; --ink: #2b2a27; --mute: #7c766b; --line: #d3cbbd; }
  html { overflow-x: clip; background: var(--page); }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: var(--ink); font: 15px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; overflow-x: clip; }
  main { width: min(560px, 100vw - 32px); padding: 40px 0 56px; text-align: center; }
  h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -.01em; }
  .sub { margin: 4px 0 0; color: var(--mute); }
  .stage { display: grid; justify-items: center; gap: 12px; padding: 28px 0 18px; }
  .stage > :is(sand-slider, sand-signature) { width: 100%; }
  .stage > sand-toggle { width: min(220px, 60%); } .stage > sand-thinking { width: min(320px, 80%); }
  .field { width: 100%; display: flex; justify-content: space-between; font-weight: 500; } .field output { color: var(--mute); font-variant-numeric: tabular-nums; }
  .readout { margin: 0; color: var(--mute); }
  .row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .hint { margin: 0 4px; color: var(--mute); font-size: 14px; }
  .pill { font: inherit; font-size: 14px; padding: 6px 15px; border-radius: 99px; border: 1px solid #cfc8bb; background: none; color: inherit; cursor: pointer; }
  .pill.on { background: #3a3631; border-color: #3a3631; color: #f1ede5; }
  #ink { max-width: 100%; border-bottom: 1px solid var(--line); }
  a { color: inherit; } :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  code { font: 13px ui-monospace, monospace; padding: 1px 5px; border-radius: 5px; background: var(--card); border: 1px solid var(--line); }
  .embed body { place-items: start center; min-height: 0; } .embed h1, .embed .sub, .embed .hint, .embed .back { display: none; } .embed main { padding: 8px 0; }
</style>
</head>
<body>
<main>
  <h1>${c.name}</h1>
  <p class="sub">${c.sub} <code>&lt;${c.tag}&gt;</code></p>
  <div class="stage">
    ${d.html}
  </div>
  <p class="hint">${d.hint}</p>
  <p class="hint back"><button class="pill" type="button" id="snd">Sound on</button> · <a href="../gallery/">All ${COUNT}</a> · <a href="https://github.com/${REPO}/blob/main/${c.id}/README.md">Docs</a></p>
</main>
<script src="${c.id}.js"></script>
<script>
// This page's own wiring. The control is all in ${c.id}.js.
// ?embed=1 hides the heading and the hint.
const Q = new URLSearchParams(location.search), el = document.getElementById('el');
if (Q.get('embed') === '1') document.documentElement.classList.add('embed');
document.getElementById('snd').onclick = (e) => { ZenSand.Sound.wake(); e.target.textContent = ZenSand.Sound.toggle() ? 'Sound on' : 'Sound off'; };
${d.script || ''}
</script>
</body>
</html>
`);
}

// ---- registry.json, for `npx shadcn add finktheartist/zen-sand-ui/NAME`
put('registry.json', JSON.stringify({
  $schema: 'https://ui.shadcn.com/schema/registry.json', name: 'zen-sand-ui', homepage: SITE,
  items: SPEC.map((c) => ({
    name: c.id, type: 'registry:file', title: `Zen Sand ${c.name}`,
    description: `${c.desc} One file of about ${kb(c.id)} KB with its sand engine and sounds inside it, no dependencies, defines <${c.tag}>.`,
    author: AUTHOR, categories: c.categories,
    files: [{ path: `${c.id}/${c.id}.js`, type: 'registry:file', target: `~/public/zen-sand-ui/${c.id}.js` }],
    docs: `Zen Sand ${c.name} is a plain script that registers a custom element. Load /zen-sand-ui/${c.id}.js with a script tag (not a module), ${c.docs} More: ${SITE}`,
  })),
}, null, 2) + '\n');

// ---- llms.txt
put('llms.txt', `# Zen Sand UI

> ${COUNT[0].toUpperCase() + COUNT.slice(1)} UI controls made of sand that moves like sand: a slider that is a rake, a toggle that is a stone that hides a symbol, a signature pad you write in with a stick, and an AI thinking state that rakes a different line for each thing the agent does. The sand is a simulated height field lit on the GPU. Each control is one plain script that registers a custom element, with its engine and recorded sounds inside it: no dependencies, no build step, no other files to fetch. MIT licensed.

Live gallery: ${SITE}
Source: https://github.com/${REPO}

## Drop-in controls

Each is one plain script that registers a custom element. Load it with a script tag, not as a module. Do not rewrite or split the file: the sounds (and the thinking state's rock) are inside it as data. Each file carries a copy of the shared engine; the first one loaded sets window.ZenSand and the rest reuse it.

${SPEC.map((c) => `- [${c.name}](${SITE}/${c.id}/${c.id}.js): ${c.desc} \`<${c.tag}>\`: ${c.docs.replace(/^then use /, 'Use ')} [Docs](https://github.com/${REPO}/blob/main/${c.id}/README.md)`).join('\n')}

Install any one with the shadcn CLI: \`npx shadcn add ${REPO}/NAME\`, where NAME is ${SPEC.map((c) => c.id).join(', ')}. The file lands in \`public/zen-sand-ui/\`.

Each scales to its CSS width and needs WebGL2 to draw. They are drawn for a light page. Sound plays after the first touch or key on the page; ZenSand.Sound.on = false silences them all. They do not stop moving for prefers-reduced-motion.

## The skill

- [zen-sand-ui skill](${SITE}/skills/zen-sand-ui/SKILL.md): how the set was made and the rules it follows. Install with \`npx skills add ${REPO}\`.
- [core.js](${SITE}/skills/zen-sand-ui/core.js): the sand engine (height field, slumping, raked lines, the GPU lighting, stones, sound).
- [starter.html](${SITE}/skills/zen-sand-ui/starter.html): the smallest whole example, a tray you draw in with your finger.
- [look.mjs](${SITE}/skills/zen-sand-ui/look.mjs): drives a page with a slowed CPU, measures frame times and saves frames side by side.

## How it was made

- [making-of/README.md](${SITE}/making-of/README.md): the idea, how the sand works, and the corrections that shaped each control.
- [making-of/prompts.md](${SITE}/making-of/prompts.md): every image and sound prompt, in order.
`);
if (check && stale) process.exit(1);
