// Loaded by posters.html, for scripts/posters.mjs: renders each model's poster
// in the browser and hands it back as a data URL.

import w300 from '@fontsource/kanit/files/kanit-latin-300-normal.woff2?url'
import w500 from '@fontsource/kanit/files/kanit-latin-500-normal.woff2?url'
import type { SceneName } from './scenes'
import { renderPoster } from './viewer'

const faces = [new FontFace('Kanit', `url(${w300})`, { weight: '300' }), new FontFace('Kanit', `url(${w500})`, { weight: '500' })]

declare global {
  interface Window {
    poster: (name: SceneName, width: number, turn?: { yaw: number; pitch: number }) => ReturnType<typeof renderPoster>
  }
}

window.poster = async (name, width, turn) => {
  for (const f of faces) document.fonts.add(await f.load())
  return renderPoster(name, width, turn)
}
