# Home page source

`/index.html` is built from this folder with React, TypeScript, Tailwind CSS
and Framer Motion. Every other page on the site is plain HTML and needs no
build.

| What | Where |
|---|---|
| Every word, link and image path | `src/content.ts` |
| The sections, top to bottom | `src/sections/` |
| Fade-in, magnet, scroll-lit text, buttons | `src/components/` |
| The 3D models | `src/three/`, shown by `src/components/Model3D.tsx` |
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

## 3D models

The first screen and the right side of each project card are live 3D models,
drawn with three.js. They are built in code from MEP parts at real sizes, in
metres: `kit.ts` has the parts (pipes with real elbows, ducts, trays,
hangers, valves), `building.ts` and `corridor.ts` lay them out, and
`scenes.ts` frames the four models. Every model is clash-free, and checked.

- The page ships a still of each model, `/assets/home/img/model-*.webp`, so
  the first paint never waits for 3D. three.js (about 150 KB gzipped) is
  fetched only when a model is about to be seen, and the still fades out
  once the model's first frame is on screen.
- Visitors without WebGL 2, on a slow software renderer, asking for reduced
  motion or saving data keep the still. So do print and no-JavaScript.
- After changing a model, render its still again from the same code:

      npm run posters

  This needs Playwright, from `npm install` at the repo root. It runs the
  clash check on every model too, and fails on a single clash.

## Third-party code in the bundle

| Package | License |
|---|---|
| React, React DOM 18.3 | MIT |
| Framer Motion 12 | MIT |
| Lucide React 0.344 | ISC |
| three.js 0.186 (only in the 3D chunk) | MIT |
| Kanit font (via @fontsource/kanit) | SIL Open Font License 1.1 |
