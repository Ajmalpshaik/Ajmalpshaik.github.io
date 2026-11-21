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
// Root-relative paths (/assets/site.css), fetch, and response codes all behave the
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
  'about/index.html', 'tools/index.html',
  'heron/index.html', 'heron-ai/index.html', 'heron-tools/index.html', 'heron-autocad/index.html',
  'toolbox/crane-lift-calculator/index.html', 'toolbox/ar-viewer/index.html', 'toolbox/bim-viewer/index.html',
];

// The tool pages load three.js 0.186.1 and the home page 0.128.0, all from
// jsDelivr. When node_modules has the same release, serve it from there instead,
// so the checks run without a network:
//   npm i --no-save three@0.186.1 three-r128@npm:three@0.128.0
// Any folder in node_modules whose package.json says "name": "three" counts.
// The SHA-384 fingerprints still apply, so a local copy that differs from the
// release fails just the same.
async function localThree(ctx) {
  const nm = join(ROOT, 'node_modules');
  if (!existsSync(nm)) return;
  const { readdir } = await import('fs/promises');
  for (const dir of await readdir(nm)) {
    const pkg = join(nm, dir, 'package.json');
    if (!dir.startsWith('three') || !existsSync(pkg)) continue;
    const meta = JSON.parse(await readFile(pkg, 'utf8'));
    if (meta.name !== 'three') continue;
    const version = meta.version, base = join(nm, dir);
    await ctx.route(new RegExp(`^https://cdn\\.jsdelivr\\.net/npm/three@${version.replace(/\./g, '\\.')}/`), async (route) => {
      const rel = route.request().url().split(`three@${version}/`)[1];
      try {
        const body = await readFile(join(base, normalize(rel)));
        await route.fulfill({ status: 200, body, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } });
      } catch { await route.continue(); }
    });
  }
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
// The home page's welcome plays once per visit (assets/intro.js). Every check
// below starts as a returning visitor, so the welcome does not cover the page it
// is testing; the welcome has its own check further down ({ intro: true }).
const newContext = browser.newContext.bind(browser);
browser.newContext = async (opts = {}) => {
  const { intro, ...rest } = opts;
  const ctx = await newContext(rest);
  if (!intro) await ctx.addInitScript(() => { try { sessionStorage.setItem('aj-intro', '1'); } catch { /* ignore */ } });
  return ctx;
};

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

  // assets/site.js marks <html data-ready> when it has run; a script that failed
  // to load or threw on the way would leave that unset.
  if (!(await p.evaluate(() => document.documentElement.hasAttribute('data-ready')))) {
    fail('index.html: the site script never ran (no data-ready on <html>)');
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

// ---- the bar ------------------------------------------------------------------
// Written once by tools/sync_chrome.py into every page: three tabs, a Contact
// button, and a full-screen sheet on phones. Checked on a page with no current
// tab, on About me, and on a Heron page (whose highlight is Heron orange).
{
  const EXPECTED = ['/about/', '/tools/', '/heron/'];
  for (const [page, current] of [['index.html', null], ['about/index.html', 'about'], ['heron-ai/index.html', 'heron']]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url(page));
    await p.waitForTimeout(700);
    const bar = await p.evaluate(() => ({
      hrefs: [...document.querySelectorAll('#tabs a[data-tab]')].map((a) => a.getAttribute('href')),
      cur: [...document.querySelectorAll('#tabs a[aria-current="page"]')].map((a) => a.dataset.tab),
      contact: !!document.querySelector('#nav .pill[href="#contact"]') && !!document.getElementById('contact'),
      mark: !!document.querySelector('#nav .mark[href="/"]'),
    }));
    if (JSON.stringify(bar.hrefs) !== JSON.stringify(EXPECTED)) fail(`${page}: the bar's tabs are ${bar.hrefs.join(', ')}, expected ${EXPECTED.join(', ')}`);
    if (JSON.stringify(bar.cur) !== JSON.stringify(current ? [current] : [])) fail(`${page}: the current tab is [${bar.cur}], expected [${current || ''}]`);
    if (!bar.contact) fail(`${page}: the Contact button or the #contact footer is missing`);
    if (!bar.mark) fail(`${page}: the name in the bar does not link home`);

    // the highlight glides to the tab under the pointer; Heron's turns orange.
    // Waited for, not slept on: on the home page the forest is drawn in software
    // here, which slows every frame, so the fade can take longer than on a phone.
    await p.hover('#tabs a[data-tab="heron"]');
    const glided = await p.waitForFunction(() => {
      const i = document.querySelector('#tabs .tab-ind');
      return getComputedStyle(i).opacity === '1' && i.getBoundingClientRect().width >= 20 && i.classList.contains('heron');
    }, null, { timeout: 6000 }).then(() => true, () => false);
    if (!glided) fail(`${page}: hovering Heron does not move the orange highlight onto it`);

    // Contact grows into a card in place (no jump to the footer); Escape closes it
    await p.click('#nav [data-contact]');
    const opened = await p.waitForFunction(() => {
      const c = document.getElementById('cbox');
      const m = c && c.querySelector('.cbox-mail a');
      return c && !c.hidden && m && m.getBoundingClientRect().width > 50 && c.getAnimations({ subtree: true }).length === 0;
    }, null, { timeout: 6000 }).then(() => true, () => false);
    if (!opened) fail(`${page}: the Contact button does not open the contact card`);
    else {
      if (await p.evaluate(() => window.scrollY) > 40) fail(`${page}: opening the contact card scrolled the page`);
      await p.keyboard.press('Escape');
      const closed = await p.waitForFunction(() => document.getElementById('cbox').hidden, null, { timeout: 4000 }).then(() => true, () => false);
      if (!closed) fail(`${page}: Escape does not close the contact card`);
    }
    await ctx.close();

    // phone: the tabs fold into a sheet behind the menu button
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const q = await ph.newPage();
    await q.goto(url(page));
    await q.waitForTimeout(600);
    const tabsShown = await q.$eval('#nav .nav-tabs', (n) => getComputedStyle(n).display !== 'none');
    if (tabsShown) fail(`${page} at 390px: the tabs should be in the menu, not the bar`);
    await q.click('#burger');
    await q.waitForTimeout(900);
    const sheet = await q.evaluate(() => {
      const o = document.getElementById('overlay');
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      return { open: o.hasAttribute('data-open'), links: [...o.querySelectorAll('a')].filter(vis).map((a) => a.getAttribute('href')), exp: document.getElementById('burger').getAttribute('aria-expanded') };
    });
    if (!sheet.open || sheet.exp !== 'true') fail(`${page} at 390px: the menu button does not open the sheet`);
    for (const h of [...EXPECTED, '#contact']) if (!sheet.links.includes(h)) fail(`${page} at 390px: the open menu does not show ${h}`);
    await q.keyboard.press('Escape');
    await q.waitForTimeout(800);
    if (await q.$eval('#overlay', (o) => o.hasAttribute('data-open'))) fail(`${page} at 390px: Escape does not close the menu`);
    // and from the phone menu, its Contact button grows into the same card
    await q.click('#burger');
    await q.waitForTimeout(900);
    await q.click('#overlay [data-contact]');
    const phoneCard = await q.waitForFunction(() => !document.getElementById('cbox').hidden && !document.getElementById('overlay').hasAttribute('data-open'), null, { timeout: 5000 }).then(() => true, () => false);
    if (!phoneCard) fail(`${page} at 390px: the menu's Contact button does not open the contact card`);
    await ph.close();

    // no JavaScript on a phone: the tabs stay in the bar, so every page is still reachable
    const nj = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const r = await nj.newPage();
    await r.goto(url(page));
    await r.waitForTimeout(300);
    const njTabs = await r.$$eval('#tabs a[data-tab]', (as) => as.filter((a) => a.getBoundingClientRect().width > 0).length);
    if (njTabs !== 3) fail(`${page}: with no JavaScript at 390px only ${njTabs} of 3 tabs are visible`);
    await nj.close();
  }
}

