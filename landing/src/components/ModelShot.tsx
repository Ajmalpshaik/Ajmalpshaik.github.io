type ModelShotProps = {
  /** Rendered from the model by `npm run posters` - see scripts/posters.mjs. */
  src: string
  alt: string
  width: number
  height: number
  className?: string
  imgClassName?: string
  /** For the hero: the picture is the largest thing on the first screen. */
  priority?: boolean
}

/**
 * A picture of one of the models.
 *
 * It used to be a live three.js viewer with this picture behind it, turning
 * under the pointer. The viewer is gone: it was about 150 KB gzipped of
 * three.js fetched on the first screen, a WebGL context per model, and a whole
 * capability gate in front of it - all so the thing on screen could look very
 * nearly the same as this picture, which is rendered from the same model at
 * the same angle. The models themselves are still here, in src/three/, and
 * `npm run posters` still renders these pictures from them.
 */
export default function ModelShot({
  src,
  alt,
  width,
  height,
  className = '',
  imgClassName = '',
  priority = false,
}: ModelShotProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      {...(priority ? { fetchpriority: 'high' } : { loading: 'lazy' as const })}
      decoding="async"
      draggable={false}
      className={`select-none ${className} ${imgClassName}`.trim()}
    />
  )
}
