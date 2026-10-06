import { useEffect, useRef, type ReactNode } from 'react'

type MagnetProps = {
  children: ReactNode
  /** How far outside its own edges (px) the element starts following the cursor. */
  padding?: number
  /** Higher is weaker: the offset is the cursor's distance from centre divided by this. */
  strength?: number
  activeTransition?: string
  inactiveTransition?: string
  className?: string
}

// Leans toward the mouse when it comes near, and settles back when it leaves.
// Writes the transform straight to the element, so a mouse move never
// re-renders React.
export default function Magnet({
  children,
  padding = 100,
  strength = 2,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.5s ease-in-out',
  className,
}: MagnetProps) {
  const zone = useRef<HTMLDivElement>(null)
  const mover = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const area = zone.current
    const el = mover.current
    if (!area || !el) return
    // Nothing to follow on a touch screen, and some people ask for less motion.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let active = false
    let frame = 0
    let mouseX = -1e6
    let mouseY = -1e6

    const apply = () => {
      frame = 0
      const r = area.getBoundingClientRect()
      const dx = mouseX - (r.left + r.width / 2)
      const dy = mouseY - (r.top + r.height / 2)
      if (Math.abs(dx) < r.width / 2 + padding && Math.abs(dy) < r.height / 2 + padding) {
        if (!active) {
          active = true
          el.style.transition = activeTransition
        }
        el.style.transform = `translate3d(${dx / strength}px, ${dy / strength}px, 0)`
      } else if (active) {
        active = false
        el.style.transition = inactiveTransition
        el.style.transform = 'translate3d(0, 0, 0)'
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      schedule()
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    // Scrolling moves the element under a still cursor, so check again.
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
    }
  }, [padding, strength, activeTransition, inactiveTransition])

  return (
    <div ref={zone} className={className} style={{ position: 'relative' }}>
      <div
        ref={mover}
        style={{ transform: 'translate3d(0, 0, 0)', transition: inactiveTransition, willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  )
}
