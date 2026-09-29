// Builds the home page and writes it into the live site.
//
// ajmalps.com deploys straight from the repo root with no build step, so the
// built page is committed like any other file:
//
//   ../index.html          the page, already rendered to HTML
//   ../assets/home/        its hashed JS, CSS and fonts
//   ../assets/home/img/    images - hand-placed, never touched by this script
//
// Rendering to HTML here, rather than in the browser, is what lets search
// engines, link previews and people without JavaScript read the page.

import { build } from 'vite'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const landing = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const site = resolve(landing, '..')
const out = join(site, 'assets', 'home')

// 1. the browser bundle, into dist/
await build({ root: landing, logLevel: 'warn' })

// 2. the same app for Node, used once below to render the HTML
await build({
  root: landing,
  logLevel: 'warn',
  build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr', emptyOutDir: true },
})

const { render } = await import(pathToFileURL(join(landing, 'dist-ssr', 'entry-server.js')).href)
let html = await readFile(join(landing, 'dist', 'index.html'), 'utf8')

if (!html.includes('<!--app-html-->')) throw new Error('index.html lost its <!--app-html--> marker')
html = html.replace('<!--app-html-->', () => render())

// Preload the two faces the first screen needs, so the heading and the nav do
// not arrive in a fallback font and then jump.
const built = await readdir(join(landing, 'dist', 'assets', 'home'))
const preloads = ['kanit-latin-900-normal', 'kanit-latin-500-normal'].map((face) => {
  const file = built.find((f) => f.startsWith(face) && f.endsWith('.woff2'))
  if (!file) throw new Error(`font ${face} is missing from the build`)
  return `<link rel="preload" href="/assets/home/${file}" as="font" type="font/woff2" crossorigin>`
})
html = html.replace('</title>', `</title>\n${preloads.join('\n')}`)

html = html.replace(
  '<!DOCTYPE html>',
  '<!DOCTYPE html>\n<!-- Built from landing/ by `npm run build`. Edit landing/src, not this file. -->',
)

// 3. swap the new files in. Old hashed bundles go; the img/ folder stays.
await mkdir(out, { recursive: true })
for (const entry of await readdir(out)) {
  if (entry !== 'img') await rm(join(out, entry), { recursive: true, force: true })
}
await cp(join(landing, 'dist', 'assets', 'home'), out, { recursive: true })
await writeFile(join(site, 'index.html'), html)

console.log(`index.html and assets/home/ written (${built.length} asset files)`)
