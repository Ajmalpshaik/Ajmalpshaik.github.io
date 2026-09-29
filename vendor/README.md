# Vendored libraries

Served from this repo, so no page depends on someone else's CDN for its code.
One exception: `/toolbox/ar-viewer/` loads three.js 0.186.1 from jsDelivr,
pinned to that exact version, with a SHA-384 fingerprint for every file in the
page's import map. It needs a current three.js; `three.min.js` here stays at
r134 because Vanta needs it.

| File | Version | License |
|---|---|---|
| `gsap.min.js` | 3.15.0 | GSAP Standard "no charge" license — https://gsap.com/standard-license |
| `ScrollTrigger.min.js` | 3.15.0 | GSAP Standard "no charge" license |
| `lenis.min.js` | 1.3.26 | MIT (see `LENIS-LICENSE`) |
| `three.min.js` | r134 | MIT — https://github.com/mrdoob/three.js |
| `vanta.birds.min.js` | 0.5.24 | MIT (see `VANTA-LICENSE`) |

To update: `npm i gsap lenis` and copy the `dist` files here.

`three.min.js` and `vanta.birds.min.js` power the flock behind the hero on
`/heron-ai/` (the home page had it too, until it moved to `landing/`). They are
**not** in any `<script>` tag: three.js alone is 600 kB, so `assets/app.js`
fetches both only when the effect will really be drawn — a page with a
`#vanta-hero`, no reduced-motion preference, no Save-Data, WebGL present.
Every other page, and every visitor who cannot or does not want to see it,
downloads neither file. r134 is the version Vanta targets; newer three.js releases move
APIs that Vanta still calls.
