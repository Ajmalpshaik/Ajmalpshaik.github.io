# Vendored libraries

Served from this repo, so no page depends on someone else's CDN for its code.
Two exceptions, both three.js from jsDelivr, pinned to an exact version with a
SHA-384 fingerprint on every file:

- `/toolbox/ar-viewer/`, `/toolbox/bim-viewer/` and the crane calculator's 3D
  view load three.js 0.186.1 through an import map. The BIM Viewer's map is
  written by `tools/pin_three.mjs`, which follows the imports so no file is left
  without a fingerprint.
- The home page's forest and welcome load three.js 0.128.0 (`build/three.min.js`),
  `examples/js/misc/GPUComputationRenderer.js` and
  `examples/js/modifiers/TessellateModifier.js` as plain scripts, with
  `integrity` attributes in index.html. These are non-module builds: releases
  after r147 no longer ship `examples/js`. The forest, mist and flock were tuned
  against r128.

| File | Version | License |
|---|---|---|
| `lenis.min.js` | 1.3.26 | MIT (see `LENIS-LICENSE`) |
| `web-ifc/web-ifc-api.js`, `web-ifc/web-ifc.wasm` | 0.0.78 | MPL-2.0 (see `web-ifc/LICENSE.md`) — https://github.com/ThatOpen/engine_web-ifc |

To update: `npm i lenis` and copy `dist/lenis.min.js` here.

Removed on 2026-11-21 with the redesign: `gsap.min.js` and
`ScrollTrigger.min.js`. Nothing on the new site uses them.

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

Removed on 2026-10-27: `three.min.js` (r134) and `vanta.birds.min.js`, which
drew a flock of birds behind the hero on `/heron-ai/`. three.js alone is 600 kB
and the two were fetched only when the effect would really be drawn, but it was
decoration on a page that reads better without it, and 650 kB is a lot of
repository for a background. Both are in the history if the flock is ever
wanted back.
