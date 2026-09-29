// GoatCounter, the same counter every other page on the site loads through
// assets/app.js. Dashboard: https://ajmalps.goatcounter.com
//
// It sets no cookies and stores no personal data, so there is nothing to put a
// consent banner in front of. Visitors who send Do Not Track or Global Privacy
// Control are never counted at all. Set the code to "" to switch it off.
const GOATCOUNTER = 'ajmalps'

type GoatCounter = { count?: (vars: { path: string; title: string; event: boolean }) => void }

export function startAnalytics() {
  const root = document.documentElement
  // <html data-no-count> opts a page out entirely
  if (!GOATCOUNTER || root.hasAttribute('data-no-count')) return
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  const dnt = nav.doNotTrack === '1' || (window as Window & { doNotTrack?: string }).doNotTrack === '1' || nav.globalPrivacyControl === true
  if (dnt) return

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://gc.zgo.at/count.js'
  script.setAttribute('data-goatcounter', `https://${GOATCOUNTER}.goatcounter.com/count`)
  document.head.appendChild(script)

  // which sections actually get read - one event per section, per visit
  if (!('IntersectionObserver' in window)) return
  const seen = new Set<string>()
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const name = entry.target.getAttribute('data-track')
        if (!name || seen.has(name)) continue
        seen.add(name)
        io.unobserve(entry.target)
        const gc = (window as Window & { goatcounter?: GoatCounter }).goatcounter
        gc?.count?.({ path: `read/${name}`, title: `Read: ${name}`, event: true })
      }
    },
    { threshold: 0.5 },
  )
  document.querySelectorAll('[data-track]').forEach((el) => io.observe(el))
}
