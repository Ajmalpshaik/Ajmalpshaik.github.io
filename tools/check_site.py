#!/usr/bin/env python3
"""
Static checks for ajmalps.com.

Catches the class of mistake that ships silently on a static site: a schema
that no longer matches the page, an anchor pointing at a section that was
renamed, a file referenced but never committed, a meta description that grew
past what search results show.

Run:  python3 tools/check_site.py
Exit: 0 all good, 1 something is wrong.
"""

import html
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The pages people read. Every one carries the chrome from tools/sync_chrome.py.
PAGES = ["index.html", "404.html"] + [
    os.path.join(d, "index.html")
    for d in ("about", "tools", "heron", "heron-ai", "heron-tools", "heron-autocad",
              os.path.join("toolbox", "crane-lift-calculator"),
              os.path.join("toolbox", "ar-viewer"), os.path.join("toolbox", "bim-viewer"))
]

# Old addresses that forward to where their content lives now. Each is a tiny
# page with a canonical link and a meta refresh; nothing else.
STUBS = {
    "story/index.html": "/about/#story",
    "experience/index.html": "/about/#experience",
    "work/index.html": "/about/#work",
    "skills/index.html": "/about/#skills",
    "faq/index.html": "/about/#faq",
    "automation/index.html": "/tools/#automation",
    "toolbox/index.html": "/tools/#browser-tools",
    "contact/index.html": "/#contact",
}

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read()


def strip_tags(fragment):
    text = re.sub(r"<[^>]+>", "", fragment)
    text = html.unescape(text)
    text = text.replace("‑", "-").replace("–", "-").replace("—", "-")
    text = text.replace(" ", " ").replace("’", "'")
    return re.sub(r"\s+", " ", text).strip()


def norm(text):
    return re.sub(r"[^a-z0-9]", "", strip_tags(text).lower())


