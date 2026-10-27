import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { startAnalytics } from './analytics'
import SiteNav from './components/SiteNav'
import AboutSection from './sections/AboutSection'
import Footer from './sections/Footer'
import HeroSection from './sections/HeroSection'
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

        {/* The same bar every other page carries - see components/SiteNav.tsx.
            The four anchors it replaces pointed only at this page's own
            sections, so the cover was the one page on the site with no way to
            reach the rest of it except by scrolling to the footer. */}
        <SiteNav />

        <main id="main" tabIndex={-1} className="outline-none">
          <HeroSection />
          <AboutSection />
          <ServicesSection />
          <ProjectsSection />
        </main>

        <Footer />
      </div>
    </MotionConfig>
  )
}
