# ajmalps.com — the redesign

What the site is for, the one system it is built from, and the order the pages
are meant to be read in. Read this before changing any page: the rules here are
what keep fourteen hand-written HTML files looking like one site.

## 1. The problem this redesign solves

The site was two sites wearing one domain.

| | Home page | Every other page |
|---|---|---|
| Built from | `landing/` (React, Vite, Tailwind), output committed | hand-written HTML + `assets/style.css` |
| Palette | dark only, `#0C0C0C` on `#D7E2EA` | light by default, dark on a toggle |
| Display face | Kanit 900, uppercase, huge | system sans, 700 |
| Top nav | 4 items, all anchors on the page, no brand | 9 flat tabs in a capsule, brand, theme switch |
| Footer | wide, every page listed | three columns |

A visitor leaving the home page for `/contact/` left a cinematic dark cover and
landed on a white page in a different typeface with a different navigation. Both
halves were well made. Together they read as two unrelated sites, which costs
exactly the thing a portfolio is for: being believed.

The redesign keeps both halves' strengths and makes them one system.

## 2. The decision

**One system, dark-first, Kanit on the headings, the home page's skin as the
dark theme of every other page.**

- The home page stays the **cover**: dark only, full-bleed, cinematic. A cover
  does not need a theme switch.
- Every content page keeps the light/dark toggle, following the operating
  system until the visitor says otherwise — but its **dark theme is retuned to
  be the home page exactly** (`#0C0C0C` ground, `#D7E2EA` secondary text). A
  visitor in dark mode now never sees a seam.
- **Kanit** carries every heading on every page, so the voice of the home page
  is the voice of the site. Body prose stays on the system face: it is faster,
  and it is what long text should be set in.
- Nav and footer are **structurally identical everywhere**: brand, three
  grouped menus, a Contact button, and (off the cover) the theme switch. The
  bar is written **once**, in `assets/chrome.css`, and every page loads that
  file — the cover included, although the cover has a stylesheet of its own.
- **Nothing moves that does not have to.** The live 3D models on the cover and
  the flock of birds on `/heron-ai/` are gone; what is left is the pictures
  those models render to, which is what the page always showed first anyway.

## 3. The design system

### Type

| Role | Face | Size | Notes |
|---|---|---|---|
| Cover heading | Kanit 900 | `12–15vw` | uppercase, tracking tight |
| Page title (`h1`) | Kanit 900 | `clamp(40px, 7vw, 76px)` | sentence case, `-0.03em` |
| Section head (`h2.head`) | Kanit 900 | `clamp(32px, 5vw, 58px)` | sentence case |
| Card head (`h3`) | Kanit 500 | `21–23px` | |
| Eyebrow | Kanit 500 | `13px` | uppercase, `0.14em` |
| Body | system sans | `16.5–21px` | line-height 1.55 |

Two weights are self-hosted for the content pages — `assets/fonts/kanit-500.woff2`
and `kanit-900.woff2`, Latin only, about 19 KB each. `font-display: swap`, and
the system face is the fallback, so nothing is invisible while they load.

### Colour

One token set, two themes. The dark values are the home page's.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#ffffff` | `#0c0c0c` |
| `--bg-alt` | `#f5f5f7` | `#121316` |
| `--ink` | `#1d1d1f` | `#eef4f8` |
| `--muted` | `#6e6e73` | `#d7e2ea` |
| `--link` | `#0071e3` | `#2997ff` |

The cyan → blue → violet gradient stays as the accent on numbers and icons.
Nothing else is coloured.

### Rhythm

`section { padding: 110px 0 }`, 76px under 734px. Content tops out at 1080px,
prose at 820px. Radii: 28px cards, 999px pills. One easing pair
(`--ease`, `--ease-out`) for everything.

### What came out, and why

