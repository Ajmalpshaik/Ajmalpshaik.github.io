# Home page source

`/index.html` is built from this folder with React, TypeScript, Tailwind CSS
and Framer Motion. Every other page on the site is plain HTML and needs no
build.

| What | Where |
|---|---|
| Every word, link and image path | `src/content.ts` |
| The sections, top to bottom | `src/sections/` |
| Fade-in, magnet, scroll-lit text, buttons | `src/components/` |
| The bar, shared with every other page | `src/components/SiteNav.tsx` + `/assets/chrome.css` |
| The models the pictures are rendered from | `src/three/` (build-time only) |
| The images | `/assets/home/img/` at the repo root |
| A ready prompt for every image slot | `IMAGE-PROMPTS.md` |

Images are plain files referenced by path, so replacing one with a new file of
the same name needs no rebuild. Everything else does.

## Build

    cd landing
    npm install
    npm run build

This typechecks, renders the page to static HTML and writes `/index.html` and
`/assets/home/`. Commit both with the source change. CI rebuilds the page and
fails if the committed files are not what the source produces.

`npm run dev` gives a live preview at http://localhost:5173 while editing.

## The bar

The top bar is not written here. It is `/assets/chrome.css`, which every page
on the site loads, and `src/components/SiteNav.tsx` only supplies the markup
and the behaviour for this one. The classes must match what
`tools/sync_chrome.py` writes for the other pages, and
`tools/check_browser.mjs` exercises both. See `docs/REDESIGN.md`.

## The models

The picture on the first screen and on each project card is rendered from a 3D
model built in code from MEP parts at real sizes, in metres: `kit.ts` has the
parts (pipes with real elbows, ducts, trays, hangers, valves), `building.ts`
and `corridor.ts` lay them out, and `scenes.ts` frames the four models. Every
model is clash-free, and checked.

**They are build-time only.** The page used to draw them live, which cost about
150 KB gzipped of three.js and a WebGL context per model so the result could
look very nearly the same as the picture already behind it. The page ships the
pictures now, and three.js is a devDependency: a thing used to make an image,
not something a visitor downloads.

After changing a model, render its picture again from the same code:

      npm run posters

This needs Playwright, from `npm install` at the repo root. It runs the clash
check on every model too, and fails on a single clash.

## Third-party code in the bundle

Nothing else is fetched at runtime: the font is self-hosted and three.js no
longer ships.

| Package | License |
|---|---|
| React, React DOM 18.3 | MIT |
| Framer Motion 12 | MIT |
| Lucide React 0.344 | ISC |
| Kanit font (via @fontsource/kanit) | SIL Open Font License 1.1 |
