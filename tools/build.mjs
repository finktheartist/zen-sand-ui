// Stamp core.js, the sounds and the art into every control file, so each file works on its own.
//   node tools/build.mjs          (run it after editing core.js, a file in sounds/ or art/, or the lists below)
//   node tools/build.mjs --check  (exits 1 if any file is out of date, and changes nothing)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The sounds each control plays, by the name it plays them under, and the file in sounds/ each comes from.
// A name ending in -b is a second take of the same sound; play('tap') picks one of the two.
const LOOP = { loop: 'rake-loop.wav' };
const one = (...names) => Object.fromEntries(names.map((n) => [n, n + '.mp3']));
export const SOUNDS = {
  slider: { ...LOOP, ...one('settle', 'settle-b', 'sweep', 'tap', 'tap-b') },
  toggle: { ...LOOP, ...one('settle', 'settle-b', 'stone', 'stone-b') },
  signature: { ...LOOP, ...one('settle', 'settle-b', 'sweep') },
  thinking: { drift: 'drift-loop.wav', flow: 'flow-loop.wav', ...one('settle', 'settle-b', 'reach', 'reach-b', 'scratch', 'scratch-b') },
};
// Images a control carries, as constants.
export const ART = { thinking: { ROCK: 'rock.webp' } };
export const NAMES = Object.keys(SOUNDS);
const TYPE = { mp3: 'audio/mpeg', wav: 'audio/wav', webp: 'image/webp', png: 'image/png' };
const uri = (file) => `data:${TYPE[file.split('.').pop()]};base64,` + readFileSync(join(root, file)).toString('base64');
const check = process.argv.includes('--check');

export const core = readFileSync(join(root, 'core.js'), 'utf8').trim();
const between = (text, name, body, file) => {
  const re = new RegExp(`(// >>> ${name}[^\\n]*\\n)[\\s\\S]*?(// <<< ${name})`);
  if (!re.test(text)) throw new Error(`${file}: no ${name} markers`);
  return text.replace(re, (_, a, b) => a + body + '\n' + b);
};
let stale = 0;
const put = (file, next) => {
  let was = ''; try { was = readFileSync(file, 'utf8'); } catch {}
  if (next !== was) { stale++; if (!check) writeFileSync(file, next); console.log(`${check ? 'stale' : 'wrote'} ${file.slice(root.length + 1)} (${Math.round(next.length / 1024)} KB)`); }
};
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const n of NAMES) {
    const file = join(root, n, n + '.js');
    let text = readFileSync(file, 'utf8');
    text = between(text, 'zen sand core', core, file);
    text = between(text, 'sounds', 'window.ZenSand.Sound.add({\n' + Object.entries(SOUNDS[n]).map(([k, f]) => `  '${k}': '${uri('sounds/' + f)}',`).join('\n') + '\n});', file);
    if (ART[n]) text = between(text, 'art', Object.entries(ART[n]).map(([k, f]) => `const ${k} = '${uri('art/' + f)}';`).join('\n'), file);
    put(file, text);
  }
  put(join(root, 'skills/zen-sand-ui/core.js'), core + '\n');
  if (check && stale) process.exit(1);
}