# ---------------------------------------------------------------- pages exist
for page in PAGES + list(STUBS):
    if not os.path.exists(os.path.join(ROOT, page)):
        err(f"missing page: {page}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

src = read("index.html")


# ------------------------------------------------------------------- JSON-LD
blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', src, re.S)
if not blocks:
    err("no JSON-LD block found")

graph = []
for i, block in enumerate(blocks, 1):
    try:
        data = json.loads(block)
        graph = data.get("@graph", [])
    except json.JSONDecodeError as exc:
        err(f"JSON-LD block {i} does not parse: {exc}")

types = [n.get("@type") for n in graph]
for required in ("Person", "WebSite", "ProfilePage"):
    if required not in types:
        err(f"JSON-LD is missing a {required} node")


# --------------------------------------------- FAQ schema vs what is on screen
# The FAQ is the last section of the About me page.
faq_src = read(os.path.join("about", "index.html"))
faq_graph = []
for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', faq_src, re.S):
    try:
        faq_graph = json.loads(block).get("@graph", [])
    except json.JSONDecodeError as exc:
        err(f"about/index.html JSON-LD does not parse: {exc}")

faq_nodes = [n for n in faq_graph if n.get("@type") == "FAQPage"]
if not faq_nodes:
    err("about/index.html has no FAQPage node")
if faq_nodes:
    schema_qa = [
        (q.get("name", ""), q.get("acceptedAnswer", {}).get("text", ""))
        for q in faq_nodes[0].get("mainEntity", [])
    ]
    section = re.search(r'<section[^>]*\bid="faq"[^>]*>.*?</section>', faq_src, re.S)
    if not section:
        err("FAQPage schema exists but no #faq section is on the page")
    else:
        # One row per question: the heading, then the answer in the next cell.
        visible = re.findall(r"<h3[^>]*>(.*?)</h3>.*?<p>(.*?)</p>", section.group(0), re.S)
        if len(visible) != len(schema_qa):
            err(f"FAQ count mismatch: {len(schema_qa)} in schema, {len(visible)} on page")
        for (sq, sa), (vq, va) in zip(schema_qa, visible):
            if norm(sq) != norm(vq):
                err(f"FAQ question differs from the page: {strip_tags(vq)[:60]!r}")
            elif norm(sa) != norm(va):
                err(f"FAQ answer differs from the page: {strip_tags(vq)[:60]!r}")


# ------------------------------------------------------------ internal anchors
# Every page, not only the home page: a link to a section that was renamed
# scrolls nowhere and says nothing about it. A link to "/#name" is checked
# against the home page, which is where it lands.
home_ids = set(re.findall(r'\bid="([^"]+)"', src))
for page in PAGES:
    page_src = read(page)
    ids = set(re.findall(r'\bid="([^"]+)"', page_src))
    for href in re.findall(r'href="#([^"]+)"', page_src):
        if href and href not in ids:
            err(f"{page}: anchor #{href} points at nothing on this page")
    for href in re.findall(r'href="/#([^"]+)"', page_src):
        if href and href not in home_ids:
            err(f"{page}: link to /#{href} points at nothing on the home page")


# ------------------------------------------------ referenced files are present
for page in PAGES:
    page_src = read(page)
    base = os.path.dirname(os.path.join(ROOT, page))
    # a data: URI carries its content inline, so there is no file to look for
    refs = re.findall(r'(?:src|href)="(?!https?:|mailto:|tel:|#|//|data:)([^"]+)"', page_src)
    for ref in refs:
        path = ref.split("?")[0].split("#")[0]
        if not path:
            continue
        # a leading slash means the site root; anything else is relative to the
        # page that wrote it, which is not the repo root once pages sit in folders
        target = (os.path.join(ROOT, path.lstrip("/")) if path.startswith("/")
                  else os.path.join(base, path))
        if not os.path.exists(target):
            err(f"{page} references a file that is not in the repo: {ref}")

# assets/site.js forwards the old single-page anchors (#story, #faq...) to where
# that content lives now. Those paths are in a JavaScript object, not in an
# href, so the scan above cannot see them - and a page can be renamed out from
# under one of them in total silence.
site_js = read("assets/site.js")
legacy = re.search(r"var legacy = \{(.*?)\};", site_js, re.S)
if not legacy:
    err("assets/site.js: the legacy redirect map is gone or no longer matches - "
        "if it was removed on purpose, remove this check with it")
else:
    for dest in re.findall(r"'(/[^']*)'", legacy.group(1)):
        path, _, frag = dest.partition("#")
        page = os.path.join(path.strip("/"), "index.html") if path.strip("/") else "index.html"
        if not os.path.exists(os.path.join(ROOT, page)):
            err(f"assets/site.js redirects an old anchor to {dest}, which is not a page")
        elif frag and f'id="{frag}"' not in read(page):
            err(f"assets/site.js redirects an old anchor to {dest}, but {page} has no id=\"{frag}\"")

# --------------------------------------------------- old addresses still forward
for stub, dest in STUBS.items():
    if not os.path.exists(os.path.join(ROOT, stub)):
        continue
    stub_src = read(stub)
    if f'content="0; url={dest}"' not in stub_src:
        err(f"{stub} should forward to {dest} with a meta refresh")
    path, _, frag = dest.partition("#")
    page = os.path.join(path.strip("/"), "index.html") if path.strip("/") else "index.html"
    if not os.path.exists(os.path.join(ROOT, page)):
        err(f"{stub} forwards to {dest}, which is not a page")
    elif frag and f'id="{frag}"' not in read(page):
        err(f"{stub} forwards to {dest}, but {page} has no id=\"{frag}\"")

# ------------------------------------------- the sitemap lists exactly the pages
sitemap = read("sitemap.xml")
listed = set(re.findall(r"<loc>https://ajmalps\.com/([^<]*)</loc>", sitemap))
expected = {("" if p == "index.html" else p[: -len("index.html")]) for p in PAGES if p != "404.html"}
for missing in sorted(expected - listed):
    err(f"sitemap.xml does not list /{missing}")
for extra in sorted(listed - expected):
    err(f"sitemap.xml lists /{extra}, which is not a page (or is a redirect)")

# Files nothing links to with src or href, so the scan above cannot see them:
# the fonts are asked for by assets/site.css, and the rest are read by crawlers
# rather than by the pages. Without this, deleting one of them leaves the static
# check green.
for asset in ("og-cover.png", "favicon.svg", "CNAME", "robots.txt", "sitemap.xml",
              "assets/fonts/geist.woff2", "assets/fonts/geist-mono-400.woff2",
              "assets/fonts/geist-mono-500.woff2", "assets/fonts/instrument-serif.woff2",
              "assets/fonts/instrument-serif-italic.woff2"):
    if not os.path.exists(os.path.join(ROOT, asset)):
        err(f"missing expected file: {asset}")


# ------------------------------------------- head essentials, on every page
for page in PAGES:
    page_src = read(page)
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', page_src)
    if page != "404.html" and not canonical:
        err(f"{page}: no canonical link")
    for meta_url in re.findall(r'content="(https://ajmalps\.com/[^"]+)"', page_src):
        path = meta_url.replace("https://ajmalps.com/", "").split("#")[0]
        if path and not os.path.exists(os.path.join(ROOT, path)):
            err(f"{page}: meta tag points at a file that is not in the repo: {meta_url}")
    desc = re.search(r'<meta name="description" content="([^"]+)"', page_src)
    if not desc:
        err(f"{page}: no meta description")
    elif len(desc.group(1)) > 165:
        warn(f"{page}: meta description is {len(desc.group(1))} chars; search results cut off near 160")
    title = re.search(r"<title>(.*?)</title>", page_src, re.S)
    if not title:
        err(f"{page}: no <title>")
    elif len(strip_tags(title.group(1))) > 65:
        warn(f"{page}: title is {len(strip_tags(title.group(1)))} chars; search results cut off near 60")
    h1s = len(re.findall(r"<h1[\s>]", page_src))
    if h1s != 1:
        err(f"{page}: expected exactly one h1, found {h1s}")
    if '<main id="main"' not in page_src:
        err(f"{page}: no <main id=\"main\"> landmark (the skip link points at it)")
    for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page_src, re.S):
        try:
            json.loads(blk)
        except json.JSONDecodeError as exc:
            err(f"{page}: JSON-LD does not parse: {exc}")


