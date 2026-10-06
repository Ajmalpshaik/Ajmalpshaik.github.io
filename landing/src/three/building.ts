// A building core and its MEP risers, with the services each floor takes off
// them. One generator makes three models: the tower in the hero, the closer
// cut of three floors on project 01, and the x-ray on project 03.
//
// Everything is laid out to real sizes in metres and is clash-free: risers
// sit in an open shaft, and on every floor the branches leave it at their
// own levels in the ceiling void, between the 2.8 m ceiling and the slab.
//
//   shaft, plan (x right, z down):
//
//      CHWS    CHWR   FIRE
//       o       o      o
//                                    ┌──────┐
//      SPK     DCW    SOIL           │  FA  │  fresh air duct riser
//       o       o      o             └──────┘
//                         ═══ power, a riser cable tray
//
//   East of the shaft each floor has a fan coil unit fed with fresh air and
//   chilled water, supplying two diffusers; west of it, the sprinkler zone;
//   south of it, the power tray and the soil and water for the toilets above.

import { TorusGeometry, Matrix4, Vector3 } from 'three'
import { Kit, V } from './kit'

export const FH = 4.2 // floor to floor
const T = 0.3 // slab
const CEIL = 2.8 // ceiling line above floor level
const SOFFIT = FH - T

export type BuildingOpts = {
  floors: number
  /** Plan extent of the slabs: [x0, x1, z0, z1]. */
  plate: [number, number, number, number]
  columns: [number, number][]
  /** A roof with plant on it, or a section-box cut above the top slab. */
  roof: boolean
  detail: 'low' | 'high'
  /** Light up one floor's chilled water and air path, for the x-ray. */
  trace?: number
}

const SHAFT: [number, number, number, number] = [-1.6, 1.6, -1.0, 1.0]
const RISERS = {
  chws: { x: -1.2, z: -0.6, r: 0.084 },
  chwr: { x: -0.85, z: -0.6, r: 0.084 },
  fire: { x: -0.5, z: -0.6, r: 0.084 },
  spk: { x: -1.2, z: 0.5, r: 0.057 },
  dcw: { x: -0.85, z: 0.5, r: 0.038 },
  soil: { x: -0.45, z: 0.5, r: 0.057 },
}
const FA = { x: 0.95, z: 0.35, sx: 0.9, sz: 0.5 }
const TRAY = { x: 0, z: 0.8, w: 0.3, d: 0.1 }