| Removed | Weight | Why |
|---|---|---|
| The cover's live three.js models | ~150 KB gzipped, a WebGL context each | They looked very nearly the same as the `model-*.webp` pictures that stand in for them, which are rendered from the same models at the same angle. The models and `npm run posters` are still here; only the viewer stopped shipping. |
| The flock behind the `/heron-ai/` hero | 650 KB in the repo, fetched on demand | Decoration on a page that reads better without it. |
| Backdrop blur and two-sided shadows on cards | — | They fought the text on them and cost a paint on scroll. Blur is left on the bar, where it belongs. |
| Five of the six ambient colour washes | — | Six washes down one page is noise, not atmosphere. |
| The light that followed the cursor across cards | a paint per mouse move | It drew the eye to the pointer, not to the words. |
| 133 lines of CSS for blocks no page uses | — | The stats band, the ribbon, the Heron panel, the explore grid. |

Everything in `/toolbox/` stays. The BIM Viewer and the AR Viewer are not
decoration — they are the work.

## 4. Navigation

Nine flat tabs was a wall, and it was already measured to the pixel against the
1080px bar — adding one more label would have broken it. It is now three menus
and a button, which fits at any width and will take another page without a
re-measure.

```
[AJ Ajmal P.S]   Experience ▾   Tools ▾   About ▾        [Contact]  [☀/☾]
                 ├ Story        ├ AJ-Tools   ├ Skills
                 ├ Experience   ├ Heron AI   ├ About
                 └ Work         └ Toolbox    └ FAQ
```

- Each menu is a `<button aria-expanded>` with a `<ul>`; Escape closes,
  `↑ ↓` moves inside it, Tab leaves it, and the trigger of the section you are
  in is marked `aria-current`.
- Under 1100px the three menus become one full-height sheet with the groups as
  headings — no nesting to open, every page one tap away.
- With JavaScript off the menus are plain always-open lists. Nothing is hidden
  behind a script.

## 5. The tour

A portfolio is read by someone deciding whether to call. The pages are ordered
as that decision, and **every page ends by handing over to the next one** — so
there is no dead end and no page where the only move is the back button.

1. **Home** — who, and the proof in one screen
2. **Story** — how it started
3. **Experience** — eleven years, and where
4. **Work** — five projects, scope and role
5. **AJ-Tools** — the Revit add-in a whole team runs
6. **Heron AI** — where it is going
7. **Toolbox** — tools you can use right now, in the browser
8. **Skills** — the full stack, named
9. **About** — the practical facts: visa, notice, languages
10. **FAQ** — the questions a hiring manager asks before writing
11. **Contact** — act

The pager at the foot of each page carries the previous and next titles, not
just arrows, so the visitor always knows what they are about to get. `/`
offers "Start here →" into step 2 for anyone who wants the whole thing in
order.

## 6. Accessibility and performance, non-negotiable

- Every interactive thing reachable and visible on the keyboard; `:focus-visible`
  rings on both themes.
- Body text at or above 4.5:1 on both themes; large headings at or above 3:1.
- `prefers-reduced-motion` turns off every entrance, the marquee and the
  parallax. Nothing is only conveyed by motion.
- No layout shift: every image carries `width`/`height`, fonts swap on a
  matched fallback metric.
- No render-blocking third-party anything. The only outside request is the
  analytics counter, and it is `async`, cookie-less and skipped for Do Not
  Track.
- Every page readable with JavaScript off.

## 7. Where things live

```
assets/chrome.css     the bar, and nothing else. EVERY page loads it, the cover
                      included; its token fallbacks are style.css's dark theme
assets/style.css      the whole content-page system — tokens first, then components
assets/fonts/         Kanit 500 and 900, Latin, self-hosted
assets/app.js         nav, menus, theme, reveals, analytics
landing/src/          the home page's source. Edit this, never ../index.html
landing/src/three/    the models. Build-time only now: `npm run posters`
                      renders them to assets/home/img/model-*.webp
tools/sync_chrome.py  writes the nav and footer into every page; --check in CI
tools/check_site.py   static checks
tools/check_browser.mjs  the pages in a real browser, at four widths - including
                      the bar, on both of its two implementations
docs/REDESIGN.md      this file
```

The home page is built: `cd landing && npm install && npm run build` writes
`../index.html` and `../assets/home/`. CI fails if the committed output is not
what the source produces.
