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
PAGES = ["index.html", "404.html"] + [
    os.path.join(d, "index.html")
    for d in ("story", "experience", "work", "aj-tools", "heron-ai",
              "about", "skills", "faq", "contact",
              "toolbox", os.path.join("toolbox", "crane-lift-calculator"),
              os.path.join("toolbox", "ar-viewer"), os.path.join("toolbox", "bim-viewer"))
]

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
for page in PAGES:
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
# The FAQ has its own page now, so read the schema and the questions from there.
faq_src = read(os.path.join("faq", "index.html"))
faq_graph = []
for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', faq_src, re.S):
    try:
        faq_graph = json.loads(block).get("@graph", [])
    except json.JSONDecodeError as exc:
        err(f"faq/index.html JSON-LD does not parse: {exc}")

faq_nodes = [n for n in faq_graph if n.get("@type") == "FAQPage"]
if not faq_nodes:
    err("faq/index.html has no FAQPage node")
if faq_nodes:
    schema_qa = [
        (q.get("name", ""), q.get("acceptedAnswer", {}).get("text", ""))
        for q in faq_nodes[0].get("mainEntity", [])
    ]
    section = re.search(r'<section id="faq".*?</section>', faq_src, re.S)
    if not section:
        err("FAQPage schema exists but no #faq section is on the page")
    else:
        visible = re.findall(r"<h3>(.*?)</h3>\s*<p>(.*?)</p>", section.group(0), re.S)
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

# Files nothing links to with src or href, so the scan above cannot see them:
# the display face is asked for by assets/style.css, and the rest are read by
# crawlers rather than by the pages. Without this, deleting one of them leaves
# the static check green.
for asset in ("og-cover.png", "favicon.svg", "CNAME", "robots.txt", "sitemap.xml",
              "assets/fonts/kanit-500.woff2", "assets/fonts/kanit-900.woff2"):
    if not os.path.exists(os.path.join(ROOT, asset)):
        err(f"missing expected file: {asset}")


# ------------------------------------------------------- absolute URLs resolve
canonical = re.search(r'<link rel="canonical" href="([^"]+)"', src)
if not canonical:
    err("no canonical link")
for meta_url in re.findall(r'content="(https://ajmalps\.com/[^"]+)"', src):
    path = meta_url.replace("https://ajmalps.com/", "")
    if path and not os.path.exists(os.path.join(ROOT, path)):
        err(f"meta tag points at a file that is not in the repo: {meta_url}")


# ------------------------------------------------------------ head essentials
desc = re.search(r'<meta name="description" content="([^"]+)"', src)
if not desc:
    err("no meta description")
elif len(desc.group(1)) > 165:
    warn(f"meta description is {len(desc.group(1))} chars; search results cut off near 160")

title = re.search(r"<title>(.*?)</title>", src, re.S)
if not title:
    err("no <title>")
elif len(strip_tags(title.group(1))) > 65:
    warn(f"title is {len(strip_tags(title.group(1)))} chars; search results cut off near 60")

if src.count("<h1") != 1:
    err(f"expected exactly one h1, found {src.count('<h1')}")
if "<main" not in src:
    err("no <main> landmark")


# ------------------------------------------------------ stated counts are true
# /aj-tools/ says "46 tools across 17 panels", and each tab says its own split.
# Those are three numbers that can only go stale, and the page lists every tool
# right under them, so they are counted rather than trusted. (This replaces the
# same check on the old .ribbon markup, which no page has carried since the
# tool list moved onto its own page - it had been passing on nothing.)
aj = read(os.path.join("aj-tools", "index.html"))
sum_panels = sum_tools = 0
for part in re.split(r'(?=<section class="tabsec">)', aj)[1:]:
    name = re.search(r'<h2 class="head reveal">(.*?)\s*<span class="dim">(\d+) tools '
                     r'&middot; (\d+) panels</span>', part, re.S)
    if not name:
        err("a tabsec on aj-tools/index.html has no '<n> tools &middot; <n> panels' label")
        continue
    tab, said_tools, said_panels = name.group(1).strip(), int(name.group(2)), int(name.group(3))
    panels = part.count('<div class="pgrp')
    tools = sum(t.count("<li>") for t in re.findall(r'<ul class="tlist">(.*?)</ul>', part, re.S))
    if panels != said_panels:
        err(f"aj-tools {tab}: label says {said_panels} panels, the page lists {panels}")
    if tools != said_tools:
        err(f"aj-tools {tab}: label says {said_tools} tools, the page lists {tools}")
    # each panel heading carries its own count too
    for heading, said in re.findall(r"<h3>([^<]+)<i>(\d+)</i></h3>", part):
        after = part.split(f"<h3>{heading}<i>{said}</i></h3>", 1)[1]
        listed = after.split("</ul>", 1)[0].count("<li>")
        if listed != int(said):
            err(f"aj-tools {tab} / {heading.strip()}: says {said}, lists {listed}")
    sum_panels += panels
    sum_tools += tools

total = re.search(r"<strong>(\d+) tools across (\d+) panels</strong>", aj)
if not total:
    err("aj-tools/index.html no longer states its total")
elif sum_tools and (int(total.group(1)) != sum_tools or int(total.group(2)) != sum_panels):
    err(f"aj-tools intro says {total.group(1)} tools / {total.group(2)} panels, "
        f"the tabs add up to {sum_tools} / {sum_panels}")


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
