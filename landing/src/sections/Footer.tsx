import { ArrowUpRight, Github, Linkedin, Mail, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import ContactButton from '../components/ContactButton'
import FadeIn from '../components/FadeIn'
import { footer } from '../content'

const icons = { LinkedIn: Linkedin, GitHub: Github, WhatsApp: MessageCircle } as const

export default function Footer() {
  const [year, setYear] = useState(footer.year)
  useEffect(() => setYear(new Date().getFullYear()), [])

  return (
    <footer className="bg-[#0F0F10] px-5 pb-10 pt-20 sm:px-8 sm:pt-28 md:px-10 md:pt-32">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 text-center sm:gap-12">
        <FadeIn
          as="h2"
          y={40}
          className="hero-heading font-extrabold leading-none tracking-[-0.04em]"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          {footer.heading}
        </FadeIn>
        <FadeIn
          as="p"
          delay={0.1}
          className="max-w-[560px] font-light leading-relaxed text-[#F7F5F2]"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        >
          {footer.text}
        </FadeIn>
        <FadeIn delay={0.2} className="flex flex-col items-center gap-8">
          <ContactButton />
          <a
            href={`mailto:${footer.email}`}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-light tracking-wide text-[#F7F5F2] transition-opacity duration-200 hover:opacity-70 sm:text-base"
          >
            <Mail aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
            {footer.email}
          </a>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {footer.links.map((link) => {
              const Icon = icons[link.label as keyof typeof icons]
              return (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-full border border-[#F7F5F2]/25 px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-[#F7F5F2] transition-colors duration-200 hover:bg-[#F7F5F2]/10 sm:text-sm"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                    {link.label}
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60" strokeWidth={1.75} />
                  </a>
                </li>
              )
            })}
          </ul>
        </FadeIn>
      </div>

      <p className="mx-auto mt-20 max-w-7xl border-t border-[#F7F5F2]/15 pt-8 text-center sm:mt-28 text-xs font-light uppercase tracking-widest text-[#F7F5F2]/60">
        &copy; {year} Ajmal P.S &middot; Designed and built in Doha, Qatar
      </p>
    </footer>
  )
}
