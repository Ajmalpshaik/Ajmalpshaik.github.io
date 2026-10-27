import { useEffect, useRef, useState } from 'react'
import { navGroups, navCta } from '../content'

/**
 * The site bar, on the cover.
 *
 * It is the same bar every other page carries: the classes and the structure
 * match what tools/sync_chrome.py writes, and the look comes from the one
 * stylesheet both halves load, /assets/chrome.css. Only the behaviour is
 * written twice - here in React, and in assets/app.js for the content pages -
 * and the two are deliberately the same: hover or click opens a menu, Escape
 * closes it and gives the trigger its focus back, the arrow keys walk the
 * links, and under 1000px the three menus become one sheet.
 */
const SHEET = '(max-width: 1000px)'

export default function SiteNav() {
  const [open, setOpen] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const bar = useRef<HTMLElement>(null)
  const isSheet = useRef(false)
  // How the open menu was opened. Hovering a trigger opens its menu, so
  // without this the click that follows the hover - the ordinary way a person
  // uses a menu bar - would read as "already open" and shut it in their face.
  // A click closes only what a click opened.
  const byClick = useRef(false)

  // Which mode we are in. Kept in a ref as well, because the handlers below
  // read it during an event and must not go stale between renders.
  useEffect(() => {
    const mq = window.matchMedia(SHEET)
    const sync = () => {
      isSheet.current = mq.matches
      setOpen(null)
      setSheet(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape closes whatever is open; a click outside does the same.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      byClick.current = false
      setOpen(null)
      setSheet(false)
    }
    const onClick = (e: MouseEvent) => {
      if (bar.current?.contains(e.target as Node)) return
      byClick.current = false
      setOpen(null)
      setSheet(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [])

  const leave = useRef<number | undefined>(undefined)

  return (
    <nav id="nav" aria-label="Main" className={scrolled ? 'scrolled' : undefined} ref={bar}>
      <div className="navin">
        <a className="brand" href="/" aria-label="Ajmal P.S — home">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <rect x="3" y="3" width="58" height="58" rx="15" fill="none" stroke="currentColor" strokeWidth="4" />
            <text
              x="32"
              y="42"
              fontFamily="Kanit,-apple-system,Segoe UI,Arial,sans-serif"
              fontSize="25"
              fontWeight="500"
              fill="currentColor"
              textAnchor="middle"
            >
              AJ
            </text>
          </svg>{' '}
          Ajmal P.S
        </a>

        <div className={`navlinks${sheet ? ' open' : ''}`} id="navLinks" onClick={() => setSheet(false)}>
          {navGroups.map((group) => {
            const id = `nm-${group.name.toLowerCase()}`
            const isOpen = open === group.name
            return (
              <div
                key={group.name}
                className={`navgroup${isOpen ? ' open' : ''}`}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch' || isSheet.current) return
                  window.clearTimeout(leave.current)
                  byClick.current = false
                  setOpen(group.name)
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'touch' || isSheet.current) return
                  leave.current = window.setTimeout(() => {
                    byClick.current = false
                    setOpen((o) => (o === group.name ? null : o))
                  }, 140)
                }}
                onKeyDown={(e) => {
                  if (isSheet.current) return
                  const items = Array.from(
                    e.currentTarget.querySelectorAll<HTMLAnchorElement>('.navmenu a'),
                  )
                  const i = items.indexOf(document.activeElement as HTMLAnchorElement)
                  if (e.key === 'Escape' && isOpen) {
                    e.stopPropagation()
                    byClick.current = false
                    setOpen(null)
                    e.currentTarget.querySelector<HTMLButtonElement>('.navtrig')?.focus()
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    byClick.current = true
                    setOpen(group.name)
                    ;(items[i + 1] ?? items[0])?.focus()
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    ;(i > 0 ? items[i - 1] : items[items.length - 1])?.focus()
                  }
                }}
              >
                <button
                  type="button"
                  className="navtrig"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSheet.current) return
                    if (isOpen && byClick.current) {
                      byClick.current = false
                      setOpen(null)
                    } else {
                      byClick.current = true
                      setOpen(group.name)
                    }
                  }}
                >
                  {group.name}
                  <svg
                    className="caret"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div className="navmenu" id={id}>
                  {group.items.map((item) => (
                    <a key={item.href} href={item.href}>
                      <b>{item.label}</b>
                      <span>{item.note}</span>
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
          <a className="navcta" href={navCta.href}>
            {navCta.label}
          </a>
        </div>

        <div className="navend">
          <button
            id="menuBtn"
            aria-label={sheet ? 'Close menu' : 'Open menu'}
            aria-expanded={sheet}
            aria-controls="navLinks"
            onClick={(e) => {
              e.stopPropagation()
              setSheet((s) => !s)
            }}
          >
            <span />
          </button>
        </div>
      </div>
    </nav>
  )
}
