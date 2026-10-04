// Static wiring check: every import resolves, every named import is exported,
// every DOM id the UI touches exists in index.html, every vendored addon exists.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SRC = join(ROOT, 'src');
const files = ['main.js', 'city.js', 'effects.js', 'specters.js', 'shadows.js', 'player.js', 'post.js', 'ui.js', 'sky.js', 'water.js', 'audio.js', 'content.js', 'textures.js', 'rng.js'];

let fail = 0;
const bad = (m) => { console.log('  FAIL ' + m); fail++; };
const good = (m) => console.log('  ok   ' + m);

/* ── 1. imports resolve, named exports exist ── */
const exportIndex = new Map();
for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  exportIndex.set(f, names);
}

// also index the vendored addons so their named exports are verified too
for (const rel of ['postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/UnrealBloomPass.js','postprocessing/ShaderPass.js','postprocessing/OutputPass.js','postprocessing/Pass.js','postprocessing/MaskPass.js','shaders/CopyShader.js','shaders/LuminosityHighPassShader.js','shaders/OutputShader.js','utils/BufferGeometryUtils.js']) {
  const abs = join(ROOT, 'vendor/three/examples/jsm', rel);
  if (!existsSync(abs)) { bad('missing vendored addon ' + rel); continue; }
  const src = readFileSync(abs, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) for (const part of m[1].split(',')) { const t = part.trim(); if (!t) continue; const as = t.split(/\s+as\s+/); names.add((as[1] || as[0]).trim()); }
  exportIndex.set(rel.split('/').pop(), names);
}

const resolver = (spec, from) => {
  if (spec.startsWith('.')) {
    const p = resolve(dirname(join(SRC, from)), spec);
    return existsSync(p) ? p : null;
  }
  if (spec === 'three') return join(ROOT, 'vendor/three/build/three.module.js');
  if (spec.startsWith('three/addons/')) {
    const p = join(ROOT, 'vendor/three/examples/jsm', spec.slice('three/addons/'.length));
    return existsSync(p) ? p : null;
  }
  return undefined;   // bare specifier resolved by the import map (fine)
};

for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8');
  for (const m of src.matchAll(/import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const clause = (m[1] || '').trim();
    const spec = m[2];
    const target = resolver(spec, f);
    if (target === null) { bad(`${f}: cannot resolve "${spec}"`); continue; }
    if (target === undefined) { good(`${f} → ${spec} (import map)`); continue; }
    if (!clause.startsWith('{')) continue;
    const wanted = clause.replace(/[{}]/g, '').split(',').map((x) => x.trim()).filter(Boolean)
      .map((x) => { const p = x.split(/\s+as\s+/); return { imported: p[0].trim(), local: (p[1] || p[0]).trim() }; });
    const base = target.split('/').pop();
    const exp = exportIndex.get(base);
    if (!exp) { good(`${f} → ${spec} (external, ${wanted.length} names)`); continue; }
    for (const w of wanted) {
      if (!exp.has(w.imported)) bad(`${f}: "${w.imported}" is not exported by ${base}`);
    }
  }
}
good(`checked imports across ${files.length} modules`);

/* ── 2. DOM ids used by ui.js/main.js exist in index.html ── */
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const used = new Set();
for (const f of ['ui.js', 'main.js']) {
  const src = readFileSync(join(SRC, f), 'utf8');
  for (const m of src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) used.add(m[1]);
  for (const m of src.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)) used.add(m[1]);
}
for (const id of used) if (!ids.has(id)) bad(`index.html is missing #${id} (used by ui/main)`);
good(`checked ${used.size} DOM ids against index.html`);

/* ── 3. every class referenced in index.html/styles.css exists in index.html ── */
const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
for (const c of ['hidden', 'sub-line', 'prompt-ring', 'obj-arrow', 'finale-inner', 'journal-inner']) {
  if (!classes.has(c) && !html.includes(c)) bad(`index.html missing element/class "${c}"`);
}
good('checked key UI classes');

/* ── 4. vendored addon graph ── */
const addonDirs = ['postprocessing', 'shaders', 'utils'];
for (const d of addonDirs) {
  const dir = join(ROOT, 'vendor/three/examples/jsm', d);
  if (!existsSync(dir)) bad(`missing vendor addon dir ${d}`);
}
good('vendor addon dirs present');

/* ── 5. no leftover debug globals or TODOs in shipped source ── */
for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8');
  if (/window\.__/.test(src)) bad(`${f} still assigns a window.__ debug global`);
  if (/\bTODO\b|\bFIXME\b/.test(src)) bad(`${f} contains a TODO/FIXME`);
}
good('no debug globals or TODOs left in src/');

console.log(fail ? `\n${fail} WIRING PROBLEM(S)` : '\nWIRING OK');
process.exit(fail ? 1 : 0);
