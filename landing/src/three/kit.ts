// The parts the 3D models are made of: pipes with real elbows, rectangular
// ducts, trays, supports and valves.
//
// Everything is collected per material and merged into one mesh each when the
// model is finished, so a whole building draws in a dozen calls, not thousands.
// Every service is also recorded as a simple solid (pipes as capsules, ducts
// and equipment as boxes), so clashes() can prove the model is clash-free:
// these models stand for MEP coordination, and a clash in one would be noticed.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  Path,
  Shape,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three'

export const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const UP = V(0, 1, 0)

export type Axis = 'x' | 'y' | 'z'
type Solid =
  | { kind: 'cap'; a: Vector3; b: Vector3; r: number; run: string }
  | { kind: 'box'; min: Vector3; max: Vector3; run: string }

export type PipeOpts = {
  /** Name of the run for the clash check. Leave out for things that touch by design. */
  run?: string
  /** Centreline radius of each elbow. Default: a short-radius elbow, 1.0 x diameter. */
  bend?: number
  /** A coupling ring at both ends of every elbow. */
  joints?: boolean
  seg?: number
}

export type DuctOpts = {
  run?: string
  /** Material for the flanged joints along straight lengths, if any. */
  flange?: string
  step?: number
  /** For a straight riser: the size along x and along z. */
  riser?: [number, number]
}

const axisOf = (d: Vector3): Axis => (Math.abs(d.x) > 1e-6 ? 'x' : Math.abs(d.y) > 1e-6 ? 'y' : 'z')

// A basis matrix from three column vectors and a position.
function frame(x: Vector3, y: Vector3, z: Vector3, p: Vector3) {
  return new Matrix4().makeBasis(x, y, z).setPosition(p)
}

// Rotates +Y onto `dir` and moves to `p`.
function along(dir: Vector3, p: Vector3) {
  const d = dir.clone().normalize()
  const m = new Matrix4()
  const dot = UP.dot(d)
  if (dot > 0.999999) return m.makeTranslation(p.x, p.y, p.z)
  if (dot < -0.999999) return m.makeRotationX(Math.PI).setPosition(p)
  const axis = new Vector3().crossVectors(UP, d).normalize()
  return m.makeRotationAxis(axis, Math.acos(dot)).setPosition(p)
}

export class Kit {
  private parts = new Map<string, BufferGeometry[]>()
  private solids: Solid[] = []
  private joined = new Set<string>()

  /** Adds raw geometry under a material key. */
  put(mat: string, geo: BufferGeometry, m?: Matrix4) {
    if (m) geo.applyMatrix4(m)
    const list = this.parts.get(mat)
    if (list) list.push(geo)
    else this.parts.set(mat, [geo])
  }

  /** Records that two runs meet on purpose (a branch on its riser, a pipe in its unit). */
  join(a: string, b: string) {
    this.joined.add(a < b ? `${a}|${b}` : `${b}|${a}`)
  }

  solidBox(min: Vector3, max: Vector3, run: string) {
    this.solids.push({ kind: 'box', min: min.clone(), max: max.clone(), run })
  }

  box(mat: string, c: Vector3, sx: number, sy: number, sz: number, run?: string) {
    this.put(mat, new BoxGeometry(sx, sy, sz), new Matrix4().makeTranslation(c.x, c.y, c.z))
    if (run) this.solidBox(V(c.x - sx / 2, c.y - sy / 2, c.z - sz / 2), V(c.x + sx / 2, c.y + sy / 2, c.z + sz / 2), run)
  }

  /** A solid cylinder from a to b. */
  cyl(mat: string, a: Vector3, b: Vector3, r: number, seg = 20, run?: string) {
    const d = new Vector3().subVectors(b, a)
    const len = d.length()
    if (len < 1e-5) return
    const mid = a.clone().addScaledVector(d, 0.5)
    this.put(mat, new CylinderGeometry(r, r, len, seg, 1, false), along(d, mid))
    if (run) this.solids.push({ kind: 'cap', a: a.clone(), b: b.clone(), r, run })
  }

