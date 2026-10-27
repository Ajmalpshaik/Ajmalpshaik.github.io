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
- **Kanit 900** carries every headline, uppercase, at display sizes. Kanit 500
  carries labels, names and the bar. Body prose stays on the system face: it
  loads instantly and it is the right thing for long text.
- **No cards, no glass, no shadows, no gradients behind sections.** A hairline
  and space do the same job and never fight the text.
- **The only pictures on the site are the four model renders** and the tools in
  `/toolbox/`. The renders are made, not drawn: `npm run posters` renders them
  from 3D models built in code out of MEP parts at real sizes.

## 3. The system

### Type

| Role | Face | Size |
|---|---|---|
| Cover heading | Kanit 900 | `12.1–15.1vw` |
| Page title (`.display`) | Kanit 900 | `clamp(2.6rem, 9.2vw, 8.4rem)` |
| Section head (`.head`) | Kanit 900 | `clamp(1.9rem, 5.2vw, 4.1rem)` |
| Row number (`.row-n i`) | Kanit 900 | `clamp(2.1rem, 5.4vw, 4.6rem)` |
| Row name (`.row-t`) | Kanit 500 | `clamp(1.05rem, 1.9vw, 1.6rem)` |
| Kicker | Kanit 500 | `12.5px`, `0.2em`, uppercase |
| Lead (`.lede`) | system | `clamp(1.05rem, 1.5vw, 1.4rem)` |
| Body | system | `~1rem`, line-height 1.6 |

Everything in Kanit is uppercase. Two weights are self-hosted, Latin only,
about 19 KB each, preloaded — no page makes a third-party request for a font.

### Colour

One set. Every text colour clears WCAG AA on both grounds; the tightest pair is
`--faint` on `--bg-soft` at 4.64:1.

| Token | Value | On `--bg` |
|---|---|---|
| `--bg` | `#0c0c0c` | — |
| `--bg-soft` | `#111113` | — |
| `--ink` | `#f2f6f9` | 18.0:1 |
| `--body` | `#aab8c4` | 9.7:1 |
| `--faint` | `#767f88` | 4.8:1 |
| `--line` | `#23262a` | — |
| `--accent` | `#4aa8ff` | 7.8:1 |

The cyan → blue → violet gradient is the one accent, and it is used in four
places only: the bar's current-section mark, the reading-progress bar, the rule
beside a pull quote, and the cover's Contact button. Not on numbers — across a
one-character number a gradient samples a sliver of its ramp, so "395" comes
out cyan and "0" solid violet side by side.

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
                 ├ Story        ├ Automation ├ Skills
                 ├ Experience   ├ Heron AI   ├ About
                 └ Work         └ Toolbox    └ FAQ
```

- Each menu is a `<button aria-expanded>` and a `<ul aria-label="…">`. Hover or
  click opens it; a click closes only what a click opened. Escape closes and
  returns focus; `↑ ↓` walk the links; Tab out closes it behind you.
- Under 1000px the three become one sheet with the groups as headings — every
  page one tap away, all ten links on one phone screen. The trigger is inert
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
7. **Toolbox** — tools you can use right now, in the browser
8. **Skills** — the full stack, named
9. **About** — visa, notice, languages
10. **FAQ** — the questions before a call
11. **Contact** — act

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
landing/src/three/    the models. Build-time only: `npm run posters` renders
                      them to assets/home/img/model-*.webp
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
