// The four models on the home page, and how each one is framed.

import { Box3, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Material, type Sprite } from 'three'
import { building, FH } from './building'
import { corridor } from './corridor'
import { V, type Kit } from './kit'
import { label } from './labels'
import { clayMaterials, xrayMaterials } from './look'

export type SceneName = 'tower' | 'riser' | 'void' | 'xray'

export type View = {
  target: Vector3
  /** Around the vertical axis; 0 puts the camera on +z looking back at the target. */
  yaw: number
  /** Above the horizon. */
  pitch: number
  pitchRange: [number, number]
  fov: number
  /** Width over height the framing is made for; the poster is rendered at it. */
  aspect: number
  /** A fixed distance. Without one the camera stands back far enough for any yaw. */
  distance?: number
  /** Turntable speed, radians a second. */
  spin: number
}

export type Built = {
  root: Group
  view: View
  shadows: boolean
  /** Model bounds, for framing and for the shadow camera. */
  box: Box3
  tick?: (t: number) => void
  clashes: string[]
}

const corners = (): [number, number][] => [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]
const cardCols = (): [number, number][] => [[-4.2, -2.4], [4.2, -2.4], [-4.2, 2.4], [4.2, 2.4]]

function finish(kit: Kit, materials: Record<string, Material>, shadows: boolean, extra: (Sprite | Mesh)[] = []) {
  const root = kit.build(materials, shadows)
  const box = new Box3().setFromObject(root)
  for (const e of extra) root.add(e)
  return { root, box, clashes: kit.clashes() }
}

export function buildScene(name: SceneName): Built {
  if (name === 'tower') {
    const { kit } = building({ floors: 7, plate: [-4.8, 4.8, -4.8, 4.8], columns: corners(), roof: true, detail: 'low' })
    const f = finish(kit, clayMaterials(), true)
    return {
      ...f,
      shadows: true,
      view: { target: V(0, 21.5, 0), yaw: 0.72, pitch: 0.14, pitchRange: [0.04, 0.26], fov: 34, aspect: 0.8, distance: 38, spin: 0.07 },
    }
  }

  if (name === 'riser') {
    const { kit } = building({ floors: 3, plate: [-4.8, 4.8, -3.0, 3.0], columns: cardCols(), roof: false, detail: 'high' })
    const f = finish(kit, clayMaterials(), true)
    return {
      ...f,
      shadows: true,
      view: { target: f.box.getCenter(new Vector3()), yaw: 0.62, pitch: 0.2, pitchRange: [0.04, 0.6], fov: 32, aspect: 1, spin: 0.11 },
    }
  }

  if (name === 'void') {
    const { kit, labels } = corridor()
    const f = finish(kit, clayMaterials(), true, labels)
    const c = f.box.getCenter(new Vector3())
    return {
      ...f,
      shadows: true,
      view: { target: V(c.x, c.y + 0.3, c.z), yaw: 0.9, pitch: 0.46, pitchRange: [0.18, 0.85], fov: 30, aspect: 1.4, spin: 0.1 },
    }
  }

  // xray: two floors seen through, one fan coil unit's water and air lit up
  const level = 1
  const { kit, path } = building({ floors: 2, plate: [-4.8, 4.8, -3.0, 3.0], columns: cardCols(), roof: false, detail: 'high', trace: level })
  const y = level * FH
  const bubble = label('Which unit feeds this?', V(4.0, y + 2.45, 0.8), 0.46, { bg: 'rgba(245,247,250,0.96)', color: '#0c0c0c', size: 28, anchor: [0.5, 1] })
  const answer = label('FCU-02', V(2.9, y + 3.55, -0.3), 0.4, { bg: '#24c6dc', color: '#04181c', size: 28, anchor: [0.5, 0] })
  const sparks = pulses(path)
  const f = finish(kit, xrayMaterials(['glow', 'spark']), false, [bubble, answer, ...sparks.meshes])
  return {
    ...f,
    shadows: false,
    tick: sparks.tick,
    view: { target: f.box.getCenter(new Vector3()), yaw: 0.62, pitch: 0.36, pitchRange: [0.08, 0.7], fov: 32, aspect: 1, spin: 0.11 },
  }
}

// Bright beads running along the traced path, the way Heron walks a system.
function pulses(path: Vector3[]) {
  const lengths = path.slice(1).map((p, i) => p.distanceTo(path[i]))
  const total = lengths.reduce((a, b) => a + b, 0)
  const at = (d: number, out: Vector3) => {
    let s = ((d % total) + total) % total
    for (let i = 0; i < lengths.length; i++) {
      if (s <= lengths[i]) return out.lerpVectors(path[i], path[i + 1], lengths[i] ? s / lengths[i] : 0)
      s -= lengths[i]
    }
    return out.copy(path[path.length - 1])
  }
  const geo = new SphereGeometry(0.075, 16, 12)
  const mat = new MeshBasicMaterial({ color: 0xffffff })
  const meshes: Mesh[] = []
  const n = 5
  for (let i = 0; i < n; i++) {
    const m = new Mesh(geo, mat)
    m.name = 'spark'
    meshes.push(m)
  }
  const tick = (t: number) => {
    meshes.forEach((m, i) => at(t * 2.2 + (i * total) / n, m.position))
  }
  tick(0)
  return { meshes, tick }
}
