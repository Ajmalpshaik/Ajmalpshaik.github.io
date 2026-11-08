import AnimatedText from '../components/AnimatedText'
import ContactButton from '../components/ContactButton'
import FadeIn from '../components/FadeIn'
import { about } from '../content'

export default function AboutSection() {
  return (
    // The four illustrated objects that used to float in the corners are
    // gone. They were decoration, and they were the kind of decoration that
    // made the page look generated.
    <section id="about" className="relative flex items-center justify-center px-5 py-24 sm:px-8 sm:py-28 md:px-10 md:py-36">
      <div className="relative z-10 flex flex-col items-center gap-16 sm:gap-20 md:gap-24">
        <div className="flex flex-col items-center gap-10 sm:gap-14 md:gap-16">
          <FadeIn
            as="h2"
            y={40}
            className="hero-heading text-center font-extrabold leading-none tracking-[-0.04em]"
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
          >
            {about.heading}
          </FadeIn>
          <AnimatedText
            text={about.text}
            className="max-w-[560px] text-pretty text-center font-medium leading-relaxed text-[#F7F5F2]"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
          />
        </div>
        <FadeIn>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  )
}
