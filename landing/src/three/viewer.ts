// Puts one model on screen and keeps it turning.
//
// This module, and three.js with it, is only fetched when a model is about to
// be shown (see Model3D.tsx), so it never weighs on the first paint.
//
// The poster that shows until the model is ready is rendered by this same code
// (renderPoster), at the same angle and framing, so the swap is invisible.

import {
  ACESFilmicToneMapping,
  Material,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Sprite,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { lights } from './look'
import { buildScene, type Built, type SceneName } from './scenes'

export type Mode = 'drag' | 'follow'
export type Handle = { dispose: () => void }

type Options = {
  scene: SceneName
  mode: Mode
  onReady?: () => void
  onLost?: () => void
  onInteract?: () => void
}

const UP = new Vector3(0, 1, 0)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Labels are drawn in Kanit, so wait for it, or they come out in a fallback.
async function fonts() {
  try {
    await Promise.all([document.fonts.load('500 30px Kanit'), document.fonts.load('300 30px Kanit')])
  } catch {
    /* a fallback face is fine */
  }
}

// How far back the camera stands so the model fits its frame at every yaw and
// across the pitch range. Every point of the model (its vertices, merged to a
// 10 cm grid) and every corner of every label must land inside the view.
function fitDistance(built: Built) {
  const v = built.view
  const tanY = Math.tan(((v.fov / 2) * Math.PI) / 180) * 0.94
  const tanX = tanY * v.aspect
  const grid = new Map<string, Vector3>()
  const labels: Sprite[] = []
  const p = new Vector3()
  built.root.updateMatrixWorld(true)
  built.root.traverse((o) => {
    if (o instanceof Sprite) labels.push(o)
    else if (o instanceof Mesh) {
      const pos = o.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
        const key = `${Math.round(p.x * 10)},${Math.round(p.y * 10)},${Math.round(p.z * 10)}`
        if (!grid.has(key)) grid.set(key, p.clone())
      }
    }
  })
  const pts = [...grid.values()].map((c) => c.sub(v.target))
  const pitches = [v.pitchRange[0], v.pitch, v.pitchRange[1]]
  const rel = new Vector3()
  let d = 0
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
    for (const pitch of pitches) {
      const u = new Vector3(Math.sin(a) * Math.cos(pitch), Math.sin(pitch), Math.cos(a) * Math.cos(pitch))
      const r = new Vector3().crossVectors(u.clone().negate(), UP).normalize()
      const up = new Vector3().crossVectors(r, u.clone().negate())
      const fit = (c: Vector3) => {
        const z = c.dot(u)
        d = Math.max(d, z + Math.abs(c.dot(r)) / tanX, z + Math.abs(c.dot(up)) / tanY)
      }
      for (const c of pts) fit(c)
      for (const s of labels) {
        for (const cx of [-s.center.x, 1 - s.center.x]) {
          for (const cy of [-s.center.y, 1 - s.center.y]) {
            fit(rel.copy(s.position).sub(v.target).addScaledVector(r, cx * s.scale.x).addScaledVector(up, cy * s.scale.y))
          }
        }
      }
    }
  }
  return d
}

/** Everything both the live view and the poster need: scene, lights, camera. */
function stage(renderer: WebGLRenderer, built: Built) {
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = built.shadows
  renderer.shadowMap.type = PCFShadowMap
  // The model holds still and the camera walks round it, so the light never
  // moves relative to the model and the shadows are worked out just once.
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = env
  scene.environmentIntensity = 0.85
  scene.add(built.root)
  const center = built.box.getCenter(new Vector3())
  const size = built.box.getSize(new Vector3())
  const extent = Math.max(size.x, size.y, size.z) * 0.62
  for (const l of lights(center, extent)) scene.add(l)

  const v = built.view
  const distance = v.distance ?? fitDistance(built)
  const cam = new PerspectiveCamera(v.fov, v.aspect, 0.1, distance * 4)

  /** Frames the camera for a canvas of this shape, the way the poster is framed. */
  const shape = (aspect: number) => {
    cam.aspect = aspect
    // Narrower than designed: widen the vertical view so the sides still fit.
    cam.fov =
      aspect >= v.aspect ? v.fov : (2 * Math.atan(Math.tan((v.fov * Math.PI) / 360) * (v.aspect / aspect)) * 180) / Math.PI
    cam.updateProjectionMatrix()
  }
  const place = (yaw: number, pitch: number) => {
    const c = Math.cos(pitch)
    cam.position.set(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c).multiplyScalar(distance).add(v.target)
    cam.lookAt(v.target)
  }
  shape(v.aspect)
  place(v.yaw, v.pitch)

  const dispose = () => {
    scene.traverse((o) => {
      if (o instanceof Mesh || o instanceof Sprite) {
        o.geometry.dispose()
        const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          const map = (m as Material & { map?: { dispose: () => void } }).map
          map?.dispose()
          m.dispose()
        }
      }
    })
    env.dispose()
  }
  return { scene, cam, shape, place, dispose }
}

