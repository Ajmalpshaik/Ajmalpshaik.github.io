import { contactHref } from '../content'

// The gradient pill. Its look lives in the .contact-btn rule in index.css.
export default function ContactButton() {
  return (
    <a
      href={contactHref}
      className="contact-btn inline-flex items-center justify-center whitespace-nowrap rounded-full px-8 py-3 text-xs font-medium uppercase tracking-widest text-white transition-[filter,transform] duration-200 hover:brightness-125 active:scale-[0.98] sm:px-10 sm:py-3.5 sm:text-sm md:px-12 md:py-4 md:text-base"
    >
      Contact Me
    </a>
  )
}
