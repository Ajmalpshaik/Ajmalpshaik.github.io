import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { startAnalytics } from './analytics'
import FadeIn from './components/FadeIn'
import { nav } from './content'
import AboutSection from './sections/AboutSection'
import Footer from './sections/Footer'
import HeroSection from './sections/HeroSection'
import MarqueeSection from './sections/MarqueeSection'
import ProjectsSection from './sections/ProjectsSection'
import ServicesSection from './sections/ServicesSection'

export default function App() {
  useEffect(() => {
    // Tells the failsafe in index.html that the page came alive.
    document.documentElement.setAttribute('data-ready', '')
    startAnalytics()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#0C0C0C]" style={{ overflowX: 'clip' }}>
        <a href="#main" className="skip">
          Skip to content
        </a>

        <header className="absolute inset-x-0 top-0 z-30">
          <FadeIn
            as="nav"
            y={-20}
            aria-label="Main"
            className="flex items-center justify-between px-6 pt-6 md:px-10 md:pt-8"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium uppercase leading-5 tracking-wider text-[#D7E2EA] transition-opacity duration-200 hover:opacity-70 md:text-lg md:leading-7 lg:text-[1.4rem]"
              >
                {item.label}
              </a>
            ))}
          </FadeIn>
        </header>

        <main id="main" tabIndex={-1} className="outline-none">
          <HeroSection />
          <MarqueeSection />
          <AboutSection />
          <ServicesSection />
          <ProjectsSection />
        </main>

        <Footer />
      </div>
    </MotionConfig>
  )
}