export async function mount(host: HTMLElement, o: Options): Promise<Handle> {
  if (o.scene === 'void' || o.scene === 'xray') await fonts()
  const built = buildScene(o.scene)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    touchAction: o.mode === 'drag' ? 'pan-y' : 'auto',
    cursor: o.mode === 'drag' ? 'grab' : '',
  })
  host.appendChild(canvas)

  const st = stage(renderer, built)
  const v = built.view

  // ---- size ----
  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    st.shape(w / h)
  }
  resize()
  // Shaders compile off the main thread where the browser can, before the
  // first frame asks for them, so the page does not stall while it scrolls.
  // (Asking for the extension where it is missing only logs a warning.)
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(st.scene, st.cam)

  // ---- motion state ----
  let yaw = v.yaw
  let pitch = v.pitch
  let spin = 1 // how much of the turntable is applied, eased back in after a drag
  let vel = 0 // yaw speed left over from a flick
  let dragging = false
  let quietSince = 0
  let followX = 0
  let followY = 0
  let leanX = 0
  let leanY = 0
  let t = 0

  // ---- input ----
  let lastX = 0
  let lastY = 0
  let lastT = 0
  let touch = false
  const listeners: [EventTarget, string, EventListener][] = []
  const on = (el: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn, opts)
    listeners.push([el, type, fn])
  }

  if (o.mode === 'drag') {
    on(canvas, 'pointerdown', ((e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      touch = e.pointerType !== 'mouse'
      lastX = e.clientX
      lastY = e.clientY
      lastT = performance.now()
      vel = 0
      spin = 0
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
      o.onInteract?.()
    }) as EventListener)
    on(canvas, 'pointermove', ((e: PointerEvent) => {
      if (!dragging) return
      const k = (Math.PI * 1.2) / Math.max(200, canvas.clientWidth)
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      const now = performance.now()
      const dt = Math.max(1, now - lastT) / 1000
      yaw -= dx * k
      // On a touch screen only the sideways part turns the model; the page
      // keeps the up-and-down part for scrolling.
      if (!touch) pitch = clamp(pitch + dy * k * 0.6, v.pitchRange[0], v.pitchRange[1])
      vel = vel * 0.6 + ((-dx * k) / dt) * 0.4
      lastX = e.clientX
      lastY = e.clientY
      lastT = now
      wake()
    }) as EventListener)
    const end = ((e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      quietSince = performance.now()
      if (performance.now() - lastT > 80) vel = 0
      canvas.style.cursor = 'grab'
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }) as EventListener
    on(canvas, 'pointerup', end)
    on(canvas, 'pointercancel', end)
  } else {
    // follow: turn a little toward the mouse, wherever it is on the page
    on(window, 'pointermove', ((e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = host.getBoundingClientRect()
      followX = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1)
      followY = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1)
    }) as EventListener, { passive: true })
    on(document, 'mouseleave', (() => {
      followX = 0
      followY = 0
    }) as EventListener)
  }

  // ---- loop: only while on screen and the tab is showing ----
  let raf = 0
  let prev = 0
  let onScreen = false
  // The project cards stack as the page scrolls, so a model can be on screen
  // and still covered by the next card. Looked at twice a second, in the
  // middle of the part of it inside the window; covered, it is not drawn.
  let covered = false
  let lookedAt = 0
  const isCovered = () => {
    const r = host.getBoundingClientRect()
    const x0 = Math.max(r.left, 0)
    const x1 = Math.min(r.right, window.innerWidth)
    const y0 = Math.max(r.top, 0)
    const y1 = Math.min(r.bottom, window.innerHeight)
    if (x1 <= x0 || y1 <= y0) return false
    const el = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2)
    return !!el && !host.contains(el)
  }
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    if (now - lookedAt > 500) {
      lookedAt = now
      covered = isCovered()
    }
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0
    prev = now
    if (covered && !dragging) return
    t += dt
    if (o.mode === 'drag') {
      if (!dragging) {
        yaw += vel * dt
        vel *= Math.exp(-dt * 3)
        if (now - quietSince > 2500) spin = Math.min(1, spin + dt * 0.5)
      }
      yaw += v.spin * spin * dt
      st.place(yaw, pitch)
    } else {
      yaw += v.spin * dt
      leanX += (followX - leanX) * Math.min(1, dt * 3)
      leanY += (followY - leanY) * Math.min(1, dt * 3)
      st.place(yaw - leanX * 0.5, clamp(pitch - leanY * 0.14, v.pitchRange[0], v.pitchRange[1]))
    }
    built.tick?.(t)
    renderer.render(st.scene, st.cam)
  }
  const run = () => {
    if (raf || !onScreen || document.hidden) return
    prev = 0
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
  }
  function wake() {
    if (!raf && onScreen) run()
  }

  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting)
    if (onScreen) run()
    else stop()
  })
  io.observe(host)
  const ro = new ResizeObserver(() => {
    resize()
    if (!raf) renderer.render(st.scene, st.cam)
  })
  ro.observe(host)
  on(document, 'visibilitychange', (() => (document.hidden ? stop() : run())) as EventListener)

  let alive = true
  let lost = false
  on(canvas, 'webglcontextlost', ((e: Event) => {
    e.preventDefault()
    lost = true
    stop()
    if (alive) o.onLost?.()
  }) as EventListener)

  // First frame now; tell the page once it is actually on screen.
  renderer.render(st.scene, st.cam)
  requestAnimationFrame(() => requestAnimationFrame(() => alive && !lost && o.onReady?.()))

  return {
    dispose() {
      alive = false
      stop()
      io.disconnect()
      ro.disconnect()
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn)
      st.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}

/**
 * The poster for a model: its first frame, rendered at twice the size and
 * scaled down, on a transparent background. Used by scripts/posters.mjs.
 */
export async function renderPoster(
  name: SceneName,
  width: number,
  turn?: { yaw: number; pitch: number },
): Promise<{ data: string; height: number; clashes: string[] }> {
  await fonts()
  const built = buildScene(name)
  const height = Math.round(width / built.view.aspect)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(width * 2, height * 2, false)
  const st = stage(renderer, built)
  // another angle, only for looking the model over while working on it
  if (turn) st.place(built.view.yaw + turn.yaw, built.view.pitch + turn.pitch)
  built.tick?.(0)
  renderer.render(st.scene, st.cam)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(renderer.domElement, 0, 0, width, height)
  const data = out.toDataURL('image/webp', 0.9)
  st.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  return { data, height, clashes: built.clashes }
}
