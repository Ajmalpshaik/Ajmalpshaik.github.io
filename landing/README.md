# Home page source

`/index.html` is built from this folder with React, TypeScript, Tailwind CSS
and Framer Motion. Every other page on the site is plain HTML and needs no
build.

| What | Where |
|---|---|
| Every word, link and image path | `src/content.ts` |
| The sections, top to bottom | `src/sections/` |
| Fade-in, magnet, scroll-lit text, buttons | `src/components/` |
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

## Third-party code in the bundle

| Package | License |
|---|---|
| React, React DOM 18.3 | MIT |
| Framer Motion 12 | MIT |
| Lucide React 0.344 | ISC |
| Kanit font (via @fontsource/kanit) | SIL Open Font License 1.1 |
