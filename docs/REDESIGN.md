# ajmalps.com — the design

What the site is for, the one system it is built from, and the order the pages
are meant to be read in. Read this before changing any page: the rules here are
what keep fifteen hand-written HTML files and one React page looking like one
site.

## 1. The problem this solves

The site was two sites wearing one domain, and it took two passes to fix.

**First pass** — the home page was a dark cinematic cover built from
`landing/`: Kanit 900, `#0C0C0C`, four anchor links and no brand mark. Every
other page was a light Apple-style layout in the system face with nine flat
tabs in a capsule. Leaving the cover for `/contact/` landed you somewhere that
did not look like the same site. That pass unified the type, the navigation and
the tokens, and gave every page the same bar.

**Second pass** — it was still two sites, because the inner pages still kept a
light theme and still read as documents: cards, panels, shadows, boxes. And the
cover was carrying twenty-two generated illustrations, which made the one page
people see first look like a template rather than like somebody's actual work.

So: **one skin, one layout language, and no decoration that is not the work.**

## 2. The decision

**Dark, everywhere. Big type. Numbered rows. Nothing else.**

- **There is no light theme and no theme switch.** Two skins is what made the
  site read as two sites. The one skin is the cover's.
- **Every page is laid out the same way**: a page header that is mostly a huge
  headline, then sections that are a kicker, a headline and a list of numbered
  rows separated by hairlines. That layout is the cover's Services section,
  which was already the simplest and loudest thing on the old site.