  /** A short ring around a pipe: a coupling, a clamp, a flange. */
  ring(mat: string, c: Vector3, dir: Vector3, r: number, len: number) {
    const d = dir.clone().normalize().multiplyScalar(len / 2)
    this.cyl(mat, c.clone().sub(d), c.clone().add(d), r, 20)
  }

  /**
   * A pipe along a polyline. Corners get a real elbow (a torus segment), and
   * the straight lengths are trimmed to meet it, the way fittings are built.
   */
  pipe(mat: string, pts: Vector3[], r: number, o: PipeOpts = {}) {
    const seg = o.seg ?? 20
    const R0 = o.bend ?? 2 * r
    let start = pts[0].clone()
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i]
      const d1 = new Vector3().subVectors(p, pts[i - 1]).normalize()
      const d2 = new Vector3().subVectors(pts[i + 1], p).normalize()
      const cos = Math.min(1, Math.max(-1, d1.dot(d2)))
      if (cos > 0.9999) continue
      const theta = Math.acos(cos)
      // Never let an elbow eat more than the straight length on either side;
      // a length between two elbows is shared by both.
      const room = Math.min(p.distanceTo(start), pts[i + 1].distanceTo(p) * (i + 1 === pts.length - 1 ? 1 : 0.5))
      const t = Math.min(R0 * Math.tan(theta / 2), room)
      const R = t / Math.tan(theta / 2)
      const s = p.clone().addScaledVector(d1, -t)
      const e = p.clone().addScaledVector(d2, t)
      this.cyl(mat, start, s, r, seg, o.run)
      const n = d2.clone().addScaledVector(d1, -cos).normalize()
      const c = s.clone().addScaledVector(n, R)
      const torus = new TorusGeometry(R, r, seg, Math.max(6, Math.round(theta * 8)), theta)
      this.put(mat, torus, frame(n.clone().negate(), d1, new Vector3().crossVectors(d1, n), c))
      if (o.run) this.solids.push({ kind: 'cap', a: s, b: e, r: r * 0.92, run: o.run })
      if (o.joints) {
        this.ring(mat, s, d1, r * 1.16, Math.max(0.03, r * 0.5))
        this.ring(mat, e, d2, r * 1.16, Math.max(0.03, r * 0.5))
      }
      start = e
    }
    this.cyl(mat, start, pts[pts.length - 1], r, seg, o.run)
  }

  /**
   * A rectangular duct along an axis-aligned polyline, with square elbows.
   * `w` is the width across the run and `h` the depth; on a vertical length
   * the depth lies along the horizontal run it turns from.
   */
  duct(mat: string, pts: Vector3[], w: number, h: number, o: DuctOpts = {}) {
    const segs = pts.slice(0, -1).map((a, i) => {
      const d = new Vector3().subVectors(pts[i + 1], a)
      return { a, d, axis: axisOf(d) }
    })
    const flatAxis = (i: number): Axis => {
      for (let k = 0; k < segs.length; k++) {
        for (const j of [i - k, i + k]) if (segs[j] && segs[j].axis !== 'y') return segs[j].axis
      }
      return 'x'
    }
    const size = (i: number): [number | null, number | null, number | null] => {
      const s = segs[i]
      if (s.axis === 'x') return [null, h, w]
      if (s.axis === 'z') return [w, h, null]
      if (o.riser) return [o.riser[0], null, o.riser[1]]
      return flatAxis(i) === 'x' ? [h, null, w] : [w, null, h]
    }
    const ext = (i: number, j: number) => {
      if (!segs[i] || !segs[j]) return 0
      return segs[i].axis === 'y' || segs[j].axis === 'y' ? h / 2 : w / 2
    }
    segs.forEach((s, i) => {
      const L0 = s.d.length()
      const dir = s.d.clone().normalize()
      const eA = ext(i - 1, i)
      const eB = ext(i, i + 1)
      const L = L0 + eA + eB
      const c = s.a.clone().addScaledVector(dir, (L0 + eB - eA) / 2)
      const sz = size(i).map((v) => (v === null ? L : v)) as [number, number, number]
      this.box(mat, c, sz[0], sz[1], sz[2], o.run)
      if (o.flange) {
        const step = o.step ?? 1.2
        const n = Math.floor((L0 - 0.3) / step)
        for (let k = 1; k <= n; k++) {
          const p = s.a.clone().addScaledVector(dir, (k * L0) / (n + 1))
          const f = size(i).map((v) => (v === null ? 0.035 : v + 0.05)) as [number, number, number]
          this.box(o.flange, p, f[0], f[1], f[2])
        }
      }
    })
  }

  /**
   * Cable tray: a ladder of two low side rails and rungs, along an axis-aligned
   * polyline with square corners. A vertical length is a riser tray, its rails
   * either side along x and its rungs at the back. `hh` is the rail height.
   */
  tray(mat: string, pts: Vector3[], w: number, hh: number, run?: string) {
    const t = 0.012
    const segs = pts.slice(0, -1).map((a, i) => {
      const d = new Vector3().subVectors(pts[i + 1], a)
      return { a, L: d.length(), dir: d.normalize() }
    })
    segs.forEach((s, i) => {
      const at = (u: number) => s.a.clone().addScaledVector(s.dir, u)
      const n = Math.max(1, Math.round(s.L / 0.3))
      if (Math.abs(s.dir.y) > 0.5) {
        const c = at(s.L / 2)
        for (const side of [-1, 1]) this.box(mat, c.clone().add(V((side * w) / 2, 0, 0)), t, s.L, hh)
        for (let k = 1; k < n; k++) this.box(mat, at((k * s.L) / n).add(V(0, 0, -hh / 2 + 0.01)), w, 0.028, 0.016)
        if (run) this.solidBox(V(c.x - w / 2, c.y - s.L / 2, c.z - hh / 2), V(c.x + w / 2, c.y + s.L / 2, c.z + hh / 2), run)
        return
      }
      const side = V(-s.dir.z, 0, s.dir.x)
      const prev = segs[i - 1]
      const next = segs[i + 1]
      const alongX = Math.abs(s.dir.x) > 0.5
      // at a corner the outer rail runs on to meet the next one, the inner stops short
      for (const k of [-1, 1]) {
        const u0 = prev ? k * (w / 2) * V(-prev.dir.z, 0, prev.dir.x).dot(s.dir) : 0
        const u1 = s.L + (next ? k * (w / 2) * V(-next.dir.z, 0, next.dir.x).dot(s.dir) : 0)
        const c = at((u0 + u1) / 2).addScaledVector(side, (k * w) / 2)
        this.box(mat, c, alongX ? u1 - u0 : t, hh, alongX ? t : u1 - u0)
      }
      for (let k = prev ? 0 : 1; k < n; k++) {
        const p = at((k * s.L) / n).add(V(0, -hh / 2 + 0.01, 0))
        this.box(mat, p, alongX ? 0.028 : w, 0.016, alongX ? w : 0.028)
      }
      if (run) {
        const a = at(prev ? -w / 2 : 0).addScaledVector(side, -w / 2)
        const b = at(s.L + (next ? w / 2 : 0)).addScaledVector(side, w / 2)
        this.solidBox(V(Math.min(a.x, b.x), a.y - hh / 2, Math.min(a.z, b.z)), V(Math.max(a.x, b.x), a.y + hh / 2, Math.max(a.z, b.z)), run)
      }
    })
  }

  /**
   * A trapeze hanger: two threaded rods from the soffit down to a strut channel
   * under the service. `bottom` is the underside of the service.
   */
  trapeze(rod: string, strut: string, x: number, z: number, along: 'x' | 'z', width: number, bottom: number, top: number) {
    const off = width / 2 + 0.05
    for (const s of [-1, 1]) {
      const p = along === 'x' ? V(x, 0, z + s * off) : V(x + s * off, 0, z)
      // rods are checked too: one through a pipe would be a clash like any other
      this.cyl(rod, V(p.x, top, p.z), V(p.x, bottom - 0.04, p.z), 0.008, 8, 'hanger')
    }
    const y = bottom - 0.021
    if (along === 'x') this.box(strut, V(x, y, z), 0.042, 0.042, width + 0.2)
    else this.box(strut, V(x, y, z), width + 0.2, 0.042, 0.042)
  }

  /**
   * A valve in a pipe: a body a little fatter than the pipe, a stem, and a
   * lever. The stem points up on a horizontal pipe, and along `stem` otherwise.
   */
  valve(body: string, lever: string, c: Vector3, dir: Vector3, r: number, stem?: Vector3) {
    const d = dir.clone().normalize()
    this.ring(body, c, d, r * 1.45, r * 2.6)
    const up = (stem ?? (Math.abs(d.y) > 0.9 ? V(1, 0, 0) : UP)).clone().normalize()
    const top = c.clone().addScaledVector(up, r * 2.1)
    this.cyl(body, c, top, r * 0.35, 12)
    const side = new Vector3().crossVectors(d, up).normalize()
    this.cyl(lever, top, top.clone().addScaledVector(side, r * 3.4), r * 0.22, 10)
  }

  /** A pendent sprinkler under the end of a drop, finished at the ceiling. */
  head(brass: string, plate: string, x: number, z: number, ceiling: number) {
    this.cyl(brass, V(x, ceiling + 0.06, z), V(x, ceiling - 0.03, z), 0.012, 10)
    this.cyl(brass, V(x, ceiling - 0.03, z), V(x, ceiling - 0.036, z), 0.032, 16)
    this.cyl(plate, V(x, ceiling, z), V(x, ceiling - 0.006, z), 0.045, 20)
  }

  /** A square ceiling diffuser with its neck coming down to it. */
  diffuser(face: string, x: number, z: number, ceiling: number) {
    this.box(face, V(x, ceiling - 0.008, z), 0.6, 0.016, 0.6)
    this.box(face, V(x, ceiling - 0.02, z), 0.36, 0.012, 0.36)
    this.box(face, V(x, ceiling - 0.028, z), 0.14, 0.008, 0.14)
  }

  /**
   * A floor slab: an outline in plan with holes, `t` thick, its top at `top`.
   * Bevelled a little so the edges catch light like a real cast edge.
   */
  slab(mat: string, outline: [number, number][], holes: [number, number][][], top: number, t: number) {
    const shape = new Shape(outline.map(([x, z]) => new Vector2(x, -z)))
    shape.holes = holes.map((h) => new Path(h.map(([x, z]) => new Vector2(x, -z))))
    const bevel = 0.02
    const geo = new ExtrudeGeometry(shape, {
      depth: t - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
    })
    // The shape is drawn in x/-z; lay it flat with its top at `top`.
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, top - t + bevel, 0)
    this.put(mat, geo)
  }

  /** The run names of every pair of services that intersect and should not. */
  clashes(tol = 0.003): string[] {
    const out: string[] = []
    const s = this.solids
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const a = s[i]
        const b = s[j]
        if (a.run === b.run) continue
        if (this.joined.has(a.run < b.run ? `${a.run}|${b.run}` : `${b.run}|${a.run}`)) continue
        const gap = distance(a, b)
        if (gap < -tol) out.push(`${a.run} x ${b.run} (${Math.round(-gap * 1000)} mm)`)
      }
    }
    return [...new Set(out)]
  }

  /** Merges every part into one mesh per material. */
  build(materials: Record<string, Material>, shadows = false): Group {
    const g = new Group()
    for (const [key, list] of this.parts) {
      const mat = materials[key]
      if (!mat) throw new Error(`no material "${key}"`)
      const mesh = new Mesh(merge(list), mat)
      mesh.name = key
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      g.add(mesh)
    }
    return g
  }

  keys() {
    return [...this.parts.keys()]
  }
}

