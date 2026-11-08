import FadeIn from '../components/FadeIn'
import LiveProjectButton from '../components/LiveProjectButton'
import { projects } from '../content'

// One row per thing to look at, the same shape as the services above. The
// stacked cards with a 3D render on each went with the second simplification:
// they were a screen each, for a name and a link.
export default function ProjectsSection() {
  return (
    <section
      id="projects"
      className="relative z-10 -mt-10 rounded-t-[40px] bg-[#0C0C0C] px-5 pb-16 pt-20 sm:-mt-12 sm:rounded-t-[50px] sm:px-8 sm:pb-20 sm:pt-24 md:-mt-14 md:rounded-t-[60px] md:px-10 md:pb-24 md:pt-32"
    >
      <FadeIn
        as="h2"
        y={40}
        className="hero-heading mb-16 text-center font-black uppercase leading-none tracking-tight sm:mb-20 md:mb-24"
        style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
      >
        Projects
      </FadeIn>

      <div className="mx-auto max-w-5xl">
        {projects.map((project, i) => (
          <FadeIn
            key={project.num}
            delay={i * 0.08}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5 py-8 sm:py-10"
            style={i > 0 ? { borderTop: '1px solid rgba(215, 226, 234, 0.15)' } : undefined}
          >
            <div className="flex min-w-0 items-center gap-5 sm:gap-8 md:gap-12">
              <span
                className="hero-heading w-[1.3em] shrink-0 font-black leading-none"
                style={{ fontSize: 'clamp(3rem, 8vw, 110px)' }}
                aria-hidden="true"
              >
                {project.num}
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-[0.7rem] font-light uppercase tracking-widest text-[#D7E2EA]/60 sm:text-xs md:text-sm">
                  {project.category}
                </p>
                <h3 className="font-medium uppercase leading-tight text-[#D7E2EA]" style={{ fontSize: 'clamp(1.1rem, 2.4vw, 2.2rem)' }}>
                  {project.name}
                </h3>
              </div>
            </div>
            <LiveProjectButton href={project.href} label="View" context={project.name} />
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
