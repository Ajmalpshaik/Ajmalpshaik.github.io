import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ComponentType } from 'react'

type Tag = 'div' | 'p' | 'h1' | 'h2' | 'nav' | 'span'
type MotionTagProps = HTMLMotionProps<'div'>

// One motion component per tag, made once and shared, rather than a new
// component type on every render (which would remount the element each time).
const made = new Map<Tag, ComponentType<MotionTagProps>>()
function motionTag(tag: Tag) {
  let component = made.get(tag)
  if (!component) {
    component = motion.create(tag) as unknown as ComponentType<MotionTagProps>
    made.set(tag, component)
  }
  return component
}

type FadeInProps = Omit<MotionTagProps, 'initial' | 'whileInView' | 'viewport' | 'transition'> & {
  as?: Tag
  delay?: number
  duration?: number
  x?: number
  y?: number
}

// Fades and slides its children in the first time they scroll into view.
// The `fade-in` class is what the CSS safety nets target: no JavaScript,
// reduced motion, or a script that never loaded all show the content as-is.
export default function FadeIn({
  as = 'div',
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  children,
  ...rest
}: FadeInProps) {
  const Component = motionTag(as)
  return (
    <Component
      className={className ? `fade-in ${className}` : 'fade-in'}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      {...rest}
    >
      {children}
    </Component>
  )
}