export function building(o: BuildingOpts) {
  const k = new Kit()
  const hi = o.detail === 'high'
  const [x0, x1, z0, z1] = o.plate
  const top = o.floors * FH
  const bottom = -T - 0.6
  const cut = top + 0.45
  const traced = (level: number, key: string) => (o.trace === level ? 'glow' : key)
  const path: Vector3[] = []

  // ---- structure ----------------------------------------------------------
  for (let i = 0; i <= o.floors; i++) {
    const y = i * FH
    const solid = i === o.floors && o.roof
    const outline: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    const shaft: [number, number][] = [[SHAFT[0], SHAFT[2]], [SHAFT[0], SHAFT[3]], [SHAFT[1], SHAFT[3]], [SHAFT[1], SHAFT[2]]]
    k.slab('slab', outline, solid ? [] : [shaft], y, T)
    // the slab as four solids around the shaft, for the clash check
    const lo = y - T
    // the roof is penetrated on purpose: risers come up through it in sleeves
    if (solid) k.solidBox(V(x0, lo, z0), V(x1, y, z1), 'roof')
    else {
      k.solidBox(V(x0, lo, z0), V(SHAFT[0], y, z1), 'slab')
      k.solidBox(V(SHAFT[1], lo, z0), V(x1, y, z1), 'slab')
      k.solidBox(V(SHAFT[0], lo, z0), V(SHAFT[1], y, SHAFT[2]), 'slab')
      k.solidBox(V(SHAFT[0], lo, SHAFT[3]), V(SHAFT[1], y, z1), 'slab')
    }
    if (i < o.floors) {
      for (const [cx, cz] of o.columns) k.box('column', V(cx, y + SOFFIT / 2, cz), 0.42, SOFFIT, 0.42, 'column')
    }
  }

  // hanger rods are anchored into the slab above them
  k.join('hanger', 'slab')

  // ---- risers -------------------------------------------------------------
  const riserTop = o.roof ? top - T : cut
  for (const [key, p] of Object.entries(RISERS)) {
    let yTop = riserTop
    // the sprinkler riser stops at the top floor's main
    if (key === 'spk' && o.roof) yTop = (o.floors - 1) * FH + 3.8
    const mat = (key === 'chws' || key === 'chwr') && o.trace !== undefined ? 'glow' : key
    k.pipe(mat, [V(p.x, bottom, p.z), V(p.x, yTop, p.z)], p.r, { run: key })
    for (let i = 0; i <= o.floors; i++) {
      if (i * FH > yTop) break
      if (hi) k.ring('steel', V(p.x, i * FH + 0.03, p.z), V(0, 1, 0), p.r * 1.45, 0.05)
      // a coupling halfway up each storey
      if (i * FH + 2 < yTop) k.ring(mat, V(p.x, i * FH + 2, p.z), V(0, 1, 0), p.r * 1.16, 0.06)
    }
  }
  k.duct('fa', [V(FA.x, bottom, FA.z), V(FA.x, riserTop, FA.z)], 0, 0, { run: 'FA', riser: [FA.sx, FA.sz], flange: hi ? 'galv' : undefined, step: FH / 2 })
  k.tray('tray', [V(TRAY.x, bottom, TRAY.z), V(TRAY.x, riserTop, TRAY.z)], TRAY.w, TRAY.d, 'CT')

  if (o.trace !== undefined) {
    const p = RISERS.chws
    path.push(V(p.x, bottom, p.z), V(p.x, o.trace * FH + 3.7, p.z))
  }

  // ---- every floor ----------------------------------------------------------
  for (let i = 0; i < o.floors; i++) {
    const y = i * FH
    const L = `L${i}`
    const t = (key: string) => traced(i, key)

    // fan coil unit, east of the shaft
    k.box(t('equip'), V(2.9, y + 3.125, -0.3), 1.2, 0.35, 0.6, `${L}/FCU`)

    // fresh air, off the riser, down into the top of the unit
    const fa = [V(1.4, y + 3.55, 0.35), V(2.5, y + 3.55, 0.35), V(2.5, y + 3.55, -0.3), V(2.5, y + 3.3, -0.3)]
    k.duct('fa', fa, 0.3, 0.25, { run: `${L}/FA`, flange: hi ? 'galv' : undefined })
    k.join(`${L}/FA`, 'FA')
    k.join(`${L}/FA`, `${L}/FCU`)
    if (hi) {
      // fire damper where the branch leaves the shaft, with its actuator
      k.box('galv', V(1.78, y + 3.55, 0.35), 0.26, 0.31, 0.36)
      k.box('dark', V(1.78, y + 3.55, 0.6), 0.14, 0.12, 0.1)
    }

    // supply air from the unit to two diffusers
    const sa = t('sa')
    k.duct(sa, [V(3.5, y + 3.125, -0.3), V(4.0, y + 3.125, -0.3), V(4.0, y + 3.125, -1.4), V(4.0, y + CEIL, -1.4)], 0.5, 0.2, { run: `${L}/SA`, flange: hi ? 'galv' : undefined })
    k.duct(sa, [V(4.0, y + 3.125, -0.3), V(4.0, y + 3.125, 0.8), V(4.0, y + CEIL, 0.8)], 0.5, 0.2, { run: `${L}/SA` })
    k.join(`${L}/SA`, `${L}/FCU`)
    k.diffuser('face', 4.0, -1.4, y + CEIL)
    k.diffuser(o.trace === i ? 'glow' : 'face', 4.0, 0.8, y + CEIL)

    // chilled water flow and return, each with an isolating valve
    const chws = [V(-1.2, y + 3.7, -0.6), V(-1.2, y + 3.7, -0.95), V(2.7, y + 3.7, -0.95), V(2.7, y + 3.12, -0.95), V(2.7, y + 3.12, -0.6)]
    const chwr = [V(-0.85, y + 3.48, -0.6), V(-0.85, y + 3.48, -1.25), V(3.0, y + 3.48, -1.25), V(3.0, y + 3.12, -1.25), V(3.0, y + 3.12, -0.6)]
    k.pipe(t('chws'), chws, 0.03, { run: `${L}/CHWS`, joints: hi })
    k.pipe(t('chwr'), chwr, 0.03, { run: `${L}/CHWR`, joints: hi })
    for (const s of ['CHWS', 'CHWR']) {
      k.join(`${L}/${s}`, s.toLowerCase())
      k.join(`${L}/${s}`, `${L}/FCU`)
    }
    if (hi) {
      k.valve('valve', 'lever', V(1.95, y + 3.7, -0.95), V(1, 0, 0), 0.03)
      k.valve('valve', 'lever', V(2.15, y + 3.48, -1.25), V(1, 0, 0), 0.03)
      k.ring('chws', V(-1.2, y + 3.7, -0.6), V(0, 1, 0), 0.1, 0.12)
      k.ring('chwr', V(-0.85, y + 3.48, -0.6), V(0, 1, 0), 0.1, 0.12)
    }
    if (o.trace === i) path.push(...chws.slice(1), V(2.9, y + 3.125, -0.3), V(4.0, y + 3.125, -0.3), V(4.0, y + 3.125, 0.8), V(4.0, y + CEIL, 0.8))

    // sprinkler zone: control valve, main, two branch lines, four heads
    const yS = y + 3.8
    k.pipe('spk', [V(-1.2, yS, 0.5), V(-3.6, yS, 0.5)], 0.057, { run: `${L}/SPK` })
    k.join(`${L}/SPK`, 'spk')
    k.valve('valve', 'wheel', V(-2.0, yS, 0.5), V(1, 0, 0), 0.057, V(0, 0, 1))
    for (const x of [-2.4, -3.6]) {
      for (const z of [2.0, -1.8]) {
        k.pipe('spk', [V(x, yS, 0.5), V(x, yS, z), V(x, y + CEIL + 0.06, z)], 0.021, { run: `${L}/SPK` })
        k.head('brass', 'face', x, z, y + CEIL)
      }
    }

    // power: a tray off the riser, south and then east over the ceiling
    const yT = y + 3.0
    const zT = z1 - 0.6
    k.tray('tray', [V(TRAY.x, yT, TRAY.z + TRAY.d / 2), V(TRAY.x, yT, zT), V(3.2, yT, zT)], TRAY.w, 0.08, `${L}/CT`)
    k.join(`${L}/CT`, 'CT')

    // soil and cold water up to the toilets on the floor above, through the
    // slab in sleeves; the soil branch falls back to its stack
    const wc = !(o.roof && i === o.floors - 1)
    const zW = 2.1
    if (wc) {
      k.pipe('soil', [V(-0.45, y + 3.35, 0.5), V(-0.45, y + 3.4, zW), V(-0.45, y + FH, zW)], 0.05, { run: `${L}/SOIL`, joints: hi })
      k.pipe('dcw', [V(-0.85, y + 3.6, 0.5), V(-0.85, y + 3.6, zW + 0.4), V(-0.85, y + FH, zW + 0.4)], 0.025, { run: `${L}/DCW`, joints: hi })
      for (const s of ['SOIL', 'DCW']) {
        k.join(`${L}/${s}`, s.toLowerCase())
        k.join(`${L}/${s}`, 'slab')
      }
      if (hi) k.valve('valve', 'lever', V(-0.85, y + 3.6, 1.35), V(0, 0, 1), 0.025)
    }

    // wet riser landing valve, a metre above each floor
    const lv = V(-0.5, y + 1.0, -0.6)
    k.pipe('fire', [lv, V(-0.5, y + 1.0, -0.88)], 0.04)
    k.ring('valve', V(-0.5, y + 1.0, -0.82), V(0, 0, 1), 0.06, 0.1)
    wheel(k, 'wheel', V(-0.5, y + 1.1, -0.82), 0.07)
    k.ring('fire', V(-0.5, y + 1.0, -0.9), V(0, 0, 1), 0.055, 0.04)

    if (hi) {
      // supports, outside the shaft where there is a slab to hang from
      k.trapeze('steel', 'steel', 1.75, -0.95, 'x', 0.06, y + 3.7 - 0.03, y + SOFFIT)
      k.trapeze('steel', 'steel', 1.75, -1.25, 'x', 0.06, y + 3.48 - 0.03, y + SOFFIT)
      k.trapeze('steel', 'steel', -2.8, 0.5, 'x', 0.12, yS - 0.057, y + SOFFIT)
      k.trapeze('steel', 'steel', 2.1, 0.35, 'x', 0.3, y + 3.55 - 0.125, y + SOFFIT)
      k.trapeze('steel', 'steel', 4.0, -0.9, 'z', 0.5, y + 3.125 - 0.1, y + SOFFIT)
      k.trapeze('steel', 'steel', TRAY.x, 1.7, 'z', TRAY.w, yT - 0.04, y + SOFFIT)
      k.trapeze('steel', 'steel', 1.8, zT, 'x', TRAY.w, yT - 0.04, y + SOFFIT)
      if (wc) {
        k.trapeze('steel', 'steel', -0.45, 1.5, 'z', 0.1, y + 3.35 + (0.05 * 1.0) / (zW - 0.5) - 0.05, y + SOFFIT)
        k.trapeze('steel', 'steel', -0.85, 1.75, 'z', 0.05, y + 3.6 - 0.025, y + SOFFIT)
      }
    }
  }

  // ---- roof ---------------------------------------------------------------
  if (o.roof) {
    roof(k, o, top)
    for (const r of [...Object.keys(RISERS), 'FA', 'CT', 'R/CHWS', 'R/CHWR', 'R/FIRE', 'R/DCW', 'R/SOIL']) k.join(r, 'roof')
  }

  return { kit: k, path }
}

