# Vendored libraries

Served from this repo, so no page depends on someone else's CDN for its code.
One exception: `/toolbox/ar-viewer/` and `/toolbox/bim-viewer/` load three.js
0.186.1 from jsDelivr, pinned to that exact version, with a SHA-384 fingerprint
for every file in the page's import map. They need a current three.js;
`three.min.js` here stays at r134 because Vanta needs it. The BIM Viewer's map
is written by `tools/pin_three.mjs`, which follows the imports so no file is
left without a fingerprint.

| File | Version | License |
|---|---|---|
| `gsap.min.js` | 3.15.0 | GSAP Standard "no charge" license — https://gsap.com/standard-license |
| `ScrollTrigger.min.js` | 3.15.0 | GSAP Standard "no charge" license |
| `lenis.min.js` | 1.3.26 | MIT (see `LENIS-LICENSE`) |
| `three.min.js` | r134 | MIT — https://github.com/mrdoob/three.js |
| `vanta.birds.min.js` | 0.5.24 | MIT (see `VANTA-LICENSE`) |
| `web-ifc/web-ifc-api.js`, `web-ifc/web-ifc.wasm` | 0.0.78 | MPL-2.0 (see `web-ifc/LICENSE.md`) — https://github.com/ThatOpen/engine_web-ifc |

To update: `npm i gsap lenis` and copy the `dist` files here.

`web-ifc/` is the IFC reader behind `/toolbox/bim-viewer/`. It runs in that
page's worker, which cannot use an import map, so it is served from here rather
than from a CDN. Only the single-threaded build is kept: the multithreaded one
needs cross-origin isolation headers that GitHub Pages cannot send. To update:
`npm i web-ifc@<version>`, copy `web-ifc-api.js`, `web-ifc.wasm` and
`LICENSE.md` here, and change the version in the BIM Viewer's notes.

The walk view's Soldier and X Bot are Adobe Mixamo characters from the three.js
examples. Mixamo allows them in a project but not re-sharing the files, so they
are not stored here: `toolbox/bim-viewer/walk.js` fetches three.js's own copy
from jsDelivr, pinned to r186 with a SHA-384 fingerprint. The robot,
`toolbox/bim-viewer/robot.glb`, is RobotExpressive from the same examples, CC0.

`three.min.js` and `vanta.birds.min.js` power the flock behind the hero on
`/heron-ai/` (the home page had it too, until it moved to `landing/`). They are
**not** in any `<script>` tag: three.js alone is 600 kB, so `assets/app.js`
fetches both only when the effect will really be drawn — a page with a
`#vanta-hero`, no reduced-motion preference, no Save-Data, WebGL present.
Every other page, and every visitor who cannot or does not want to see it,
downloads neither file. r134 is the version Vanta targets; newer three.js releases move
APIs that Vanta still calls.