- **Manrope** (the Heron brand's font) carries everything: 800 for headlines,
  in sentence case; 500-700 for labels, names and the bar, which stay
  uppercase; regular weights for prose.
- **No cards, no glass, no shadows, no gradients behind sections.** A hairline
  and space do the same job and never fight the text.
- **The only pictures on the site are the tools in `/toolbox/` and the Heron
  mark on the three Heron pages** (the product's own logo: the app icon on a
  phone, the 3D heron beside the title on a wide screen). The four 3D model
  renders that stood on the cover went in November 2026; the models are
  still in `landing/src/three/` and `npm run posters` still renders them.
- **Short beats complete.** Every page is a headline, a few big figures and
  short numbered rows of one line each. A detail that only some readers need
  goes behind one `<details>` line (as on `/heron-ai/`), not into the page.
- **The whole site wears the Heron brand** (November 2026): Heron's Ink,
  Mist and orange Accent, and its Manrope font, from the Heron brand page
  (`docs/brand/README.md` in Heron-AI) and nowhere else. Headlines are in
  sentence case, as Heron writes its name. `assets/heron/heron.css` keeps
  only what the three Heron pages add: the heron mark and the folded
  details.

## 3. The system

### Type

| Role | Face | Size |
|---|---|---|
| Cover heading | Manrope 800, sentence case | `12.1–15.1vw` |
| Page title (`.display`) | Manrope 800, sentence case | `clamp(2.6rem, 9.2vw, 8.4rem)` |
| Section head (`.head`) | Manrope 800, sentence case | `clamp(1.9rem, 5.2vw, 4.1rem)` |
| Row number (`.row-n i`) | Manrope 800 | `clamp(2.1rem, 5.4vw, 4.6rem)` |
| Row name (`.row-t`) | Manrope 500, uppercase | `clamp(1.05rem, 1.9vw, 1.6rem)` |
| Kicker | Manrope 500, uppercase | `12.5px`, `0.2em` |
| Lead (`.lede`) | Manrope | `clamp(1.05rem, 1.5vw, 1.4rem)` |
| Body | Manrope | `~1rem`, line-height 1.6 |

One variable file, `assets/fonts/manrope.woff2` (Latin, ~24 KB, SIL OFL),
self-hosted and preloaded — no page makes a third-party request for a font.

### Colour

The Heron brand palette (Heron-AI `docs/brand/README.md`). Greys are Mist over
Ink at an opacity, which the brand page allows. Every text colour clears WCAG
AA on both grounds; the tightest pair is `--faint` on `--bg-soft` at 5.0:1.

| Token | Value | On `--bg` |
|---|---|---|
| `--bg` | `#0F0F10` Ink | — |
| `--bg-soft` | `#161617` (Mist 3%) | — |
| `--ink` | `#F7F5F2` Mist | 17.6:1 |
| `--body` | `#b6b5b3` (Mist 72%) | 9.4:1 |
| `--faint` | `#888786` (Mist 52%) | 5.3:1 |
| `--line` | `#262627` (Mist 10%) | — |
| `--accent` | `#FD641A` Accent | 6.4:1 |

Accent is the one highlight: links, figures, the main button (with Ink text —
white on Accent is only 3.0:1) and the Contact button in the bar. Accent Light
`#FF9A5C` appears only as the light end of the one gradient (the bar's
current-section mark, the reading-progress bar, the rule beside a pull quote).
The Services band on the cover is Mist with Ink text.

### Components

That is the whole list. If something new is needed, it is probably `.rows`.

```
.wrap .sec .sec-soft .sec-foot .sec-tool   layout
.display .head .kicker .lede .sub .crumbs  type
.rows .row .row-n .row-t .row-meta .row-go a list of things
.facts .fact                               a list of plain statements
.nums                                      a band of figures
.tags                                      a row of names
.tl .tl-item                               a timeline
.ladder                                    an ordered progression
.quote                                     a pull quote
.btn .btn-ghost .btn-accent .tlink .btnrow buttons
.pager .pcard .cta                         the foot of a page
```

### Rhythm

`.sec` is `clamp(72px, 11vw, 150px)` top and bottom; the first section after a
page header is tighter, because the header already ends in a lot of air.
Content tops out at 1180px, prose at ~52ch. One easing pair for everything.

## 4. Navigation

Three menus and a button, the same on every page including the cover:

```
[AJ AJMAL P.S]   EXPERIENCE ▾   TOOLS ▾   ABOUT ▾            [CONTACT]
                 ├ Story        ├ Automation        ├ Skills
                 ├ Experience   ├ Heron AI          ├ About
                 └ Work         ├ Heron Tools       └ FAQ
                                ├ Heron for AutoCAD
                                └ Toolbox
```

- Each menu is a `<button aria-expanded>` and a `<ul aria-label="…">`. Hover or
  click opens it; a click closes only what a click opened. Escape closes and
  returns focus; `↑ ↓` walk the links; Tab out closes it behind you.
- Under 1000px the three become one sheet with the groups as headings — every
  page one tap away, all twelve links in one phone sheet. The trigger is inert
  there, so it leaves the reading order and the list's label names the group.
- With JavaScript off every menu is simply open. Nothing hides behind a script.
- The bar is written **once**, in `assets/chrome.css`, which every page loads —
  the cover included, although the cover has a stylesheet of its own. The cover
  has no tokens, so each token there carries a fallback equal to the value
  `style.css` defines.

## 5. The tour

A portfolio is read by someone deciding whether to call. The pages are ordered
as that decision, and **every page ends by handing over to the next one**.

1. **Home** — who, and the proof in one screen
2. **Story** — how it started
3. **Experience** — eleven years, and where
4. **Work** — five projects, scope and role
5. **Automation** — the Revit add-ins and scripts a whole team runs
6. **Heron AI** — where it is going
7. **Heron Tools** — the everyday Revit buttons, open source
8. **Heron for AutoCAD** — Heron AI, inside AutoCAD
9. **Toolbox** — tools you can use right now, in the browser
10. **Skills** — the full stack, named
11. **About** — visa, notice, languages
12. **FAQ** — the questions before a call
13. **Contact** — act

The pager carries the previous and next titles and what is on them, so the
visitor always knows what they are about to get.

## 6. Non-negotiable

- Every interactive thing reachable and visible on the keyboard.
- Body text at or above 4.5:1, large headings at or above 3:1.
- `prefers-reduced-motion` turns off every entrance. Nothing is conveyed by
  motion alone.
- Every image carries `width`/`height`. No layout shift.
- No render-blocking third-party anything. The only outside request is the
  analytics counter: `async`, cookie-less, skipped for Do Not Track.
- Every page readable with JavaScript off.
- Every page readable on paper — the print sheet flips the whole thing to ink
  on white.

## 7. Where things live

```
assets/chrome.css     the bar, and nothing else. EVERY page loads it, the
                      cover included; its fallbacks are style.css's values
assets/style.css      the whole content-page system — tokens, then components
assets/fonts/         Kanit 500 and 900, Latin, self-hosted
assets/app.js         menus, reveals, the year, analytics
assets/toolbox.css    the tool pages' own controls
landing/src/          the home page's source. Edit this, never ../index.html
landing/src/three/    the 3D models, no longer shown. `npm run posters` still
                      renders them to assets/home/img/model-*.webp
tools/sync_chrome.py  writes the nav, pager and footer into every page; --check
tools/check_site.py   static checks
tools/check_browser.mjs  the pages in a real browser, at four widths, including
                      the bar on both of its two implementations
tools/update_heron.py writes the figures and the lists on /heron-ai/ straight
                      from a Heron-AI checkout; --check fails when they drift
docs/REDESIGN.md      this file
```

The home page is built: `cd landing && npm install && npm run build` writes
`../index.html` and `../assets/home/`. CI fails if the committed output is not
what the source produces.
