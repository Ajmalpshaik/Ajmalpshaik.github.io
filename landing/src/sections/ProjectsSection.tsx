import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import FadeIn from '../components/FadeIn'
import LiveProjectButton from '../components/LiveProjectButton'
import ModelShot from '../components/ModelShot'
import { projects, type Project } from '../content'

type CardProps = {
  project: Project
  index: number
  total: number
  progress: MotionValue<number>
  still: boolean
}

function ProjectCard({ project, index, total, progress, still }: CardProps) {
  // Earlier cards shrink a little more, so the stack reads as a stack.
  const targetScale = 1 - (total - 1 - index) * 0.03
  const scale = useTransform(progress, [index / total, 1], [1, targetScale])
  // Image heights and the number follow the viewport height as well as its
  // width, so a stuck card still fits on a short laptop screen.

  return (
    <div className="sticky top-24 h-[85vh] md:top-32">
      <motion.article
        style={{ scale: still ? 1 : scale, top: `${index * 28}px` }}
        className="project-card relative flex h-full origin-top flex-col rounded-[40px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:rounded-[50px] sm:p-6 md:rounded-[60px] md:p-8"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-2 sm:mb-6 sm:px-3 md:mb-8">
          <div className="flex min-w-0 items-end gap-4 sm:gap-6 md:gap-8">
            <span
              className="hero-heading shrink-0 font-black leading-none"
              style={{ fontSize: 'clamp(3rem, min(10vw, 13vh), 140px)' }}
              aria-hidden="true"
            >
              {project.num}
            </span>
            <div className="min-w-0 pb-1 sm:pb-2 md:pb-3">
              <p className="mb-1 text-[0.7rem] font-light uppercase tracking-widest text-[#D7E2EA]/60 sm:text-xs md:text-sm">
                {project.category}
              </p>
              <h3 className="font-medium uppercase leading-tight text-[#D7E2EA]" style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}>
                {project.name}
              </h3>
            </div>
          </div>
          <LiveProjectButton href={project.href} label="View Project" context={project.name} />
        </div>

        {/* The render fills the card now. It used to share the width with two
            illustrations, which were the only drawn thing on the page.
            The panel takes whatever height the card has left, so a stuck card
            is full rather than two thirds full on a tall screen. */}
        <div
          className={`model-panel model-${project.model.scene} flex min-h-[180px] flex-1 items-center justify-center overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px]`}
        >
          <ModelShot
            src={project.model.poster}
            alt={project.model.alt}
            width={project.model.width}
            height={project.model.height}
            className="h-full w-full object-contain p-3 sm:p-5 md:p-7"
          />
        </div>
      </motion.article>
    </div>
  )
}

export default function ProjectsSection() {
  const list = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: list, offset: ['start start', 'end end'] })
  const reduceMotion = useReducedMotion()

  return (
    <section
      id="projects"
      className="relative z-10 -mt-10 rounded-t-[40px] bg-[#0C0C0C] px-5 pb-16 pt-20 sm:-mt-12 sm:rounded-t-[50px] sm:px-8 sm:pb-20 sm:pt-24 md:-mt-14 md:rounded-t-[60px] md:px-10 md:pb-24 md:pt-32"
    >
      <FadeIn
        as="h2"
        y={40}
        className="hero-heading mb-16 text-center font-black uppercase leading-none tracking-tight sm:mb-20 md:mb-28"
        style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
      >
        Projects
      </FadeIn>

      <div ref={list} className="mx-auto max-w-7xl">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.num}
            project={project}
            index={i}
            total={projects.length}
            progress={scrollYProgress}
            still={!!reduceMotion}
          />
        ))}
      </div>
    </section>
  )
}
