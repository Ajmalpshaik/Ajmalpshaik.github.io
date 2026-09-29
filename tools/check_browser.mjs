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
  'toolbox/ar-viewer/index.html',
];
const WIDTHS = [1440, 1280, 834, 390];

const failures = [];
const fail = (m) => failures.push(m);
const browser = await chromium.launch();

for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

  // ribbon tabs, if present, must actually switch
  if (await p.$('.rtabs [role=tab]')) {
    await p.click('#tabAnno');
    await p.waitForTimeout(300);
    const ok = await p.evaluate(() => document.getElementById('panTools').hidden && !document.getElementById('panAnno').hidden);
    if (!ok) fail('ribbon tab click does not switch panels');
  }

  // counters, if present, must land on their target, not sit at 0
  if (await p.$('.stats-band')) {
    await p.evaluate(() => document.querySelector('.stats-band').scrollIntoView());
    await p.waitForTimeout(2200);
    const stuck = await p.$$eval('.stats-band [data-count]', (els) =>
      els.filter((e) => e.textContent.replace(/\D/g, '') !== e.getAttribute('data-count')).length);
    if (stuck) fail(`${stuck} counter(s) did not reach their value`);
  }

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
  const hidden = await p.$$eval('.fade-in', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
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
    const stuck = await p.$$eval('.fade-in', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
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
  const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li, .fade-in',
    (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  if (hidden) fail(`reduced motion: ${hidden} element(s) stay invisible`);
  await ctx.close();
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
    const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li, .fade-in',
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
  const invisible = await p.$$eval('.grad-text, .ch-idx, .stat-b b, .brain-stat b, .hero-heading',
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