// Position and normal only: nothing here is textured.
function merge(list: BufferGeometry[]): BufferGeometry {
  let verts = 0
  let idx = 0
  for (const g of list) {
    verts += g.attributes.position.count
    idx += g.index ? g.index.count : g.attributes.position.count
  }
  const pos = new Float32Array(verts * 3)
  const nor = new Float32Array(verts * 3)
  const index = new Uint32Array(idx)
  let v = 0
  let k = 0
  for (const g of list) {
    const p = g.attributes.position.array as ArrayLike<number>
    const n = g.attributes.normal.array as ArrayLike<number>
    const count = g.attributes.position.count
    pos.set(p, v * 3)
    nor.set(n, v * 3)
    if (g.index) {
      const src = g.index.array
      for (let i = 0; i < src.length; i++) index[k++] = src[i] + v
    } else {
      for (let i = 0; i < count; i++) index[k++] = v + i
    }
    v += count
    g.dispose()
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(pos, 3))
  out.setAttribute('normal', new BufferAttribute(nor, 3))
  out.setIndex(new BufferAttribute(index, 1))
  out.computeBoundingSphere()
  out.computeBoundingBox()
  return out
}

// ---- the clash check: signed gap between two solids (negative = overlap) ----

function segSeg(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3) {
  const d1 = new Vector3().subVectors(q1, p1)
  const d2 = new Vector3().subVectors(q2, p2)
  const r = new Vector3().subVectors(p1, p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  let s = 0
  let t = 0
  if (a <= 1e-9 && e <= 1e-9) return p1.distanceTo(p2)
  if (a <= 1e-9) t = Math.min(1, Math.max(0, f / e))
  else {
    const c = d1.dot(r)
    if (e <= 1e-9) s = Math.min(1, Math.max(0, -c / a))
    else {
      const b = d1.dot(d2)
      const den = a * e - b * b
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = Math.min(1, Math.max(0, -c / a))
      } else if (t > 1) {
        t = 1
        s = Math.min(1, Math.max(0, (b - c) / a))
      }
    }
  }
  const c1 = p1.clone().addScaledVector(d1, s)
  const c2 = p2.clone().addScaledVector(d2, t)
  return c1.distanceTo(c2)
}

