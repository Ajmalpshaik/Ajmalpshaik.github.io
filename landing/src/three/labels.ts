// Text in the models - tags, dimension values, a question - drawn once into a
// canvas and shown on a sprite that always faces the camera, so it stays
// readable from every angle the model turns to.

import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, type Vector3 } from 'three'

export type LabelStyle = {
  bg?: string
  color?: string
  border?: string
  size?: number
  weight?: number
  pad?: number
  /** Corner radius as a share of the label's height; 0.5 is a pill. */
  radius?: number
  /** Which point of the label sits on `at`: [0.5, 0] is bottom centre. */
  anchor?: [number, number]
}

const SCALE = 3

export function label(text: string, at: Vector3, height: number, s: LabelStyle = {}): Sprite {
  const size = (s.size ?? 30) * SCALE
  const pad = (s.pad ?? 14) * SCALE
  const font = `${s.weight ?? 500} ${size}px Kanit, system-ui, sans-serif`
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width + pad * 2)
  const h = Math.ceil(size * 1.25 + pad * 1.1)
  cv.width = w
  cv.height = h
  ctx.font = font
  const r = Math.min(h / 2, h * (s.radius ?? 0.5))
  if (s.bg) {
    ctx.fillStyle = s.bg
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, r)
    ctx.fill()
  }
  if (s.border) {
    const lw = 2.5 * SCALE
    ctx.strokeStyle = s.border
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.roundRect(lw / 2, lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2))
    ctx.stroke()
  }
  ctx.fillStyle = s.color ?? '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, w / 2, h / 2 + size * 0.04)

  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  sprite.scale.set((height * w) / h, height, 1)
  sprite.position.copy(at)
  sprite.center.set(...(s.anchor ?? [0.5, 0.5]))
  sprite.renderOrder = 10
  return sprite
}
