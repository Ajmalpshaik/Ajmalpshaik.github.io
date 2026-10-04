import { Rotate3d } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SceneName } from '../three/scenes'

type Model3DProps = {
  scene: SceneName
  /** The still picture: rendered from the same model, at the same angle. */
  poster: string
  alt: string
  width: number
  height: number
  /** 'drag' turns the model by hand; 'follow' leans it toward the mouse. */
  mode: 'drag' | 'follow'
  /** Fetch the model once the page has loaded, rather than when scrolled near. */
  eager?: boolean
  className?: string
  posterClassName?: string
  /** For the hero: the poster is the largest thing on the first screen. */
  priority?: boolean
}

// The models need WebGL 2 on a GPU that can draw them smoothly. People who ask
// for less motion or less data keep the still picture, as with every other
// moving thing on the page. Asked once, for all the models on the page.
let capable: boolean | undefined
function can3D() {
  if (capable !== undefined) return capable
  capable = false
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return capable
    const net = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (net?.saveData) return capable
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (!gl) return capable
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    capable = true
  } catch {
    capable = false
  }
  return capable
}

// A 3D model that turns, standing in for a picture. The picture is what the
// built page holds, so it shows at once and is what search engines, screen
// readers, print, and visitors without a capable GPU get. three.js and the
// model are fetched only when the model is about to be seen, and the picture
// fades out once the first frame is on screen.
export default function Model3D({
  scene,
  poster,
  alt,
  width,
  height,
  mode,
  eager = false,
  className = '',
  posterClassName = '',
  priority = false,
}: Model3DProps) {
  const stage = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const host = stage.current
    if (!host || !can3D()) return
    let done = false
    let handle: { dispose: () => void } | undefined
    let io: IntersectionObserver | undefined
    let idle = 0

    const start = async () => {
      io?.disconnect()
      try {
        const { mount } = await import('../three/viewer')
        if (done) return
        handle = await mount(host, {
          scene,
          mode,
          onReady: () => {
            if (done) return
            setLive(true)
            if (mode === 'drag') setHint(window.matchMedia('(pointer: coarse)').matches ? 'Swipe to turn' : 'Drag to turn')
          },
          onInteract: () => setHint(null),
          // The GPU dropped the model: back to the picture for good.
          onLost: () => {
            setLive(false)
            setHint(null)
            handle?.dispose()
            handle = undefined
          },
        })
        if (done) handle.dispose()
      } catch {
        // No model, then: the picture stays, which is a finished page too.
      }
    }

    if (eager) {
      const soon = () => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
        idle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 200)
      }
      if (document.readyState === 'complete') soon()
      else window.addEventListener('load', soon, { once: true })
      return () => {
        done = true
        window.removeEventListener('load', soon)
        const w = window as Window & { cancelIdleCallback?: (id: number) => void }
        if (w.cancelIdleCallback) w.cancelIdleCallback(idle)
        window.clearTimeout(idle)
        handle?.dispose()
      }
    }

    io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), {
      rootMargin: '600px 0px',
    })
    io.observe(host)
    return () => {
      done = true
      io?.disconnect()
      handle?.dispose()
    }
  }, [scene, mode, eager])

  return (
    <div className={`model3d ${className}`} data-live={live ? '' : undefined}>
      <img
        src={poster}
        alt={alt}
        width={width}
        height={height}
        {...(priority ? { fetchpriority: 'high' } : { loading: 'lazy' as const })}
        decoding="async"
        draggable={false}
        className={`model3d-poster select-none ${posterClassName}`}
      />
      <div ref={stage} className="model3d-stage absolute inset-0" aria-hidden="true" />
      {hint && (
        <span
          className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-[#D7E2EA]/25 bg-[#0C0C0C]/70 px-2 py-0.5 text-[0.6rem] font-light uppercase tracking-wider text-[#D7E2EA]/80 sm:bottom-6 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs sm:tracking-widest"
          aria-hidden="true"
        >
          <Rotate3d className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={1.5} />
          {hint}
        </span>
      )}
    </div>
  )
}
