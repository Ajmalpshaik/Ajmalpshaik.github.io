// A corridor ceiling void, coordinated and then annotated the way AJ-Tools
// does it: every service tagged with a right-angle leader, a chained
// dimension across the section, and flow arrows along the ducts.
//
// Section across the corridor (z), heights above floor level (y):
//
//   soffit 3.90 ─────────────────────────────────────────────
//               SPK Ø100 3.80
//                     CHWS Ø150 3.62   CHWR Ø150 3.62
//   SA 1000x450 (2.975-3.425)                  RA 800x400 (3.10-3.50)
//                                              CT 450x100 (2.90-3.00)
//   ceiling 2.80 ────────────────────────────────────────────

import { ShapeGeometry, Shape, Matrix4, type Sprite } from 'three'
import { Kit, V } from './kit'
import { label } from './labels'
import { SYSTEM } from './look'

const L = 6.0
const SOFFIT = 3.9
const CEIL = 2.8

const SA = { z: -0.95, y: 3.2, w: 1.0, h: 0.45 }
const RA = { z: 1.0, y: 3.3, w: 0.8, h: 0.4 }
const CHWS = { z: -0.05, y: 3.62, r: 0.084 }
const CHWR = { z: 0.3, y: 3.62, r: 0.084 }
const SPK = { z: -0.6, y: 3.8, r: 0.057 }
const CT = { z: 1.0, y: 2.95, w: 0.45, h: 0.1 }

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

