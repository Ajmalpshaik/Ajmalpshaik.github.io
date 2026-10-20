/**
 * Writes the import map in toolbox/bim-viewer/index.html.
 *
 * The viewer loads three.js from jsDelivr, pinned to one release, with a
 * SHA-384 fingerprint for every file it can reach - not only the ones its own
 * code imports, but everything those import in turn - so a browser that checks
 * them refuses any copy that differs from the npm release. Working that list
 * out by hand is how a file gets missed; this follows the imports instead.
 *
 * Run:   npm i --no-save three@0.186.1 && node tools/pin_three.mjs
 * Needs: the same three.js version installed in node_modules as VERSION below.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join, normalize, relative } from 'path';
import { fileURLToPath } from 'url';

const VERSION = '0.186.1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'toolbox', 'bim-viewer');
const PAGE = join(APP, 'index.html');
const THREE = join(ROOT, 'node_modules', 'three');
const CDN = `https://cdn.jsdelivr.net/npm/three@${VERSION}/`;

const installed = JSON.parse(readFileSync(join(THREE, 'package.json'), 'utf8')).version;
if (installed !== VERSION) {
  console.error(`node_modules has three ${installed}, the page pins ${VERSION}. Run: npm i --no-save three@${VERSION}`);
  process.exit(1);
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
const specifiers = (src) => [...src.matchAll(IMPORT)].map((m) => m[1] || m[2]);

// bare specifiers as the page's map spells them -> files in the package
const resolveBare = (s) => s === 'three' ? 'build/three.module.js'
  : s.startsWith('three/addons/') ? 'examples/jsm/' + s.slice('three/addons/'.length) : null;

const seen = new Set();
const queue = [];
for (const f of readdirSync(APP).filter((f) => f.endsWith('.js') && f !== 'ifc-worker.js')) {
  for (const s of specifiers(readFileSync(join(APP, f), 'utf8'))) {
    const r = resolveBare(s);
    if (r) queue.push(r);
  }
}
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  for (const s of specifiers(readFileSync(join(THREE, file), 'utf8'))) {
    const r = s.startsWith('.') ? relative(THREE, normalize(join(THREE, dirname(file), s))) : resolveBare(s);
    if (r) queue.push(r.split('\\').join('/'));
  }
}

const files = [...seen].sort((a, b) => (a.startsWith('build') ? -1 : 0) - (b.startsWith('build') ? -1 : 0) || a.localeCompare(b));
const integrity = Object.fromEntries(files.map((f) =>
  [CDN + f, 'sha384-' + createHash('sha384').update(readFileSync(join(THREE, f))).digest('base64')]));
const map = {
  imports: { three: CDN + 'build/three.module.js', 'three/addons/': CDN + 'examples/jsm/' },
  integrity,
};

const block = `<!-- IMPORTMAP:START (written by tools/pin_three.mjs - do not edit by hand) -->
<!-- three.js ${VERSION}, pinned. Each file carries its SHA-384 fingerprint, so a
     browser that checks them refuses any copy that differs from the npm release.
     To upgrade: change VERSION in tools/pin_three.mjs and run it again. -->
<script type="importmap">
${JSON.stringify(map, null, 2)}
</script>
<!-- IMPORTMAP:END -->`;

const page = readFileSync(PAGE, 'utf8');
const next = page.replace(/<!-- IMPORTMAP:START[\s\S]*?<!-- IMPORTMAP:END -->/, block);
if (next === page) console.log('import map already current');
else { writeFileSync(PAGE, next); console.log(`pinned ${files.length} files of three ${VERSION}`); }
