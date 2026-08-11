# Vendored libraries

Served from this repo so the site makes no third-party requests at runtime.

| File | Version | License |
|---|---|---|
| `gsap.min.js` | 3.15.0 | GSAP Standard "no charge" license — https://gsap.com/standard-license |
| `ScrollTrigger.min.js` | 3.15.0 | GSAP Standard "no charge" license |
| `lenis.min.js` | 1.3.26 | MIT (see `LENIS-LICENSE`) |
| `three.min.js` | r134 | MIT — https://github.com/mrdoob/three.js |
| `vanta.birds.min.js` | 0.5.24 | MIT (see `VANTA-LICENSE`) |

To update: `npm i gsap lenis` and copy the `dist` files here.

`three.min.js` and `vanta.birds.min.js` power the flock behind the hero on the
home page. They are **not** in any `<script>` tag: three.js alone is 600 kB, so
`assets/app.js` fetches both only when the effect will really be drawn — home
page, no reduced-motion preference, no Save-Data, WebGL present. Every other
page, and every visitor who cannot or does not want to see it, downloads
neither file. r134 is the version Vanta targets; newer three.js releases move
APIs that Vanta still calls.
