type LiveProjectButtonProps = {
  href: string
  label?: string
  /** Read after the label by screen readers, so "View project" says which one. */
  context?: string
}

export default function LiveProjectButton({ href, label = 'Live Project', context }: LiveProjectButtonProps) {
  return (
    <a
      href={href}
      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border-2 border-[#F7F5F2] px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#F7F5F2] transition-colors duration-200 hover:bg-[#F7F5F2]/10 sm:px-10 sm:py-3.5 sm:text-base"
    >
      {label}
      {context ? <span className="sr-only">: {context}</span> : null}
    </a>
  )
}