function pointBox(p: Vector3, min: Vector3, max: Vector3) {
  const dx = Math.max(min.x - p.x, 0, p.x - max.x)
  const dy = Math.max(min.y - p.y, 0, p.y - max.y)
  const dz = Math.max(min.z - p.z, 0, p.z - max.z)
  const out = Math.hypot(dx, dy, dz)
  if (out > 0) return out
  // inside: negative depth to the nearest face
  return -Math.min(p.x - min.x, max.x - p.x, p.y - min.y, max.y - p.y, p.z - min.z, max.z - p.z)
}

function distance(a: Solid, b: Solid): number {
  if (a.kind === 'cap' && b.kind === 'cap') return segSeg(a.a, a.b, b.a, b.b) - a.r - b.r
  if (a.kind === 'box' && b.kind === 'box') {
    const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x)
    const oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y)
    const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z)
    return -Math.min(ox, oy, oz)
  }
  const cap = (a.kind === 'cap' ? a : b) as Extract<Solid, { kind: 'cap' }>
  const bx = (a.kind === 'box' ? a : b) as Extract<Solid, { kind: 'box' }>
  const n = Math.max(2, Math.ceil(cap.a.distanceTo(cap.b) / 0.01))
  let best = Infinity
  const p = new Vector3()
  for (let i = 0; i <= n; i++) {
    p.lerpVectors(cap.a, cap.b, i / n)
    best = Math.min(best, pointBox(p, bx.min, bx.max))
  }
  return best - cap.r
}
