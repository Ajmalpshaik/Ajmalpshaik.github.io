// Renders the still picture each 3D model shows before it loads (and in its
// place when it never does: no WebGL, reduced motion, Save-Data, no script).
//
// The posters come out of the same code as the live models, at the same angle
// and framing, so the moment one swaps for the other cannot be seen. Run it
// after changing a model:
//
//   npm run posters            all four
//   npm run posters -- void    just one
//
// It also runs the clash check on every model and fails if a single pair of
// services touches that should not.

import { createServer } from 'vite'
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const landing = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const img = join(landing, '..', 'assets', 'home', 'img')

const POSTERS = [
  { scene: 'tower', file: 'model-tower.webp', width: 1040 },
  { scene: 'riser', file: 'model-riser.webp', width: 1200 },
  { scene: 'void', file: 'model-void.webp', width: 1200 },
  { scene: 'xray', file: 'model-xray.webp', width: 1200 },
]

const only = process.argv.slice(2)
const server = await createServer({ root: landing, logLevel: 'warn', server: { port: 0, host: '127.0.0.1' } })
await server.listen()
const origin = server.resolvedUrls.local[0].replace(/\/$/, '')

// Headless Chromium has no GPU here; draw with SwiftShader instead.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('  page error:', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text()))
await page.goto(`${origin}/posters.html`)
await page.waitForFunction(() => typeof window.poster === 'function')

let failed = false
for (const p of POSTERS.filter((p) => !only.length || only.includes(p.scene))) {
  const t0 = Date.now()
  const { data, clashes, height } = await page.evaluate(({ scene, width }) => window.poster(scene, width), p)
  const buf = Buffer.from(data.split(',')[1], 'base64')
  await writeFile(join(img, p.file), buf)
  // content.ts gives each still's width and height to its <img>; keep them in step
  console.log(`${p.scene}: ${p.file}, ${p.width}x${height}, ${(buf.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  for (const c of clashes) console.log(`  CLASH ${c}`)
  if (clashes.length) failed = true
}

await browser.close()
await server.close()
if (failed) {
  console.log('\nclashes found: fix the model before using these posters')
  process.exit(1)
}
