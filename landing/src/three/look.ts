// Colours, materials and light for the models.
//
// Services are coloured by system the way a coordination model is, so a
// coordinator reads them at a glance; structure is a quiet white, like a
// physical scale model.

import {
  AdditiveBlending,
  Color,
  DirectionalLight,
  HemisphereLight,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from 'three'

export const SYSTEM = {
  sa: 0x58a8f2, // supply air
  ra: 0xc062e6, // return air
  fa: 0x34c79f, // fresh air
  chws: 0x24c6dc, // chilled water supply
  chwr: 0x2f57d8, // chilled water return
  fire: 0xe3392e, // wet riser, landing valves
  spk: 0xf05545, // sprinklers
  dcw: 0x4cc06c, // domestic cold water
  soil: 0xa47b56, // soil and waste
  vent: 0xc49a6c, // vent
  tray: 0xf1ab38, // cable tray
} as const

const paint = (color: number, o: Partial<{ roughness: number; metalness: number }> = {}) =>
  new MeshStandardMaterial({ color, roughness: o.roughness ?? 0.38, metalness: o.metalness ?? 0.06 })

/** Every material key the scenes use, as solid model materials. */
export function clayMaterials(): Record<string, Material> {
  const m: Record<string, Material> = {
    slab: paint(0xb9c2cc, { roughness: 0.75 }),
    column: paint(0xaab4bf, { roughness: 0.75 }),
    plinth: paint(0xc9ced5, { roughness: 0.8 }),
    equip: paint(0xe4e8ec, { roughness: 0.45, metalness: 0.15 }),
    dark: paint(0x3a424c, { roughness: 0.5, metalness: 0.3 }),
    steel: paint(0x9aa3ac, { roughness: 0.35, metalness: 0.85 }),
    galv: paint(0xc3cbd3, { roughness: 0.32, metalness: 0.8 }),
    face: paint(0xf6f7f9, { roughness: 0.5 }),
    brass: paint(0xd8b25e, { roughness: 0.3, metalness: 0.9 }),
    valve: paint(0x2f363f, { roughness: 0.4, metalness: 0.5 }),
    lever: paint(0xd8392d, { roughness: 0.35 }),
    wheel: paint(0xd8392d, { roughness: 0.35 }),
    glass: new MeshStandardMaterial({ color: 0xbfd8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }),
    arrow: new MeshBasicMaterial({ color: 0xffffff }),
    dim: new MeshBasicMaterial({ color: 0xffffff }),
    leader: new MeshBasicMaterial({ color: 0xe9eef3 }),
    grid: paint(0x8e98a3, { roughness: 0.6 }),
    tile: new MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.9, transparent: true, opacity: 0.16, depthWrite: false }),
    glow: new MeshStandardMaterial({ color: 0x1fb8d0, emissive: new Color(0x19c8e6), emissiveIntensity: 1.1, roughness: 0.4 }),
    spark: new MeshBasicMaterial({ color: 0xffffff }),
  }
  for (const [k, c] of Object.entries(SYSTEM)) m[k] = paint(c)
  return m
}

/**
 * The x-ray look: every material becomes a faint additive glass, so the whole
 * building reads at once and overlaps glow brighter. Only the keys in `keep`
 * stay solid - the traced system.
 */
export function xrayMaterials(keep: string[]): Record<string, Material> {
  const solid = clayMaterials()
  const ghost = new MeshBasicMaterial({
    color: 0x8fa9c4,
    transparent: true,
    opacity: 0.13,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const out: Record<string, Material> = {}
  for (const k of Object.keys(solid)) out[k] = keep.includes(k) ? solid[k] : ghost
  return out
}

/**
 * The studio light: sky and ground fill, a key from the front right that
 * casts the shadows, and the site's magenta as a rim from behind.
 */
export function lights(center: Vector3, extent: number) {
  const at = (x: number, y: number, z: number) => center.clone().add(new Vector3(x, y, z).multiplyScalar(extent))
  const target = new Object3D()
  target.position.copy(center)
  const hemi = new HemisphereLight(0xc8daff, 0x1c2028, 0.75)
  const key = new DirectionalLight(0xffffff, 2.3)
  key.position.copy(at(0.9, 1.6, 1.2))
  key.target = target
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  const cam = key.shadow.camera
  cam.left = -extent
  cam.right = extent
  cam.top = extent
  cam.bottom = -extent
  cam.near = 0.1
  cam.far = extent * 6
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.02
  key.shadow.radius = 3
  const rim = new DirectionalLight(0xb600a8, 1.5)
  rim.position.copy(at(-1.2, 0.5, -1))
  rim.target = target
  const fill = new DirectionalLight(0x9fc3ff, 0.55)
  fill.position.copy(at(-1, 0.4, 0.8))
  fill.target = target
  return [target, hemi, key, rim, fill]
}
