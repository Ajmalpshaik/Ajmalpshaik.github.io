# ajmalps.com, the design

What the site is for, the one system it is built from, and where everything
lives. Read this before changing any page: these rules keep a dozen hand-written
HTML files looking like one site.

## 1. What it is for

A portfolio read by someone deciding whether to hire Ajmal, or to use his tools.
It has to look like the work of a careful professional, get to the point fast,
and never make a visitor hunt for anything.

## 2. The decision (November 2026)

The site was rebuilt from zero. The old one had nine pages behind three menus
and read as a template. The new one is:

- **Three tabs and a Contact button**, the same on every page: **About me**,
  **Tools** (his own tools, not Heron) and **Heron** (the product family).
  Contact is the footer of every page.
- **One premium dark skin.** Near-black, calm, generous space, small type.
  The one light place is the home page's hero: a misty forest in bright grey fog
  that turns to night as you scroll.
- **Small, calm type.** Headings are deliberately modest. When in doubt, smaller.
- **Motion with a job:** the forest and its flock on the home page, a highlight
  that glides between tabs, figures that count up, smooth scrolling, and linked
  particles behind the mouse. Nothing starts hidden.

## 3. The system

Everything shared is in `assets/site.css` and `assets/site.js`.

### Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050506` | page |
| `--bg-2`, `--bg-3` | `#0D0D0F`, `#151518` | panels, cards |
| `--fg` | `#F5F5F7` | headings, main text |
| `--body` | `#B9B9BE` | running text |
| `--mute` | `#8C8C92` | labels, notes |
| `--line` | white at 9% | hairlines |
| `--heron`, `--heron-light` | `#FD641A`, `#FF9A5C` | Heron things only |
| `--fog` | `#C6CACE` | the home hero |

Heron orange appears only on Heron: its tab highlight (only while pointed at or
selected), its cards, its pages' accents.

### Type

Self-hosted in `assets/fonts/` (SIL OFL). No page asks a third party for a font.

| Role | Face | Size |
|---|---|---|
| Page title `.title` | Geist 600 | up to ~4.2rem |
| Home headline `.hero-heading` | Geist 600 | up to ~3.5rem |
| Section `.h2` | Geist 600 | up to ~3.3rem |
| Item `.h3` | Geist 600 | up to ~1.6rem |
| Lead `.lede` | Geist 400 | up to ~1.25rem |
| Label `.eyebrow` | Geist Mono, uppercase | 12px |
| Accent words `<em class="s">` | Instrument Serif italic | one or two words per heading |

### Components

```
.wrap .page-head .sec .sec-top .sec-soft          layout
.title .h2 .h3 .lede .prose .eyebrow em.s          type
.rows .row (.row-k .row-v)  a.row                  a list of things
.cards .card (.idx .chips .h3 .more)  .card.heron  things you can open
.nums                                              a band of figures
.tl .tl-item                                       a timeline
.tags  .facts .fact  .faq  details.more-detail     detail
.steps  .quote                                     a progression, a quote
.pill .ghost .btns  .pill.heron                    buttons
```

If something new is needed, it is probably `.rows` or `.cards`.

## 4. The bar

```
[• Ajmal P.S]        [ About me | Tools | Heron ]        [Contact ↗]
```

- Written once, by `tools/sync_chrome.py`, between `<!-- chrome:nav -->` markers
  in every page, and the footer between `<!-- chrome:foot -->` markers.
  `--check` fails CI if any page drifts.
- One highlight glides to the tab under the pointer and back to the current page.
  The current page's tab is solid; Heron's is orange.
- Under 900px the tabs fold into a full-screen sheet behind a menu button.
  Escape closes it. With JavaScript off the tabs simply stay in the bar.

## 5. The pages

| URL | What |
|---|---|
| `/` | The forest, the headline, a short story, four figures |
| `/about/` | Story, experience, selected work, skills, visa and notice, FAQ |
| `/tools/` | The browser tools and the Revit automation |
| `/toolbox/*/` | Crane Lift Calculator, AR Viewer, BIM Viewer |
| `/heron/` | The Heron family |
| `/heron-ai/`, `/heron-tools/`, `/heron-autocad/` | The Heron products |

