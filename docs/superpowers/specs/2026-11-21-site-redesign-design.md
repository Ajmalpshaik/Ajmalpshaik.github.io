# ajmalps.com redesign: design

Date: 2026-11-21. Approved preview: the home page artifact shared in the session
(misty forest, flock, dark site). This document is what every page is built from.

## Why

The old site had nine pages behind three menus. Visitors had to work to find
anything, and the look read as a template. Ajmal asked for a premium site, in the
class of Apple and Nike pages, with far fewer tabs: one about him, one for his own
tools, one for Heron.

## Goals

- Three tabs and a Contact button, the same on every page: **About me, Tools, Heron**.
- One premium dark look across every page, taken from the approved home page.
- Nothing that worked before breaks: the browser tools, the Heron figures updater,
  the years counter, SEO, old links.

## Non-goals

- New copy. The words come from the existing pages, shortened where pages merge.
- New tools or features in the toolbox pages.

## Anti-goals (a failure even if it works)

- A page that looks like a different site from the home page.
- Big, shouty type. Ajmal asked three times for smaller text.
- Content that hides behind a script, or a page that is blank with JavaScript off.
- An old URL that 404s.

## Structure

| URL | What it is | Built from |
|---|---|---|
| `/` | Home: forest hero, a short story, four figures, contact | the preview |
| `/about/` | About me: story, experience, selected work, skills, visa and notice, FAQ | story, experience, work, skills, about, faq |
| `/tools/` | Tools: the browser tools and the Revit automation, separate from Heron | toolbox, automation |
| `/toolbox/crane-lift-calculator/`, `/toolbox/ar-viewer/`, `/toolbox/bim-viewer/` | The three browser tools, unchanged in what they do | restyled in place |
| `/heron/` | Heron home: the three products | new, from the Heron pages |
| `/heron-ai/`, `/heron-tools/`, `/heron-autocad/` | The Heron products | restyled in place |

Contact is the footer of every page (`#contact`). There is no separate contact page.

### Old addresses forward

Each is a small page with a canonical link, a meta refresh and a script that keeps
the visitor's own `#hash` if there is one.

| Old | New |
|---|---|
| `/story/` | `/about/#story` |
| `/experience/` | `/about/#experience` |
| `/work/` | `/about/#work` |
| `/skills/` | `/about/#skills` |
| `/faq/` | `/about/#faq` |
| `/automation/` | `/tools/#automation` |
| `/toolbox/` | `/tools/#browser-tools` |
| `/contact/` | `/#contact` |

## Approaches considered

1. **Plain HTML pages with one shared stylesheet and script (chosen).** The repo is
   already built this way, GitHub Pages serves it with no build, and every existing
   check script works on it. The React-built home page goes, so the whole site is one
   kind of file.
2. Astro, built in GitHub Actions. Shared components, but it needs a Pages setting
   changed and every check script rewritten for a build output. More moving parts
   for a ten-page site.
3. Reskin the old pages one by one. Keeps the two-system split that made pages drift.

## Design system

Everything is in `assets/site.css`. Read it before building a page.

- **Colour:** near-black `--bg #050506`, panels `--bg-2`/`--bg-3`, text `--fg #F5F5F7`,
  body `--body`, labels `--mute`, hairlines `--line`. Heron orange `--heron #FD641A`
  and `--heron-light #FF9A5C` appear only on Heron things. The home hero is the one
  light place (fog `#C6CACE`).
- **Type:** Geist for everything, weight 600 for headings, tight tracking. Instrument
  Serif italic (`<em class="s">`) for one or two accent words in a heading. Geist Mono
  uppercase (`.eyebrow`) for small labels. Self-hosted in `assets/fonts/`.
- **Sizes are small and calm:** page title `.title` (max ~4.2rem), section heading `.h2`
  (max ~3.3rem), item heading `.h3`, lead `.lede`. Do not go bigger.
- **Components:** `.page-head`, `.sec`, `.sec-top`, `.rows/.row`, `.cards/.card`,
  `.chips/.chip`, `.nums`, `.tl/.tl-item`, `.tags`, `.facts/.fact`, `.faq details`,
  `details.more-detail`, `.steps`, `.quote`, `.pill`, `.ghost`, `.btns`.
- **Motion:** smooth scroll (Lenis), the gliding tab highlight, figures that count up,
  the mouse's linked particles. Nothing starts hidden.

## Page template

```html
<!doctype html>
<html lang="en" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>…</title>
  <meta name="description" content="…">   <!-- under 165 characters -->
  <meta name="author" content="Ajmal P.S">
  <link rel="canonical" href="https://ajmalps.com/…/">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#050506">
  <meta name="color-scheme" content="dark">
  <!-- og:title, og:description, og:url, og:type, og:site_name, og:locale, og:image (+width, height, alt),
       twitter:card summary_large_image, twitter:title, twitter:description, twitter:image -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/favicon.svg">
  <link rel="preload" href="/assets/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/site.css">
  <script>(function(d){d.className=d.className.replace('no-js','js');setTimeout(function(){if(!d.hasAttribute('data-ready'))d.className=d.className.replace(/\bjs\b/,'no-js')},3000)})(document.documentElement)</script>
  <script type="application/ld+json">…Person (copied), WebPage, BreadcrumbList…</script>
</head>
<body>
<!-- chrome:nav --><!-- /chrome:nav -->
<main id="main">
  <header class="page-head">…</header>
  <section class="sec" id="…" data-track="…">…</section>
</main>
<!-- chrome:foot --><!-- /chrome:foot -->
<script src="/vendor/lenis.min.js" defer></script>
<script src="/assets/site.js" defer></script>
</body>
</html>
```

`python3 tools/sync_chrome.py <page>` fills the two chrome blocks. All paths are
absolute (`/assets/…`), so 404.html works at any depth.

## Rules every page keeps

- One `<h1>`, one `<main id="main">`, every image has `alt`, `width`, `height`.
- Years of experience are never typed as a number: `<span data-yrs>11</span> years`
  or `<span data-yrs-word>Eleven</span> years`. `tools/update_years.py` rewrites any
  literal "N years" in every HTML file.
- Every `href="#x"` exists on that page.
- Body text at or above 4.5:1. `prefers-reduced-motion` stops all motion.
- Readable with JavaScript off; readable printed.

## Heron pages

`tools/update_heron.py` writes between `<!-- heron:NAME -->` markers in
`/heron-ai/`. Its markup must stay styled: `.nums` (now in site.css), `p.numnote`,
`ul.tlist.doms > li > details > summary (b, em, span)`, `.frags i`, `i.d`,
`.pgrp > h3 > i`, `ul.tlist li b/span/em`. These styles move to `assets/heron.css`
in the new look. The markers stay where they are.

## Tool pages

The tool UIs keep their IDs and scripts. `assets/toolbox.css` keeps the tool
controls; a small `assets/tool.css` maps the tokens and classes it relied on from the
old stylesheet onto the new look. Full-screen views stay above the bar.

## Checks

`tools/check_site.py`, `tools/check_browser.mjs` and the workflows move to the new
page list, the new bar (`#tabs`, `#burger`, `#overlay`) and the FAQ on `/about/`.
The landing build step goes with `landing/`.

## Left to the builder

Exact wording of merged sections, card order, which details fold behind
`details.more-detail`. Keep pages short: a headline, a few figures, short rows.