export function corridor() {
  const k = new Kit()
  const labels: Sprite[] = []

  // ceiling line: faint tiles on a 600 mm grid
  k.box('tile', V(L / 2, CEIL - 0.004, 0), L, 0.008, 4.8)
  for (let z = -2.4; z <= 2.401; z += 0.6) k.box('grid', V(L / 2, CEIL + 0.01, z), L, 0.02, 0.016)
  for (let x = 0; x <= L + 0.001; x += 0.6) k.box('grid', V(x, CEIL + 0.01, 0), 0.016, 0.02, 4.8)

  // ducts, flanged every 1.2 m
  k.duct('sa', [V(0, SA.y, SA.z), V(L, SA.y, SA.z)], SA.w, SA.h, { run: 'SA', flange: 'galv' })
  k.duct('ra', [V(0, RA.y, RA.z), V(L, RA.y, RA.z)], RA.w, RA.h, { run: 'RA', flange: 'galv' })
  // a branch off the supply duct to a diffuser
  k.duct('sa', [V(2.0, SA.y, SA.z - SA.w / 2), V(2.0, SA.y, -2.1), V(2.0, CEIL, -2.1)], 0.4, 0.25, { run: 'SA' })
  k.diffuser('face', 2.0, -2.1, CEIL)

  // chilled water flow and return
  k.pipe('chws', [V(0, CHWS.y, CHWS.z), V(L, CHWS.y, CHWS.z)], CHWS.r, { run: 'CHWS' })
  k.pipe('chwr', [V(0, CHWR.y, CHWR.z), V(L, CHWR.y, CHWR.z)], CHWR.r, { run: 'CHWR' })
  for (const x of [0.75, 3.75]) {
    k.ring('chws', V(x, CHWS.y, CHWS.z), V(1, 0, 0), CHWS.r * 1.16, 0.06)
    k.ring('chwr', V(x + 0.3, CHWR.y, CHWR.z), V(1, 0, 0), CHWR.r * 1.16, 0.06)
  }

  // sprinkler main with branch lines both ways, dropping to pendent heads
  const branches = [0.9, 3.0, 5.1]
  k.pipe('spk', [V(0, SPK.y, SPK.z), V(L, SPK.y, SPK.z)], SPK.r, { run: 'SPK' })
  for (const x of branches) {
    for (const z of [-1.65, 1.65]) {
      k.pipe('spk', [V(x, SPK.y, SPK.z), V(x, SPK.y, z), V(x, CEIL + 0.06, z)], 0.021, { run: 'SPK' })
      k.head('brass', 'face', x, z, CEIL)
    }
  }

  // cable tray, carried on a lower tier of the return duct's trapezes
  k.tray('tray', [V(0, CT.y, CT.z), V(L, CT.y, CT.z)], CT.w, CT.h, 'CT')

  // supports, set out clear of the sprinkler branches and the duct branch
  for (const x of [0.4, 2.55, 4.2, 5.7]) {
    k.trapeze('steel', 'steel', x, SA.z, 'x', SA.w, SA.y - SA.h / 2, SOFFIT)
    // two tiers: return duct above, cable tray below, on one pair of rods
    const off = RA.w / 2 + 0.05
    for (const s of [-1, 1]) {
      k.cyl('steel', V(x, SOFFIT, RA.z + s * off), V(x, CT.y - CT.h / 2 - 0.045, RA.z + s * off), 0.008, 8, 'hanger')
    }
    k.box('steel', V(x, RA.y - RA.h / 2 - 0.021, RA.z), 0.042, 0.042, RA.w + 0.2)
    k.box('steel', V(x, CT.y - CT.h / 2 - 0.021, RA.z), 0.042, 0.042, RA.w + 0.2)
  }
  for (const x of [1.5, 3.9]) {
    k.trapeze('steel', 'steel', x, (CHWS.z + CHWR.z) / 2, 'x', CHWR.z - CHWS.z + 0.17, CHWS.y - CHWS.r, SOFFIT)
  }
  for (const x of [2.0, 4.4]) k.trapeze('steel', 'steel', x, SPK.z, 'x', 0.12, SPK.y - SPK.r, SOFFIT)

  // flow arrows along the duct tops: supply away, return back
  for (const x of [1.4, 3.6, 5.3]) arrow(k, V(x, SA.y + SA.h / 2 + 0.004, SA.z), 1)
  for (const x of [1.0, 3.2, 5.4]) arrow(k, V(x, RA.y + RA.h / 2 + 0.004, RA.z), -1)

  // tags, each with a right-angle leader: up from the service, then along
  const tag = (text: string, color: number, at: [number, number, number], rise: number) => {
    const [x, y, z] = at
    k.cyl('leader', V(x, y, z), V(x, rise, z), 0.006, 6)
    k.cyl('leader', V(x, rise, z), V(x + 0.3, rise, z), 0.006, 6)
    k.cyl('leader', V(x, y, z), V(x, y + 0.001, z), 0.02, 10)
    labels.push(label(text, V(x + 0.3, rise, z), 0.3, { bg: 'rgba(12,12,12,0.9)', border: hex(color), size: 26, anchor: [0, 0.5] }))
  }
  tag('SA 1000x450', SYSTEM.sa, [0.45, SA.y + SA.h / 2, SA.z], 4.3)
  tag('SPK Ø100', SYSTEM.spk, [1.55, SPK.y + SPK.r, SPK.z], 4.3)
  tag('CHWS Ø150', SYSTEM.chws, [2.45, CHWS.y + CHWS.r, CHWS.z], 4.3)
  tag('CHWR Ø150', SYSTEM.chwr, [3.45, CHWR.y + CHWR.r, CHWR.z], 4.3)
  tag('RA 800x400', SYSTEM.ra, [4.5, RA.y + RA.h / 2, RA.z], 4.3)
  // the tray sits under the return duct, so its leader leaves sideways
  {
    const x = 4.9
    const z = CT.z + CT.w / 2
    k.cyl('leader', V(x, CT.y, z), V(x, CT.y, 1.95), 0.006, 6)
    k.cyl('leader', V(x, CT.y, 1.95), V(x + 0.3, CT.y, 1.95), 0.006, 6)
    labels.push(label('CT 450x100', V(x + 0.3, CT.y, 1.95), 0.3, { bg: 'rgba(12,12,12,0.9)', border: hex(SYSTEM.tray), size: 26, anchor: [0, 0.5] }))
  }

  // a chained dimension across the section, between centrelines, in mm
  const dx = -0.25
  const dy = 2.55
  const stops = [
    { z: SA.z, from: SA.y - SA.h / 2 },
    { z: CHWS.z, from: CHWS.y - CHWS.r },
    { z: CHWR.z, from: CHWR.y - CHWR.r },
    { z: RA.z, from: CT.y - CT.h / 2 },
  ]
  k.cyl('dim', V(dx, dy, stops[0].z - 0.15), V(dx, dy, stops[stops.length - 1].z + 0.15), 0.005, 6)
  for (const s of stops) {
    // witness line from the service down, and an oblique tick on the line
    k.cyl('dim', V(dx, s.from - 0.04, s.z), V(dx, dy - 0.06, s.z), 0.004, 6)
    k.cyl('dim', V(dx, dy - 0.05, s.z - 0.05), V(dx, dy + 0.05, s.z + 0.05), 0.008, 6)
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const mm = Math.round((stops[i + 1].z - stops[i].z) * 1000)
    labels.push(label(String(mm), V(dx, dy + 0.05, (stops[i].z + stops[i + 1].z) / 2), 0.22, { color: '#ffffff', size: 24, pad: 4, anchor: [0.5, 0] }))
  }

  // the services stop at the ends of the section box; nothing to join
  return { kit: k, labels }
}

// A flat arrow lying on a duct top, pointing along +x (dir 1) or -x (dir -1).
function arrow(k: Kit, at: ReturnType<typeof V>, dir: 1 | -1) {
  const s = new Shape()
  s.moveTo(-0.28, -0.05)
  s.lineTo(0.08, -0.05)
  s.lineTo(0.08, -0.13)
  s.lineTo(0.28, 0)
  s.lineTo(0.08, 0.13)
  s.lineTo(0.08, 0.05)
  s.lineTo(-0.28, 0.05)
  s.closePath()
  const g = new ShapeGeometry(s)
  const m = new Matrix4().makeRotationX(-Math.PI / 2)
  if (dir < 0) m.premultiply(new Matrix4().makeRotationY(Math.PI))
  m.setPosition(at)
  k.put('arrow', g, m)
}
