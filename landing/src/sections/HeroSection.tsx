import type { CSSProperties } from 'react'
import ContactButton from '../components/ContactButton'
import Magnet from '../components/Magnet'
import Model3D from '../components/Model3D'
import { hero } from '../content'

// The first screen comes in with a CSS animation (.enter in index.css), not
// with script like the rest of the page: it starts with the first paint, so a
// slow phone shows the name and the model before the JavaScript has arrived.
// The name and the model start visible and only rise; the rest fades in.
const enter = (delay: number, y: number, opacity = 0) =>
  ({ '--enter-delay': `${delay}s`, '--enter-y': `${y}px`, '--enter-opacity': opacity }) as CSSProperties

export default function HeroSection() {
  return (
    // Top padding is the height of the nav, which sits over this section from
    // the page <header>: 24px + 20px line below md, 32px + 28px line from md.
    <section
      aria-label="Introduction"
      className="hero-screen relative flex flex-col pt-11 md:pt-[60px]"
      style={{ overflowX: 'clip' }}
    >
      {/* Sized so "Hi, i'm Ajmal" fills the width in the same proportion the
          original four-letter name did: 74% on phones, 93% from 1024px.

          The heading rises out of a clipping box. */}
      <div className="mt-6 overflow-hidden sm:mt-4 md:-mt-5">
        <h1
          className="enter hero-heading w-full whitespace-nowrap text-center font-black uppercase leading-none tracking-tight text-[12.1vw] sm:text-[13vw] md:text-[13.8vw] lg:text-[15.1vw]"
          style={enter(0.1, 40, 1)}
        >
          {hero.heading}
        </h1>
      </div>

      <div className="relative z-20 mt-auto flex items-end justify-between gap-4 px-6 pb-7 sm:pb-8 md:px-10 md:pb-10">
        <p
          className="enter max-w-[160px] font-light uppercase leading-snug tracking-wide text-[#D7E2EA] sm:max-w-[220px] md:max-w-[260px]"
          style={{ ...enter(0.35, 20), fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
        >
          {hero.tagline}
        </p>
        <div className="enter" style={enter(0.45, 20)}>
          <ContactButton />
        </div>
      </div>

      <div className="hero-portrait absolute left-1/2 top-1/2 z-10 w-[280px] -translate-x-1/2 -translate-y-1/2 sm:bottom-0 sm:top-auto sm:w-[360px] sm:translate-y-0 md:w-[440px] lg:w-[520px]">
        <div className="enter" style={enter(0.25, 30, 1)}>
          <Magnet
            padding={150}
            strength={3}
            activeTransition="transform 0.3s ease-out"
            inactiveTransition="transform 0.6s ease-in-out"
          >
            {/* The still is the largest thing on the first screen; the model
                takes its place once the page has loaded. */}
            <Model3D
              scene={hero.model.scene}
              poster={hero.model.poster}
              alt={hero.model.alt}
              width={hero.model.width}
              height={hero.model.height}
              mode="follow"
              eager
              priority
              className="hero-model"
              posterClassName="block h-auto w-full"
            />
          </Magnet>
        </div>
      </div>
    </section>
  )
}
