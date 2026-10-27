#!/usr/bin/env python3
"""
Writes the navigation, the foot-of-page pager and the footer into every page.

The site has no build step: fourteen hand-written HTML files each carry their
own copy of the chrome. That is fine until one of them drifts - a link added to
eight pages and forgotten on the ninth is invisible until somebody lands on the
ninth. This is the one place the chrome is written, and `--check` fails the
build if any page no longer matches it.

Run:    python3 tools/sync_chrome.py          rewrite every page
        python3 tools/sync_chrome.py --check  fail if any page is out of date
Exit:   0 all good, 1 something is out of date (or wrong)
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --------------------------------------------------------------- the content

BRAND_SVG = (
    '<svg viewBox="0 0 64 64" aria-hidden="true">'
    '<rect x="3" y="3" width="58" height="58" rx="15" fill="none" stroke="currentColor" stroke-width="4"/>'
    '<text x="32" y="42" font-family="Kanit,-apple-system,Segoe UI,Arial,sans-serif" font-size="25" '
    'font-weight="500" fill="currentColor" text-anchor="middle">AJ</text></svg>'
)

# Three menus and a button. Each entry is (href, label, the one line under it).
GROUPS = [
    ("Experience", [
        ("/story/", "Story", "How it started"),
        ("/experience/", "Experience", "Eleven years, and where"),
        ("/work/", "Selected work", "Five projects in Qatar"),
    ]),
    ("Tools", [
        ("/aj-tools/", "AJ-Tools", "The Revit add-in a team runs on"),
        ("/heron-ai/", "Heron AI", "An AI that works inside Revit"),
        ("/toolbox/", "Toolbox", "Tools you can use in the browser"),
    ]),
    ("About", [
        ("/skills/", "Skills", "The full stack, named"),
        ("/about/", "About", "Visa, notice, languages"),
        ("/faq/", "FAQ", "The questions before a call"),
    ]),
]
CTA = ("/contact/", "Contact")

# The order the site is meant to be read in - see docs/REDESIGN.md. Every page
# in it ends by handing over to the next one, so no page is a dead end.
TOUR = [
    ("/", "Home", "Who, and the proof in one screen"),
    ("/story/", "Story", "How it started"),
    ("/experience/", "Experience", "Eleven years, and where"),
    ("/work/", "Selected work", "Five projects in Qatar"),
    ("/aj-tools/", "AJ-Tools", "The Revit add-in a team runs on"),
    ("/heron-ai/", "Heron AI", "An AI that works inside Revit"),
    ("/toolbox/", "Toolbox", "Tools you can use in the browser"),
    ("/skills/", "Skills", "The full stack, named"),
    ("/about/", "About", "Visa, notice, languages"),
    ("/faq/", "FAQ", "The questions before a call"),
    ("/contact/", "Contact", "Email, WhatsApp, LinkedIn"),
]

SOCIAL = [
    ("https://www.linkedin.com/in/ajmalps/", "LinkedIn"),
    ("https://github.com/Ajmalpshaik", "GitHub"),
    ("https://wa.me/97431033040?text=Hi%20Ajmal%2C%20I%20found%20you%20on%20ajmalps.com", "WhatsApp"),
    ("mailto:ajmalnattika@gmail.com", "Email"),
]

# Which page is which. Keys are repo-relative paths; the value is
# (the bar link to mark as current, this page's own place on the tour).
#
# The two are not always the same. A tool page is not on the tour - a pager
# reading "next: Skills" under a crane calculator would be nonsense - but it is
# still inside the Toolbox, so the bar marks Toolbox while the page shows no
# pager. Giving both jobs to one value is how those three pages lost their
# current-page marking when this script took the nav over.
PAGES = {
    "404.html": (None, None),
    "story/index.html": ("/story/", "/story/"),
    "experience/index.html": ("/experience/", "/experience/"),
    "work/index.html": ("/work/", "/work/"),
    "aj-tools/index.html": ("/aj-tools/", "/aj-tools/"),
    "heron-ai/index.html": ("/heron-ai/", "/heron-ai/"),
    "about/index.html": ("/about/", "/about/"),
    "skills/index.html": ("/skills/", "/skills/"),
    "faq/index.html": ("/faq/", "/faq/"),
    "contact/index.html": ("/contact/", "/contact/"),
    "toolbox/index.html": ("/toolbox/", "/toolbox/"),
    "toolbox/crane-lift-calculator/index.html": ("/toolbox/", None),
    "toolbox/ar-viewer/index.html": ("/toolbox/", None),
    "toolbox/bim-viewer/index.html": ("/toolbox/", None),
}

CHEV_L = '<span class="chev" aria-hidden="true">&lsaquo;</span>'
CHEV_R = '<span class="chev" aria-hidden="true">&rsaquo;</span>'


# ------------------------------------------------------------------ builders

def nav_html(current):
    """The bar. `current` is the site path of the page, or None."""
    out = [
        '<nav id="nav" aria-label="Main">',
        '  <div class="navin">',
        f'    <a class="brand" href="/" aria-label="Ajmal P.S &mdash; home">{BRAND_SVG} Ajmal P.S</a>',
        '',
        '    <div class="navlinks" id="navLinks">',
    ]
    for name, items in GROUPS:
        gid = "nm-" + name.lower()
        here = ' data-current' if any(h == current for h, _, _ in items) else ''
        out += [
            f'      <div class="navgroup"{here}>',
            f'        <button type="button" class="navtrig" aria-expanded="false" aria-controls="{gid}">{name}'
            '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
            'aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>',
            # A real list, named. Under 1000px the trigger above becomes an
            # inert heading and assets/app.js takes it out of the reading
            # order; this label is then the only thing naming the group, so it
            # is not decoration.
            f'        <ul class="navmenu" id="{gid}" aria-label="{name}">',
        ]
        for href, label, note in items:
            mark = ' aria-current="page"' if href == current else ''
            out.append(f'          <li><a href="{href}"{mark}><b>{label}</b><span>{note}</span></a></li>')
        out += ['        </ul>', '      </div>']
    mark = ' aria-current="page"' if CTA[0] == current else ''
    out += [
        f'      <a class="navcta" href="{CTA[0]}"{mark}>{CTA[1]}</a>',
        '    </div>',
        '',
        '    <div class="navend">',
        '      <button id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">'
        '<span></span></button>',
        '      <button id="themeSwitch" role="switch" aria-checked="false" aria-label="Switch to dark mode">',
        '        <span class="track"><span class="knob">',
        '          <svg class="ic-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" '
        'stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="4.6"/>'
        '<path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9'
        'M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/></svg>',
        '          <svg class="ic-moon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" '
        'aria-hidden="true"><path d="M21 14.5A8.7 8.7 0 0 1 9.5 3 8.8 8.8 0 1 0 21 14.5Z"/></svg>',
        '        </span></span>',
        '      </button>',
        '    </div>',
        '  </div>',
        '</nav>',
    ]
    return "\n".join(out)


def foot_html(current):
    """The pager and the closing call to action, for a page that is on the tour."""
    paths = [p for p, _, _ in TOUR]
    if current not in paths:
        return None
    i = paths.index(current)
    prev = TOUR[i - 1] if i > 0 else None
    # The last page hands back to the start rather than stopping dead.
    nxt = TOUR[i + 1] if i + 1 < len(TOUR) else TOUR[0]

    cards = []
    if prev:
        cards.append(
            f'      <a class="pcard prev" href="{prev[0]}"><small>Previous</small>'
            f'<b>{CHEV_L} {prev[1]}</b><span>{prev[2]}</span></a>'
        )
    label = "Back to the start" if nxt[0] == "/" else "Next"
    cards.append(
        f'      <a class="pcard next" href="{nxt[0]}"><small>{label}</small>'
        f'<b>{nxt[1]} {CHEV_R}</b><span>{nxt[2]}</span></a>'
    )
    # On /contact/ the whole page is the call to action; a band repeating it
    # under the pager would be the third "get in touch" on one screen.
    band = [] if current == "/contact/" else [
        '    <div class="ctaband reveal">',
        '      <div>',
        '        <h2>Looking for an MEP BIM Coordinator?</h2>',
        '        <p>Doha, Qatar &middot; transferable QID with NOC &middot; able to join within days.</p>',
        '      </div>',
        '      <div class="btnrow">',
        '        <a class="btn" href="/contact/">Get in touch</a>',
        '        <a class="tlink" href="/faq/">Read the FAQ <span class="chev">&rsaquo;</span></a>',
        '      </div>',
        '    </div>',
    ]

    return "\n".join([
        '<section class="sec-foot">',
        '  <div class="wrap">',
        '    <nav class="pager" aria-label="More of the site">',
        *cards,
        '    </nav>',
        *band,
        '  </div>',
        '</section>',
    ])


def footer_html():
    cols = []
    for name, items in GROUPS:
        lis = "\n".join(f'        <li><a href="{h}">{label}</a></li>' for h, label, _ in items)
        cols.append(f'    <div>\n      <h3>{name}</h3>\n      <ul>\n{lis}\n      </ul>\n    </div>')
    socials = "\n".join(
        '        <li><a href="%s"%s>%s</a></li>'
        % (h, ' rel="me"' if h.startswith("https") else "", label)
        for h, label in SOCIAL
    )
    cols.append(f'    <div>\n      <h3>Elsewhere</h3>\n      <ul>\n{socials}\n      </ul>\n    </div>')
    return "\n".join([
        '<footer>',
        '  <div class="fgrid">',
        '    <div>',
        f'      <div class="fbrand">{BRAND_SVG} Ajmal P.S</div>',
        '      <p class="fabout">MEP BIM Coordinator in Doha, Qatar. I build the models, and the '
        'Revit tools my team runs on.</p>',
        f'      <a class="btn btn-ghost fcta" href="{CTA[0]}">{CTA[1]}</a>',
        '    </div>',
        *cols,
        '  </div>',
        '  <div class="foot">',
        '    <span>&copy; <span id="yr">2026</span> Ajmal P.S &middot; Designed and built in Doha, Qatar.</span>',
        '    <span><a href="/">ajmalps.com</a></span>',
        '  </div>',
        '</footer>',
    ])


# -------------------------------------------------------------------- rewrite

NAV_RE = re.compile(r'<nav id="nav".*?</nav>', re.S)
FOOTER_RE = re.compile(r"<footer>.*?</footer>", re.S)
FOOT_RE = re.compile(r"<!-- foot:start -->.*?<!-- foot:end -->", re.S)


def rewrite(page, src):
    current, tour = PAGES[page]
    problems = []

    if not NAV_RE.search(src):
        problems.append(f"{page}: no <nav id=\"nav\"> to replace")
    else:
        src = NAV_RE.sub(lambda _: nav_html(current), src, count=1)

    if not FOOTER_RE.search(src):
        problems.append(f"{page}: no <footer> to replace")
    else:
        src = FOOTER_RE.sub(lambda _: footer_html(), src, count=1)

    foot = foot_html(tour)
    if foot is not None:
        block = f"<!-- foot:start -->\n{foot}\n<!-- foot:end -->"
        if FOOT_RE.search(src):
            src = FOOT_RE.sub(lambda _: block, src, count=1)
        elif "</main>" in src:
            src = src.replace("</main>", block + "\n</main>", 1)
        else:
            problems.append(f"{page}: nowhere to put the pager (no </main>)")
    elif FOOT_RE.search(src):
        # A page taken off the tour keeps its pager otherwise, pointing at
        # neighbours it no longer has, and --check stays green about it.
        src = FOOT_RE.sub("", src, count=1).replace("\n\n</main>", "\n</main>")

    return src, problems


def main():
    check = "--check" in sys.argv
    stale, problems = [], []
    for page in PAGES:
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            problems.append(f"missing page: {page}")
            continue
        with open(path, encoding="utf-8") as fh:
            before = fh.read()
        after, errs = rewrite(page, before)
        problems += errs
        if after == before:
            continue
        stale.append(page)
        if not check:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(after)

    for p in problems:
        print(f"ERROR:   {p}")
    if check:
        for page in stale:
            print(f"ERROR:   {page} is out of date with tools/sync_chrome.py")
        if stale or problems:
            print("\nRun: python3 tools/sync_chrome.py")
            return 1
        print("Chrome is in sync on every page.")
        return 0

    print(f"Rewrote {len(stale)} page(s)." if stale else "Every page was already in sync.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
