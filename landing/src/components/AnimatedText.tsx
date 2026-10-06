import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'

function Char({ char, progress, range }: { char: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.2, 1])
  return (
    <motion.span className="char" style={{ opacity }}>
      {char}
    </motion.span>
  )
}

type AnimatedTextProps = {
  text: string
  className?: string
  style?: CSSProperties
}

// Lights the paragraph up one character at a time as it scrolls through the
// viewport, from 20% to full opacity.
//
// The static HTML carries the sentence as plain text, so it reads fine before
// any script runs and to anything that never runs one. After hydration the
// characters are split out for the animation; a screen reader gets the whole
// sentence from a hidden copy instead of one letter at a time.
export default function AnimatedText({ text, className, style }: AnimatedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] })
  const reduceMotion = useReducedMotion()
  const [split, setSplit] = useState(false)
  useEffect(() => setSplit(true), [])

  if (!split || reduceMotion) {
    return (
      <p ref={ref} className={className} style={style}>
        {text}
      </p>
    )
  }

  const total = text.length
  let index = 0
  const words = text.split(' ')

  return (
    <p ref={ref} className={className} style={style}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => {
          const chars = [...word].map((char) => {
            const start = index / total
            index += 1
            return <Char key={index} char={char} progress={scrollYProgress} range={[start, start + 1 / total]} />
          })
          index += 1 // the space after the word
          // A word never breaks inside itself, so "as-built" stays in one piece.
          return (
            <Fragment key={w}>
              <span className="whitespace-nowrap">{chars}</span>
              {w < words.length - 1 ? ' ' : null}
            </Fragment>
          )
        })}
      </span>
    </p>
  )
}
