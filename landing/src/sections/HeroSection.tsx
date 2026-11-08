import type { CSSProperties } from 'react'
import ContactButton from '../components/ContactButton'
import { figures, hero } from '../content'

// The first screen comes in with a CSS animation (.enter in index.css), not
// with script like the rest of the page: it starts with the first paint, so a
// slow phone shows the name before the JavaScript has arrived. The name starts
// visible and only rises; the rest fades in.
const enter = (delay: number, y: number, opacity = 0) =>
  ({ '--enter-delay': `${delay}s`, '--enter-y': `${y}px`, '--enter-opacity': opacity }) as CSSProperties

export default function HeroSection() {
  return (
    // Top padding clears the fixed bar - 60px of it, plus a little air so the
    // name is not touching it. The 3D tower that stood in the middle of this
    // screen is gone: the name, one line and four figures say it faster.
    <section aria-label="Introduction" className="relative pt-[68px] md:pt-[82px]" style={{ overflowX: 'clip' }}>
      {/* Sized so "Hi, i'm Ajmal" fills the width: 74% on phones, 93% from
          1024px. The heading rises out of a clipping box. */}
      <div className="mt-6 overflow-hidden sm:mt-4 md:-mt-5">
        <h1
          className="enter hero-heading w-full whitespace-nowrap text-center font-black uppercase leading-none tracking-tight text-[12.1vw] sm:text-[13vw] md:text-[13.8vw] lg:text-[15.1vw]"
          style={enter(0.1, 40, 1)}
        >
          {hero.heading}
        </h1>
      </div>

      <div className="flex flex-col items-center gap-8 px-6 pb-16 pt-8 text-center sm:pb-20 md:gap-10 md:px-10 md:pb-24 md:pt-10">
        <p
          className="enter max-w-[640px] font-light leading-snug text-[#D7E2EA]"
          style={{ ...enter(0.3, 20), fontSize: 'clamp(1.05rem, 2.1vw, 1.6rem)' }}
        >
          {hero.tagline}
        </p>
        <div className="enter" style={enter(0.4, 20)}>
          <ContactButton />
        </div>
      </div>

      <dl
        className="enter mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 border-t border-[#D7E2EA]/15 px-6 py-12 md:grid-cols-4 md:px-10 md:py-16"
        style={enter(0.5, 20)}
      >
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col-reverse gap-2">
            <dt className="text-sm font-light uppercase tracking-widest text-[#D7E2EA]/70">{f.label}</dt>
            <dd className="hero-heading font-black leading-none" style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)' }}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
