import { useEffect, useRef } from 'react'
import { marqueeRows } from '../content'

// Two rows of work that slide in opposite directions as the page scrolls.
// Each row is the set three times over and centred, so it overhangs both
// edges by far more than the scroll ever moves it.
export default function MarqueeSection() {
  const section = useRef<HTMLElement>(null)
  const rowRight = useRef<HTMLDivElement>(null)
  const rowLeft = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0

    const update = () => {
      frame = 0
      const el = section.current
      if (!el || !rowRight.current || !rowLeft.current) return
      const sectionTop = el.getBoundingClientRect().top + window.scrollY
      const offset = (window.scrollY - sectionTop + window.innerHeight) * 0.3
      rowRight.current.style.transform = `translate3d(${offset - 200}px, 0, 0)`
      rowLeft.current.style.transform = `translate3d(${-(offset - 200)}px, 0, 0)`
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section ref={section} aria-hidden="true" className="marquee overflow-hidden bg-[#0C0C0C] pb-10 pt-24 sm:pt-32 md:pt-40">
      <div className="flex flex-col gap-3">
        {marqueeRows.map((row, r) => (
          <div key={r} className="flex justify-center">
            <div
              ref={r === 0 ? rowRight : rowLeft}
              className="flex shrink-0 gap-3"
              style={{ transform: `translate3d(${r === 0 ? -200 : 200}px, 0, 0)`, willChange: 'transform' }}
            >
              {[...row, ...row, ...row].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={420}
                  height={270}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-[193px] w-[300px] shrink-0 rounded-2xl object-cover sm:h-[270px] sm:w-[420px]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
