import { motion } from 'framer-motion'
import ContactButton from '../components/ContactButton'
import FadeIn from '../components/FadeIn'
import Magnet from '../components/Magnet'
import Model3D from '../components/Model3D'
import { hero } from '../content'

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

          The heading rises out of a clipping box. The box, not the heading,
          decides when it is in view: on a narrow phone the heading starts
          40px down, wholly inside the clipped area, and would never count as
          visible - so it would never appear. */}
      <motion.div
        className="mt-6 overflow-hidden sm:mt-4 md:-mt-5"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: '50px', amount: 0 }}
      >
        <motion.h1
          className="fade-in hero-heading w-full whitespace-nowrap text-center font-black uppercase leading-none tracking-tight text-[12.1vw] sm:text-[13vw] md:text-[13.8vw] lg:text-[15.1vw]"
          variants={{
            hidden: { opacity: 0, y: 40 },
            shown: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
          }}
        >
          {hero.heading}
        </motion.h1>
      </motion.div>

      <div className="relative z-20 mt-auto flex items-end justify-between gap-4 px-6 pb-7 sm:pb-8 md:px-10 md:pb-10">
        <FadeIn
          as="p"
          delay={0.35}
          y={20}
          className="max-w-[160px] font-light uppercase leading-snug tracking-wide text-[#D7E2EA] sm:max-w-[220px] md:max-w-[260px]"
          style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
        >
          {hero.tagline}
        </FadeIn>
        <FadeIn delay={0.5} y={20}>
          <ContactButton />
        </FadeIn>
      </div>

      <div className="hero-portrait absolute left-1/2 top-1/2 z-10 w-[280px] -translate-x-1/2 -translate-y-1/2 sm:bottom-0 sm:top-auto sm:w-[360px] sm:translate-y-0 md:w-[440px] lg:w-[520px]">
        <FadeIn delay={0.6} y={30}>
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
        </FadeIn>
      </div>
    </section>
  )
}