// ---- the home page without its 3D script --------------------------------------
// assets/home.js adds the forest and pins the story to the scroll. Blocked (or
// three.js unreachable), the hero and the story must still read as plain HTML.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route(/\/assets\/home\.js$/, (route) => route.abort());
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\//, (route) => route.abort());
  await p.goto(url('index.html'));
  await p.waitForTimeout(2400);
  const st = await p.evaluate(() => {
    const s = document.querySelector('.story-plain');
    const r = s.getBoundingClientRect();
    return { story: r.width > 100 && r.height > 20, heading: getComputedStyle(document.querySelector('.hero-heading .ln > span')).transform };
  });
  if (!st.story) fail('index.html with assets/home.js blocked: the story is not on screen');
  if (st.heading !== 'none' && !st.heading.startsWith('matrix(1, 0, 0, 1, 0, 0')) fail('index.html with assets/home.js blocked: the headline never finished arriving');
  await ctx.close();
}

// ---- the welcome: plays on a first visit, can be skipped, then never again --------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, intro: true });
  await localThree(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`welcome: uncaught script error — ${e.message}`));
  await p.goto(url('index.html'));
  const shown = await p.waitForFunction(() => document.documentElement.classList.contains('intro-run'), null, { timeout: 6000 }).then(() => true, () => false);
  if (!shown) fail('welcome: a first visit to the home page does not play it');
  else {
    await p.click('#introSkip');
    const gone = await p.waitForFunction(() => !document.getElementById('welcome') && document.body.style.overflow === '', null, { timeout: 6000 }).then(() => true, () => false);
    if (!gone) fail('welcome: Skip does not end it and give the page back');
    await p.reload();
    await p.waitForTimeout(800);
    if (await p.evaluate(() => document.documentElement.classList.contains('intro-on'))) fail('welcome: it plays again in the same visit');
  }
  await ctx.close();
  // with reduced motion it never starts
  const rm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', intro: true });
  const q = await rm.newPage();
  await q.goto(url('index.html'));
  await q.waitForTimeout(600);
  if (await q.evaluate(() => document.documentElement.classList.contains('intro-on'))) fail('welcome: it plays even with reduced motion');
  await rm.close();
}

// ---- reduced motion: nothing may stay hidden or half-arrived ---------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.waitForTimeout(900);
  const moved = await p.$$eval('.hero-heading .ln > span, .hero-sub',
    (els) => els.filter((e) => getComputedStyle(e).opacity !== '1' || (getComputedStyle(e).transform !== 'none' && getComputedStyle(e).transform !== 'matrix(1, 0, 0, 1, 0, 0)')).length);
  if (moved) fail(`reduced motion: ${moved} element(s) on the home page are still mid-entrance`);
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
// useful floor - contact and 404 are short on purpose, automation runs long - so
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
    const hidden = await p.$$eval('main *',
      (els) => els.filter((e) => e.textContent.trim() && getComputedStyle(e).opacity === '0' && !e.closest('[aria-hidden="true"]')).length);
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
  const invisible = await p.$$eval('.nums b, .card .idx, .hero-heading',
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