Old addresses (`/story/`, `/experience/`, `/work/`, `/skills/`, `/faq/`,
`/automation/`, `/toolbox/`, `/contact/`) are small forwarding pages: a canonical
link, a meta refresh and a script, each pointing at the section that replaced it.
`assets/site.js` also forwards the old single-page anchors (`/#faq` and so on).

## 6. The home page

`assets/home.css` and `assets/home.js`, on top of the shared files.

- **Forest:** bare trees grown in code from a seed (`makeTree`), instanced, in an
  exponential fog whose colour is the background's, so far trunks dissolve.
- **Mist:** sheets of animated noise at several depths, thick near the ground.
- **Flock:** the three.js GPGPU birds (`webgl_gpgpu_birds`, MIT), stepped on the
  GPU in the same scene so the fog reaches them. The mouse scares them. Their home
  drifts, so about once a minute they sweep past close to the camera.
- **Scroll:** the hero leaves, the story lights up word by word in near dark, the
  fog turns to night, then the dark lifts a little: the same forest stays behind
  the figures and the footer (a fixed `.sky` layer), in night fog with a cold glow
  behind the trees, and the view tilts up through the branches at the very end.
  Small grey text on the home page is `#A1A1A7` there, so it keeps 4.5:1 over the
  glow and the snow. Without the 3D scene the page goes to black as before.
- **Snow:** light point-sprite snow (after `webgl_points_sprites`): five
  snowflake shapes drawn in code, small, falling, swaying and spinning, fogged
  like the trees.
- **Leaves:** three layers of small leaves in Heron orange, light orange and gold
  (after `webgpu_layers`), drawn in code, blowing left to right and tumbling.
- **Welcome** (`assets/intro.js`), once per visit: "Ajmal P.S" in 3D Geist,
  cut into triangles by `TessellateModifier` (after `webgl_modifier_tessellation`),
  assembles left to right in the site's colours, breathes, then flies apart as
  the dark lifts off the forest. About five seconds; Skip, a click or Escape ends
  it. An inline head script decides before first paint (`sessionStorage`
  `aj-intro`, reduced motion), so it never flashes and never replays in a visit.
  The 3D typeface `assets/fonts/geist-600.typeface.json` is made from the site's
  Geist (OFL) with fontTools.
- three.js r128 and `GPUComputationRenderer` come from jsDelivr, pinned, with
  SHA-384 integrity. Without them, or without `home.js`, the hero and the story are
  plain HTML and the stage does not pin.

## 7. Non-negotiable

- Every interactive thing reachable and visible on the keyboard. A skip link first.
- Body text at or above 4.5:1.
- `prefers-reduced-motion` stops every animation and the smooth scroll.
- Every page readable with JavaScript off, and on paper.
- One `<h1>` and one `<main id="main">` per page.
- Years of experience are never typed as a number: `<span data-yrs>11</span>` or
  `<span data-yrs-word>Eleven</span>`. `tools/update_years.py` rewrites any literal
  "N years" in every HTML file every month.
- No third-party request except three.js on the home page and the tool pages
  (pinned, fingerprinted) and the analytics counter (GoatCounter: async,
  cookie-less, skipped for Do Not Track and Global Privacy Control).

## 8. Where things live

```
assets/site.css         the whole system: tokens, type, bar, components, footer
assets/site.js          bar, menu, smooth scroll, counters, particles, years,
                        old-anchor forwards, analytics
assets/home.css/.js     the home page's forest, mist, flock and scroll story
assets/intro.js         the home page's welcome, once per visit
assets/heron.css        what the Heron pages add, including the markup
                        tools/update_heron.py writes
assets/tool.css         maps the tool pages onto the system
assets/toolbox.css      the tools' own controls
assets/fonts/           Geist, Geist Mono, Instrument Serif (OFL)
tools/sync_chrome.py    writes the bar and footer into every page; --check
tools/check_site.py     static checks
tools/check_browser.mjs the pages in a real browser, at four widths
tools/update_heron.py   writes /heron-ai/'s figures from a Heron-AI checkout
tools/update_years.py   keeps "N years" current
docs/REDESIGN.md        this file
```
