import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import FadeIn from '../components/FadeIn'
import LiveProjectButton from '../components/LiveProjectButton'
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
  const [first, second, tall] = project.images
  // Image heights and the number follow the viewport height as well as its
  // width, so a stuck card still fits on a short laptop screen.

  return (
    <div className="sticky top-24 h-[85vh] md:top-32">
      <motion.article
        style={{ scale: still ? 1 : scale, top: `${index * 28}px` }}
        className="project-card relative origin-top rounded-[40px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:rounded-[50px] sm:p-6 md:rounded-[60px] md:p-8"
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

        <div className="flex gap-3 sm:gap-4">
          <div className="flex w-[40%] flex-col gap-3 sm:gap-4">
            <img
              src={first.src}
              alt={first.alt}
              width={960}
              height={540}
              loading="lazy"
              decoding="async"
              className="w-full rounded-[40px] object-cover sm:rounded-[50px] md:rounded-[60px]"
              style={{ height: 'clamp(130px, min(16vw, 20vh), 230px)' }}
            />
            <img
              src={second.src}
              alt={second.alt}
              width={960}
              height={720}
              loading="lazy"
              decoding="async"
              className="w-full rounded-[40px] object-cover sm:rounded-[50px] md:rounded-[60px]"
              style={{ height: 'clamp(160px, min(22vw, 30vh), 340px)' }}
            />
          </div>
          {/* Absolutely placed so the tall image takes the height of the left
              column instead of setting it from its own proportions. */}
          <div className="relative w-[60%]">
            <img
              src={tall.src}
              alt={tall.alt}
              width={1200}
              height={1200}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full rounded-[40px] object-cover sm:rounded-[50px] md:rounded-[60px]"
            />
          </div>
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
