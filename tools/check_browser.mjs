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
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => 'file://' + join(ROOT, p);
const PAGES = ['index.html', '404.html'];
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
    if (r.url().startsWith('file://')) fail(`${page}: failed to load ${r.url().split('/').pop()}`);
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
    imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.alt).length,
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

  // counters must land on their target, not sit at 0
  await p.evaluate(() => document.querySelector('.stats-band').scrollIntoView());
  await p.waitForTimeout(2200);
  const stuck = await p.$$eval('.stats-band [data-count]', (els) =>
    els.filter((e) => e.textContent.replace(/\D/g, '') !== e.getAttribute('data-count')).length);
  if (stuck) fail(`${stuck} counter(s) did not reach their value`);

  await ctx.close();
}

// ---- reduced motion: nothing may stay hidden -------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.waitForTimeout(900);
  const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li',
    (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  if (hidden) fail(`reduced motion: ${hidden} element(s) stay invisible`);
  await ctx.close();
}

// ---- no JavaScript: the page must still read ------------------------------
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.waitForTimeout(400);
  const hidden = await p.$$eval('.reveal, .rvt .ln > i, .ladder li',
    (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  if (hidden) fail(`no JavaScript: ${hidden} element(s) stay invisible`);
  const chars = await p.$eval('main', (m) => m.innerText.trim().length);
  if (chars < 3000) fail(`no JavaScript: only ${chars} characters of readable text`);
  await ctx.close();
}

// ---- print: nothing may render as invisible ink ---------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1160 } });
  const p = await ctx.newPage();
  await p.goto(url('index.html'));
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(600);
  const invisible = await p.$$eval('.grad-text, .ch-idx, .stat-b b, .brain-stat b',
    (els) => els.filter((e) => {
      const f = getComputedStyle(e).webkitTextFillColor;
      return f === 'rgba(0, 0, 0, 0)' || f === 'transparent';
    }).length);
  if (invisible) fail(`print: ${invisible} element(s) would print blank (transparent text fill)`);
  await ctx.close();
}

await browser.close();

if (failures.length) {
  console.log(failures.map((f) => `ERROR:   ${f}`).join('\n'));
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('browser checks passed');
