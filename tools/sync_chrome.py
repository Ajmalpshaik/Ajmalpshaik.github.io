#!/usr/bin/env python3
"""
Writes the bar, the phone menu and the footer into every page.

The site has no build step: each page is a hand-written HTML file that carries
its own copy of the chrome. That is fine until one copy drifts. This is the one
place the chrome is written, and `--check` fails the build if any page no
longer matches it.

Each page marks the two places with comments:

    <!-- chrome:nav -->   ...   <!-- /chrome:nav -->
    <!-- chrome:foot -->  ...   <!-- /chrome:foot -->

Run:    python3 tools/sync_chrome.py                 rewrite every page
        python3 tools/sync_chrome.py about/index.html  rewrite only these pages
        python3 tools/sync_chrome.py --check         fail if any page is out of date
Exit:   0 all good, 1 something is out of date (or wrong)
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------------ content

# Three tabs and a button. (key, href, label)
TABS = [
    ("about", "/about/", "About me"),
    ("tools", "/tools/", "Tools"),
    ("heron", "/heron/", "Heron"),
]

EMAIL = "ajmalnattika@gmail.com"
SOCIAL = [
    ("https://www.linkedin.com/in/ajmalps/", "LinkedIn"),
    ("https://wa.me/97431033040?text=Hi%20Ajmal%2C%20I%20found%20you%20on%20ajmalps.com", "WhatsApp"),
    ("https://github.com/Ajmalpshaik", "GitHub"),
]

# Which tab each page sits under (None: no tab is selected). Redirect stubs for
# old addresses are not here: they carry no chrome, only a forward.
PAGES = {
    "index.html": None,
    "404.html": None,
    "about/index.html": "about",
    "tools/index.html": "tools",
    "toolbox/crane-lift-calculator/index.html": "tools",
    "toolbox/ar-viewer/index.html": "tools",
    "toolbox/bim-viewer/index.html": "tools",
    "heron/index.html": "heron",
    "heron-ai/index.html": "heron",
    "heron-tools/index.html": "heron",
    "heron-autocad/index.html": "heron",
}

ARROW = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" '
         'aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg>')
BURGER = ('<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" '
          'aria-hidden="true"><path d="M2 6h14M2 12h14"/></svg>')
CROSS = ('<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" '
         'aria-hidden="true"><path d="m4 4 10 10M14 4 4 14"/></svg>')


def render_nav(current):
    def cur(key):
        return ' aria-current="page"' if key == current else ""

    tabs = "\n".join(
        f'          <li><a href="{href}" data-tab="{key}"{cur(key)}>{label}</a></li>'
        for key, href, label in TABS
    )
    sheet = "\n".join(
        f'  <a class="big{" heron" if key == "heron" else ""}" href="{href}" data-tab="{key}"{cur(key)}>'
        f'{label} <small>0{i}</small></a>'
        for i, (key, href, label) in enumerate(TABS, 1)
    )
    return f"""<!-- chrome:nav -->
<a class="skip" href="#main">Skip to content</a>
<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="mark" href="/" aria-label="Ajmal P.S, home"><i aria-hidden="true"></i>Ajmal P.S</a>
    <nav class="nav-tabs" aria-label="Main">
      <ul class="tabs" id="tabs">
        <li class="tab-ind" aria-hidden="true"></li>
{tabs}
      </ul>
    </nav>
    <a class="pill magnetic" href="#contact">Contact {ARROW}</a>
    <button class="burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="overlay">{BURGER}</button>
  </div>
</header>
<div class="overlay" id="overlay" role="dialog" aria-modal="true" aria-label="Menu">
  <button class="burger close" type="button" aria-label="Close menu">{CROSS}</button>
{sheet}
  <a class="pill" href="#contact">Contact {ARROW}</a>
</div>
<!-- /chrome:nav -->"""


def render_foot():
    social = "\n".join(
        f'          <a class="ghost" href="{href}" target="_blank" rel="noopener">{name}</a>'
        for href, name in SOCIAL
    )
    links = " ".join(f'<a href="{href}">{label}</a>' for _, href, label in TABS)
    return f"""<!-- chrome:foot -->
<footer class="foot" id="contact">
  <div class="wrap">
    <p class="eyebrow">Contact</p>
    <h2 class="foot-h">Let&rsquo;s <em class="s">talk.</em></h2>
    <div class="foot-grid">
      <div>
        <div class="mail"><a href="mailto:{EMAIL}">{EMAIL}</a><button class="copy" type="button" data-copy="{EMAIL}">Copy</button></div>
        <p class="say">Hiring, or want a tool built? Email is fastest, and I answer every message myself. Transferable QID with NOC, able to join within days.</p>
        <div class="socials">
{social}
        </div>
      </div>
    </div>
    <div class="legal">
      <span>&copy; <span id="yr">2026</span> Ajmal P.S &middot; Doha, Qatar</span>
      <nav aria-label="Footer">{links} <a href="#main">Back to top &uarr;</a></nav>
    </div>
  </div>
</footer>
<!-- /chrome:foot -->"""


# ------------------------------------------------------------------ machinery

NAV_RE = re.compile(r"<!-- chrome:nav -->.*?<!-- /chrome:nav -->", re.S)
FOOT_RE = re.compile(r"<!-- chrome:foot -->.*?<!-- /chrome:foot -->", re.S)


def render_page(path, html):
    current = PAGES[path]
    problems = []
    if not NAV_RE.search(html):
        problems.append("no <!-- chrome:nav --> block")
    if not FOOT_RE.search(html):
        problems.append("no <!-- chrome:foot --> block")
    out = NAV_RE.sub(lambda m: render_nav(current), html, count=1)
    out = FOOT_RE.sub(lambda m: render_foot(), out, count=1)
    return out, problems


def main(argv):
    check = "--check" in argv
    only = [a.replace("\\", "/").lstrip("./") for a in argv if not a.startswith("--")]
    for p in only:
        if p not in PAGES:
            print(f"error: {p} is not in PAGES")
            return 1
    targets = only or list(PAGES)
    bad = 0
    for rel in targets:
        full = os.path.join(ROOT, rel)
        if not os.path.exists(full):
            print(f"missing: {rel}")
            bad += 1
            continue
        with open(full, encoding="utf-8") as f:
            html = f.read()
        out, problems = render_page(rel, html)
        for msg in problems:
            print(f"{rel}: {msg}")
            bad += 1
        if problems:
            continue
        if out != html:
            if check:
                print(f"out of date: {rel}  (run: python3 tools/sync_chrome.py)")
                bad += 1
            else:
                with open(full, "w", encoding="utf-8") as f:
                    f.write(out)
                print(f"updated: {rel}")
    if bad:
        return 1
    if check:
        print(f"chrome in sync on {len(targets)} pages")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