# ------------------------------------------------------ stated counts are true
# /heron-ai/ states its figures - fragments, how many are proved, agents,
# tools, skills - and then lists every one of them. None of that is typed:
# tools/update_heron.py writes it from the Heron-AI repository, and the
# markers below are what it writes between. If they are missing, the page has
# been hand-edited where it should not have been and the next run will fail.
heron = read(os.path.join("heron-ai", "index.html"))
for marker in ("numbers", "skills", "skills-heading", "fragments",
               "fragments-heading", "tools", "tools-heading", "tools-note",
               "skills-count", "proven-count", "ribbon", "ribbon-heading",
               "fragments-total", "proven-n", "draft-n", "agents-total",
               "tier-1", "tier-2", "tier-3"):
    if f"<!-- heron:{marker} -->" not in heron or f"<!-- /heron:{marker} -->" not in heron:
        err(f"heron-ai/index.html has lost its <!-- heron:{marker} --> markers; "
            f"tools/update_heron.py can no longer write that part of the page")


# --------------------------------------------------- duplicated body sentences
body_match = re.search(r'<main id="main">.*?</main>', src, re.S)
if body_match:
    body = re.sub(r"<(script|style|svg)\b.*?</\1>", " ", body_match.group(0), flags=re.S)
    words = re.findall(r"[a-z0-9#+/'-]+", strip_tags(body).lower())
    stop = {"the", "and", "a", "of", "to", "in", "on", "for", "with", "from", "it",
            "is", "my", "i", "that", "at", "as", "an", "by", "so", "are", "be", "not", "you"}
    grams = Counter()
    for i in range(len(words) - 5):
        gram = words[i:i + 6]
        if all(w in stop for w in gram):
            continue
        grams[" ".join(gram)] += 1
    for gram, count in grams.items():
        if count > 1:
            warn(f"phrase repeats {count}x in the body: {gram!r}")


# ----------------------------------------------------------------------- done
for w in warnings:
    print(f"warning: {w}")
for e in errors:
    print(f"ERROR:   {e}")

print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
sys.exit(1 if errors else 0)