// A handwheel lying flat, its axis vertical.
function wheel(k: Kit, mat: string, c: Vector3, R: number) {
  const g = new TorusGeometry(R, R * 0.14, 8, 24)
  k.put(mat, g, new Matrix4().makeRotationX(Math.PI / 2).setPosition(c))
  k.cyl(mat, c.clone().add(V(-R, 0, 0)), c.clone().add(V(R, 0, 0)), R * 0.1, 6)
  k.cyl(mat, c.clone().add(V(0, 0, -R)), c.clone().add(V(0, 0, R)), R * 0.1, 6)
}

function roof(k: Kit, o: BuildingOpts, y: number) {
  const [x0, x1, z0, z1] = o.plate
  const ph = 0.7
  const pt = 0.15
  // parapet
  k.box('slab', V((x0 + x1) / 2, y + ph / 2, z0 + pt / 2), x1 - x0, ph, pt)
  k.box('slab', V((x0 + x1) / 2, y + ph / 2, z1 - pt / 2), x1 - x0, ph, pt)
  k.box('slab', V(x0 + pt / 2, y + ph / 2, (z0 + z1) / 2), pt, ph, z1 - z0 - pt * 2)
  k.box('slab', V(x1 - pt / 2, y + ph / 2, (z0 + z1) / 2), pt, ph, z1 - z0 - pt * 2)

  // fresh air handling unit, over the duct riser, with its intake louvre
  k.box('plinth', V(1.6, y + 0.075, 0.4), 3.4, 0.15, 1.8, 'R/FAHU')
  k.box('equip', V(1.6, y + 0.95, 0.4), 3.2, 1.6, 1.6, 'R/FAHU')
  k.box('dark', V(3.215, y + 0.95, 0.4), 0.03, 1.1, 1.2)
  for (const x of [0.8, 1.6, 2.4]) k.box('dark', V(x, y + 0.95, -0.405), 0.025, 1.5, 0.012)

  // air-cooled chiller with two fans on top
  k.box('plinth', V(-3.3, y + 0.075, -2.7), 2.8, 0.15, 2.2, 'R/CH')
  k.box('equip', V(-3.3, y + 1.05, -2.7), 2.6, 1.8, 2.0, 'R/CH')
  for (const z of [-3.705, -1.695]) k.box('dark', V(-3.3, y + 0.95, z), 2.3, 1.3, 0.012)
  for (const x of [-3.95, -2.65]) {
    k.cyl('dark', V(x, y + 1.95, -2.7), V(x, y + 2.05, -2.7), 0.52, 32)
    k.put('steel', new TorusGeometry(0.52, 0.02, 6, 40), new Matrix4().makeRotationX(Math.PI / 2).setPosition(V(x, y + 2.06, -2.7)))
    k.cyl('steel', V(x, y + 2.0, -2.7), V(x, y + 2.09, -2.7), 0.08, 16)
  }

  // chilled water up to the chiller, on pipe stands
  const chws = [V(-1.2, y, -0.6), V(-1.2, y + 0.9, -0.6), V(-1.2, y + 0.9, -2.3), V(-2.0, y + 0.9, -2.3)]
  const chwr = [V(-0.85, y, -0.6), V(-0.85, y + 0.6, -0.6), V(-0.85, y + 0.6, -2.9), V(-2.0, y + 0.6, -2.9)]
  k.pipe('chws', chws, 0.084, { run: 'R/CHWS', joints: true })
  k.pipe('chwr', chwr, 0.084, { run: 'R/CHWR', joints: true })
  for (const s of ['CHWS', 'CHWR']) {
    k.join(`R/${s}`, 'R/CH')
    k.join(`R/${s}`, s.toLowerCase())
  }
  for (const [x, z, top] of [[-1.2, -1.5, 0.9], [-1.65, -2.3, 0.9], [-0.85, -1.9, 0.6], [-1.5, -2.9, 0.6]] as const) {
    k.cyl('steel', V(x, y, z), V(x, y + top - 0.084, z), 0.03, 8)
    k.box('steel', V(x, y + top - 0.084 - 0.01, z), 0.2, 0.02, 0.2)
  }

  // wet riser up to a roof test outlet
  k.pipe('fire', [V(-0.5, y, -0.6), V(-0.5, y + 1.0, -0.6)], 0.084, { run: 'R/FIRE' })
  k.join('R/FIRE', 'fire')
  k.ring('valve', V(-0.5, y + 1.0, -0.6), V(0, 1, 0), 0.12, 0.12)
  wheel(k, 'wheel', V(-0.5, y + 1.1, -0.6), 0.09)

  // domestic water from the roof tank
  k.box('plinth', V(3.0, y + 0.075, 2.7), 2.6, 0.15, 2.2, 'R/TANK')
  k.box('equip', V(3.0, y + 0.9, 2.7), 2.4, 1.5, 2.0, 'R/TANK')
  for (const yy of [0.6, 1.2]) k.box('dark', V(3.0, y + yy, 1.695), 2.3, 0.012, 0.012)
  k.pipe('dcw', [V(-0.85, y, 0.5), V(-0.85, y + 0.4, 0.5), V(-0.85, y + 0.4, 2.4), V(1.8, y + 0.4, 2.4)], 0.038, { run: 'R/DCW', joints: true })
  k.join('R/DCW', 'R/TANK')
  k.join('R/DCW', 'dcw')

  // the soil stack carries on through the roof as its vent
  k.pipe('soil', [V(-0.45, y, 0.5), V(-0.45, y + 1.1, 0.5)], 0.057, { run: 'R/SOIL' })
  k.join('R/SOIL', 'soil')
  k.cyl('soil', V(-0.45, y + 1.1, 0.5), V(-0.45, y + 1.2, 0.5), 0.085, 20)
}
