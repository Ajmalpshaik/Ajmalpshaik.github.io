import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

// The repo root is the live site. Images, the favicon and the other pages are
// served from there on ajmalps.com, so the dev server reads them from there too.
const SITE_ROOT = fileURLToPath(new URL('..', import.meta.url))

const TYPES: Record<string, string> = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
}

function serveSiteRoot(): Plugin {
  return {
    name: 'serve-site-root',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0])
        if (!path.startsWith('/assets/home/img/') && path !== '/favicon.svg') return next()
        const file = join(SITE_ROOT, normalize(path))
        try {
          if (!file.startsWith(SITE_ROOT) || !statSync(file).isFile()) return next()
        } catch {
          return next()
        }
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveSiteRoot()],
  // Nothing is copied in: images live at the repo root and are referenced by path.
  publicDir: false,
  build: {
    outDir: 'dist',
    assetsDir: 'assets/home',
    emptyOutDir: true,
  },
})
