/**
 * Browser checks for ajmalps.com.
 *
 * The static checker cannot see layout or script failures. This loads the real
 * pages in Chromium and fails on the things that only show up once rendered:
 * a script error, a section that scrolls sideways on a phone, content that
 * stays invisible when JavaScript is off.
 *
 * Run:  node tools/check_browser.mjs
 * Exit: 0 all good, 1 something is wrong.
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, extname, join, normalize } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- serve the site over HTTP, the way it is actually served ---------------
//
// These pages used to be opened as file:// URLs. That looks equivalent and is
// not: Chromium refuses fetch() over file://, so any page reading something at
// runtime threw "URL scheme file is not supported" and failed the run - and the
// checks stayed red for as long as such a page was on the site.
//
// Serving over HTTP is not a workaround for that, it is the more faithful test.
// Root-relative paths (/favicon.svg), fetch, and response codes all behave the
// way they will on ajmalps.com, and none of them can be exercised over file://.
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
  // GitHub Pages sends wasm as application/wasm; anything else and the browser
  // refuses to stream-compile it and logs an error, which would fail the run
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';

  // normalize before joining, so a "../" in a request cannot walk out of ROOT
  const file = join(ROOT, normalize(path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>404</title>not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const url = (p) => `${ORIGIN}/${p}`;
const PAGES = [
  'index.html', '404.html',
  'story/index.html', 'experience/index.html', 'work/index.html',
  'aj-tools/index.html', 'heron-ai/index.html',
  'about/index.html',
  'skills/index.html', 'faq/index.html', 'contact/index.html',
  // Added 2026-09-20. These two shipped on 2026-08-12 and were never in this
  // list, so for five weeks the only thing checking them was check_site.py,
  // which reads the file and never renders it - a page that threw on load or
  // scrolled sideways would have looked exactly like a passing one.
  'toolbox/index.html', 'toolbox/crane-lift-calculator/index.html',
  'toolbox/ar-viewer/index.html', 'toolbox/bim-viewer/index.html',
];

// The viewers load three.js from jsDelivr. When node_modules has the same
// release (npm i --no-save three@0.186.1), serve it from there instead, so the
// checks run without a network. The import map's SHA-384 fingerprints still
// apply, so a local copy that differs from the release fails just the same.
const LOCAL_THREE = join(ROOT, 'node_modules', 'three');
async function localThree(ctx) {
  if (!existsSync(join(LOCAL_THREE, 'package.json'))) return;
  const version = JSON.parse(await readFile(join(LOCAL_THREE, 'package.json'), 'utf8')).version;
  await ctx.route(new RegExp(`^https://cdn\\.jsdelivr\\.net/npm/three@${version.replace(/\./g, '\\.')}/`), async (route) => {
    const rel = route.request().url().split(`three@${version}/`)[1];
    try {
      const body = await readFile(join(LOCAL_THREE, normalize(rel)));
      await route.fulfill({ status: 200, body, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } });
    } catch { await route.continue(); }
  });
}
const WIDTHS = [1440, 1280, 834, 390];

const failures = [];
const fail = (m) => failures.push(m);
// CHROMIUM_PATH lets a machine that already has a Chromium point at it
// instead of downloading a second copy. CI leaves it unset and uses the
// browser `npx playwright install` put in place.
const launch = (opts = {}) => chromium.launch(
  process.env.CHROMIUM_PATH ? { ...opts, executablePath: process.env.CHROMIUM_PATH } : opts,
);
const browser = await launch();

for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await localThree(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`${page}: uncaught script error — ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') fail(`${page}: console error — ${m.text()}`); });
  p.on('requestfailed', (r) => {
    if (r.url().startsWith(ORIGIN)) fail(`${page}: failed to load ${r.url().split('/').pop()}`);
  });
  // Over file:// a missing file was a failed request. Over HTTP it is a perfectly
  // successful response that happens to say 404, so without this the checks would
  // quietly stop noticing a broken local link - the one thing this handler exists
  // for. Only our own origin is judged; a blocked font on someone's CDN is not
  // this repository's problem.
  p.on('response', (r) => {
    if (r.url().startsWith(ORIGIN) && r.status() >= 400) {
      fail(`${page}: ${r.status()} loading ${r.url().slice(ORIGIN.length)}`);
    }
  });

  await p.goto(url(page));
  await p.waitForTimeout(1200);

  // no page should scroll sideways at any width
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(250);
    const o = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
    if (o.s > o.i + 1) fail(`${page}: scrolls sideways at ${w}px (${o.s} > ${o.i})`);
  }
  await ctx.close();
}

// ---- index.html only: interaction and degradation --------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.waitForTimeout(1200);

  const shell = await p.evaluate(() => ({
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    // alt="" is a deliberate answer - the image is decoration - so only a
    // missing attribute counts. The home page's marquee and corner objects say
    // alt="" on purpose.
    imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
  }));
  if (shell.main !== 1) fail(`expected 1 <main>, found ${shell.main}`);
  if (shell.h1 !== 1) fail(`expected 1 <h1>, found ${shell.h1}`);
  if (shell.imgNoAlt) fail(`${shell.imgNoAlt} image(s) without alt text`);

  // skip link must be the first thing a keyboard reaches, and must become visible
  await p.keyboard.press('Tab');
  await p.waitForTimeout(500);
  const skip = await p.evaluate(() => {
    const a = document.activeElement;
    return { cls: a.className, top: Math.round(a.getBoundingClientRect().top) };
  });
  if (!skip.cls.includes('skip')) fail(`first tab stop is ".${skip.cls}", expected the skip link`);
  else if (skip.top < 0) fail('skip link stays off-screen when focused');

  // The home page is built from landing/ and arrives as finished HTML that
  // React then attaches to. It marks <html data-ready> when it has; a bundle
  // that failed to load or threw on the way would leave that unset.
  if (!(await p.evaluate(() => document.documentElement.hasAttribute('data-ready')))) {
    fail('index.html: the page script never attached (no data-ready on <html>)');
  }

  // The hero name is one line that must not be cut. It sits in an
  // overflow-hidden box, so if it ever outgrew the screen it would be clipped
  // silently rather than scroll - which the sideways check above cannot see.
  for (const w of [1920, 1440, 1024, 834, 640, 390, 320]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(150);
    const cut = await p.evaluate(() => {
      const h = document.querySelector('h1.hero-heading');
      return h ? h.scrollWidth - h.clientWidth : 0;
    });
    if (cut > 1) fail(`index.html: the hero name is cut off by ${cut}px at ${w}px wide`);
  }

  await ctx.close();
}

// ---- the bar, on both halves of the site -----------------------------------
// The bar is written twice - tools/sync_chrome.py for the content pages,
// landing/src/components/SiteNav.tsx for the cover - over one stylesheet. It is
// the one thing on the site with two implementations, so it is the one thing
// most likely to drift. These run against both.
{
  const EXPECTED = [
    '/story/', '/experience/', '/work/',
    '/aj-tools/', '/heron-ai/', '/toolbox/',
    '/skills/', '/about/', '/faq/',
  ];

  for (const page of ['index.html', 'about/index.html']) {
    const where = page === 'index.html' ? 'the cover' : 'a content page';

    // ---- desktop: each menu opens, and Escape closes it ----
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(url(page));
      await p.waitForTimeout(900);

      const triggers = await p.$$('#nav .navtrig');
      if (triggers.length !== 3) fail(`${where}: ${triggers.length} menu(s) in the bar, expected 3`);

      // The menu fades, so wait for the state rather than for a stopwatch -
      // a fixed sleep here is how a check starts failing on a slow runner and
      // passing on a fast one.
      const settle = (id, want) => p.waitForFunction(
        ([sel, open]) => {
          const s = getComputedStyle(document.getElementById(sel));
          const shown = s.visibility !== 'hidden' && s.opacity !== '0';
          return shown === open;
        },
        [id, want],
        { timeout: 3000 },
      ).then(() => true, () => false);

      for (const trigger of triggers) {
        const name = (await trigger.textContent()).trim();
        const id = await trigger.getAttribute('aria-controls');
        if (!(await p.$(`#${id}`))) { fail(`${where}: the "${name}" menu has no panel (#${id})`); continue; }

        await trigger.click();
        if (!(await settle(id, true))) fail(`${where}: clicking "${name}" does not open its menu`);
        const links = await p.$$eval(`#${id} a`, (as) => as.length);
        if (links !== 3) fail(`${where}: the "${name}" menu holds ${links} links, expected 3`);

        await p.keyboard.press('Escape');
        if (!(await settle(id, false))) fail(`${where}: Escape does not close the "${name}" menu`);
      }

      // every page the bar promises must be in it, and must be a real page
      const hrefs = await p.$$eval('#nav .navmenu a', (as) => as.map((a) => new URL(a.href).pathname));
      for (const want of EXPECTED) {
        if (!hrefs.includes(want)) fail(`${where}: the bar has no link to ${want}`);
      }
      if (!(await p.$('#nav .navcta'))) fail(`${where}: the bar has no Contact button`);
      if (!(await p.$('#nav .brand'))) fail(`${where}: the bar has no brand mark`);
      await ctx.close();
    }

    // ---- phone: one sheet, every page one tap away ----
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await ctx.newPage();
      await p.goto(url(page));
      await p.waitForTimeout(900);

      // A closed sheet is laid out, just hidden, so a bounding box is not the
      // question - checkVisibility is, with visibility and opacity counted.
      const seen = (a) => a.checkVisibility({ visibilityProperty: true, opacityProperty: true });
      const before = await p.$$eval('#navLinks a', (as, fn) =>
        as.filter(new Function('a', `return (${fn})(a)`)).length, seen.toString());
      if (before) fail(`${where}: ${before} bar link(s) are on screen before the menu is opened at 390px`);

      await p.click('#menuBtn');
      await p.waitForFunction(
        () => document.getElementById('navLinks').classList.contains('open'),
        null, { timeout: 3000 },
      ).catch(() => fail(`${where}: the menu button does not open the sheet at 390px`));
      await p.waitForTimeout(450);
      const after = await p.$$eval('#navLinks a', (as, fn) =>
        as.filter(new Function('a', `return (${fn})(a)`)).map((a) => new URL(a.href).pathname), seen.toString());
      for (const want of [...EXPECTED, '/contact/']) {
        if (!after.includes(want)) fail(`${where}: ${want} is not reachable from the phone menu`);
      }
      await ctx.close();
    }
  }

  // ---- no JavaScript: the menus are simply open, nothing is hidden ----
  for (const page of ['index.html', 'about/index.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto(url(page));
    const hidden = await p.$$eval('#nav .navmenu a', (as) =>
      as.filter((a) => !a.checkVisibility({ visibilityProperty: true, opacityProperty: true })).length);
    if (hidden) fail(`${page}: ${hidden} bar link(s) stay hidden with JavaScript off`);
    await ctx.close();
  }
}

// ---- script never arrives: the failsafe must show the page ------------------
// Every section on the home page fades in when its script runs. If the script
// is blocked or the network drops it, an inline timer in index.html shows
// everything after 4s instead of leaving a dark, empty page.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route(/\/assets\/home\/.*\.js$/, (route) => route.abort());
  await p.goto(url('index.html'));
  await p.waitForTimeout(4600);
  const hidden = await p.$$eval('.fade-in, .enter', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  if (hidden) fail(`script blocked: ${hidden} element(s) on index.html stay invisible`);
  await ctx.close();
}

// ---- every entrance on the home page actually plays -------------------------
// Each .fade-in waits to be scrolled into view. One that can never count as in
// view - clipped by its own box, say, which is what the hero name did on a
// 320px phone - would stay invisible for good, with nothing in the console.
// Scroll the whole page at a few sizes and require every one to have arrived.
{
  for (const [w, h] of [[1440, 900], [390, 844], [320, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await p.goto(url('index.html'));
    await p.waitForTimeout(600);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= total; y += Math.round(h * 0.6)) {
      await p.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await p.waitForTimeout(120);
    }
    await p.waitForTimeout(1600);
    const stuck = await p.$$eval('.fade-in, .enter', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
    if (stuck) fail(`index.html at ${w}px: ${stuck} element(s) never faded in after scrolling the whole page`);
    await ctx.close();
  }
}

// ---- reduced motion: nothing may stay hidden -------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.waitForTimeout(900);
  const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li, .fade-in, .enter',
    (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  if (hidden) fail(`reduced motion: ${hidden} element(s) stay invisible`);
  await ctx.close();
}

// ---- the BIM viewer: opens its model, picks, walks, all without an error ---
// Drawn by SwiftShader like the home page's models. The quality is set to Low
// first: a software renderer cannot keep up with the High preset, and what is
// under test here is that everything works, not how it looks.
{
  const gpu = await launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [w, h] of [[1280, 860], [390, 844]]) {
    const phone = w < 500;
    const ctx = await gpu.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    await localThree(ctx);
    await ctx.addInitScript(() => { try { localStorage.setItem('ajps-bimv', '{"quality":"low","picked":true}'); } catch { /* ignore */ } });
    const p = await ctx.newPage();
    const tag = `bim-viewer at ${w}px`;
    p.on('pageerror', (e) => fail(`${tag}: uncaught script error — ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('THREE'))) fail(`${tag}: console ${m.type()} — ${m.text()}`);
    });
    await p.goto(url('toolbox/bim-viewer/index.html'));
    if (!(await p.evaluate(() => !!document.createElement('canvas').getContext('webgl2')))) {
      console.log('note: no WebGL 2 in this Chromium, even in software; the BIM viewer was not checked');
      await ctx.close();
      break;
    }
    const ready = await p.waitForFunction(() => document.getElementById('bv').dataset.state === 'ready', null, { timeout: 60000 })
      .then(() => true, () => false);
    if (!ready) { fail(`${tag}: the sample model never finished opening (${await p.$eval('#bvLoadText', (e) => e.textContent)})`); await ctx.close(); continue; }
    const elements = Number(await p.$eval('#bv', (e) => e.dataset.elements));
    if (!(elements > 20)) fail(`${tag}: the sample opened with ${elements} elements, expected the whole villa`);

    // clicking the building opens its properties
    // style.css scrolls smoothly, so ask for an instant jump or the canvas is
    // still on its way when its position is read
    await p.$eval('#bv', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForFunction(() => !document.getElementById('bv').viewer.bim.tween, null, { timeout: 15000 }).catch(() => {});
    const box = await p.$eval('#bvCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(box.x, box.y);
    const props = await p.waitForFunction(() => !document.getElementById('bvProps').hidden &&
      document.querySelectorAll('#bvPropBody dt').length > 3, null, { timeout: 15000 }).then(() => true, () => false);
    if (!props) fail(`${tag}: clicking the model did not show its properties`);

    // the walk view: the robot arrives and moves when told to
    await p.click('#bvTabWalk');
    const walking = await p.waitForFunction(() => {
      const s = document.getElementById('bv');
      return s.dataset.mode === 'walk' && s.dataset.robot === 'ready';
    }, null, { timeout: 30000 }).then(() => true, () => false);
    if (!walking) { fail(`${tag}: the walk view did not start`); await ctx.close(); continue; }
    if (await p.isVisible('#bvPlay')) await p.click('#bvPlay');
    // Software rendering draws about one frame a second and each frame moves
    // the robot a capped step, so wait for the distance, not for a time.
    const start = await p.evaluate(() => {
      const r = document.getElementById('bv').viewer.walk.robot.position;
      return window.__bvStart = [r.x, r.z];
    });
    const goneFar = () => p.waitForFunction(() => {
      const r = document.getElementById('bv').viewer.walk.robot.position, s = window.__bvStart;
      return Math.hypot(r.x - s[0], r.z - s[1]) > 0.3;
    }, null, { timeout: 20000 }).then(() => true, () => false);
    let moved;
    if (phone) {
      const stick = await p.$eval('#bvStick', (s) => { const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await p.mouse.move(stick.x, stick.y);
      await p.mouse.down();
      await p.mouse.move(stick.x, stick.y - 50, { steps: 4 });
      moved = await goneFar();
      await p.mouse.up();
    } else {
      await p.keyboard.down('KeyW');
      moved = await goneFar();
      await p.keyboard.up('KeyW');
    }
    if (!moved) {
      const end = await p.evaluate(() => { const r = document.getElementById('bv').viewer.walk.robot.position; return [r.x, r.z]; });
      fail(`${tag}: the robot moved ${Math.hypot(end[0] - start[0], end[1] - start[1]).toFixed(2)} m in 20 s of being told to walk`);
    }

    // teleport: hold T with the camera on open ground, let go, and land there
    if (!phone) {
      const before = await p.evaluate(() => {
        const w = document.getElementById('bv').viewer.walk;
        w.yaw = 0; w.pitch = -0.15;              // facing south, away from the villa, onto the lawn
        return [w.robot.position.x, w.robot.position.z];
      });
      await p.keyboard.down('KeyT');
      const aimed = await p.waitForFunction(() => {
        const w = document.getElementById('bv').viewer.walk;
        return w.aiming && w.aim.valid && w.aim.dist > 2;
      }, null, { timeout: 20000 }).then(() => true, () => false);
      await p.keyboard.up('KeyT');
      if (!aimed) fail(`${tag}: holding T never showed a place to teleport to`);
      else {
        const landed = await p.waitForFunction((b) => {
          const r = document.getElementById('bv').viewer.walk.robot.position;
          return Math.hypot(r.x - b[0], r.z - b[1]) > 1.5;
        }, before, { timeout: 10000 }).then(() => true, () => false);
        if (!landed) fail(`${tag}: letting go of T did not teleport`);
      }
    }

    // a player gives the pointer back with Esc; the check does it directly.
    // The pause card that comes up must leave the view tabs usable.
    await p.evaluate(() => document.pointerLockElement && document.exitPointerLock());
    await p.click('#bvTabBim', { timeout: 10000 }).catch(() => {});
    if (await p.$eval('#bv', (e) => e.dataset.mode) !== 'bim') fail(`${tag}: could not get back to the BIM view`);
    await ctx.close();
  }
  await gpu.close();
}

// ---- no JavaScript: every page must still read -----------------------------
// Checked per page now that the site is split up. A word count is no longer a
// useful floor - contact and 404 are short on purpose, aj-tools runs to 7k - so
// the floor only catches a page that renders empty. The assertion that carries
// the weight is that nothing stays invisible without JS.
{
  for (const page of PAGES) {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url(page));
    await p.waitForTimeout(400);
    // The home page's first screen fades in with CSS, which runs without
    // script; let any entrance that ends on its own finish before judging.
    await p.evaluate(() => Promise.all(document.getAnimations()
      .filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity)
      .map((a) => a.finished.catch(() => {}))));
    const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li, .fade-in, .enter',
      (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
    if (hidden) fail(`no JavaScript: ${page}: ${hidden} element(s) stay invisible`);
    // heron-ai used to sit at 20 here: it was one statement on purpose - a name,
    // a status and a single link - so the shared floor would have failed it for
    // being exactly what it was meant to be. It became a full page on 2026-09-20
    // and now clears 150 like everything else, so the exception is gone. A page
    // that bare again needs its own floor back rather than a lower shared one.
    const floor = 150;
    const chars = await p.$eval('main', (m) => m.innerText.trim().length);
    if (chars < floor) fail(`no JavaScript: ${page} renders only ${chars} characters`);
    await ctx.close();
  }
}

// ---- print: nothing may render as invisible ink ---------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1160 } });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(600);
  const invisible = await p.$$eval('.grad-text, .ch-idx, .hero-heading',
    (els) => els.filter((e) => {
      const f = getComputedStyle(e).webkitTextFillColor;
      return f === 'rgba(0, 0, 0, 0)' || f === 'transparent';
    }).length);
  if (invisible) fail(`print: ${invisible} element(s) would print blank (transparent text fill)`);
  await ctx.close();
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

if (failures.length) {
  console.log(failures.map((f) => `ERROR:   ${f}`).join('\n'));
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('browser checks passed');
