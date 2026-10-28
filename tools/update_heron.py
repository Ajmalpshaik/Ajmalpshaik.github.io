#!/usr/bin/env python3
"""
Rewrites the figures and the lists on /heron-ai/ from a Heron-AI checkout.

The page states counts - fragments, how many are proved, agents, skills - and
then lists every one of them by area. Those numbers move every week, and a
page that states a number it cannot support is worse than a page that states
none. Typing them in by hand is how "395 fragments" sat on the site for a
month while the library passed 600.

So they are not typed. This reads the repository and writes the page:

    python3 tools/update_heron.py ../Heron-AI
    python3 tools/update_heron.py ../Heron-AI --check   # fail if out of date

What it reads, and from where:

    fragments   brain/fragments/*/fragment.yaml   capability, domain, status
    skills      brain/skills/*.yaml               name, domain, purpose
    agents      tools/agent-count.py              the register's own total
    tools       mcp/server/heron_tools.py         the TOOLS table

Everything it writes sits between HTML comment markers on the page, so the
prose around them is edited by hand as usual and never touched by this.

Exit: 0 all good, 1 the page was out of date (--check) or something is wrong.
"""

import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "heron-ai", "index.html")

# Everything the figures on the page are read from. The stamp is the date of
# the last commit that touched one of these - see counted_on().
COUNTED = (
    "brain/fragments", "brain/skills",
    "mcp/server/heron_tools.py", "mcp/server/heron_mcp_server.py",
    "docs/28-agent-registry.md", "tools/agent-count.py",
)


def counted_on(src):
    """The date the figures describe - the last change to what they count.

    Not today. Today changes at midnight whether or not Heron has changed, and
    this file is compared against the page byte for byte by --check: a clock
    date makes the page "out of date" every morning and says nothing true when
    it does. Nor the repository's newest commit: Heron commits documentation
    most days, and a commit that changes no fragment, skill, tool or agent
    would move the date while every number under it stayed the same. The last
    commit to touch COUNTED moves only when something counted can have moved.
    """
    try:
        out = subprocess.run(["git", "-C", src, "log", "-1", "--format=%cI", "--", *COUNTED],
                             capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return datetime.fromisoformat(out.stdout.strip()).date()
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    # Not a checkout, or no git. Say so rather than stamping a date that would
    # make the page disagree with itself on the next run.
    return None


# How an area's folder name is written on the page.
AREAS = {
    "revit.views": "Views", "revit.view": "Views",
    "revit.mep": "MEP", "revit.elements": "Elements",
    "revit.selection": "Selection", "revit.geometry": "Geometry",
    "revit.document": "Document", "revit.qa": "QA", "revit.sheets": "Sheets",
    "revit.parameters": "Parameters", "revit.annotation": "Annotation",
    "revit.reporting": "Reporting", "revit.schedules": "Schedules",
    "revit.quality": "Quality", "revit.families": "Families",
    "revit.datums": "Datums", "revit.export": "Export", "revit.rooms": "Rooms",
    "revit.levels": "Levels", "revit.phases": "Phases",
    "revit.hvac": "HVAC", "revit.fire": "Firefighting",
}

# A capability is SHOUTED in the repository. These are the words that keep
# their own shape when it is written out in lower case for a reader.
CASED = {
    "cad": "CAD", "mep": "MEP", "ifc": "IFC", "nwc": "NWC", "dwg": "DWG",
    "fbx": "FBX", "pdf": "PDF", "csv": "CSV", "qa": "QA", "hvac": "HVAC",
    "3d": "3D", "2d": "2D", "id": "ID", "ids": "IDs", "directshape": "DirectShape",
    "rcp": "RCP", "bim": "BIM", "url": "URL", "api": "API",
}


def die(msg):
    print(f"ERROR:   {msg}")
    raise SystemExit(1)


def field(text, name):
    m = re.search(rf"^{name}:\s*(.+?)\s*$", text, re.M)
    return m.group(1).strip().strip('"') if m else None


def label(capability):
    """CONVERT_CAD_TO_DIRECTSHAPE -> 'convert CAD to DirectShape'."""
    return " ".join(CASED.get(w.lower(), w.lower()) for w in capability.split("_"))


def quieten(text):
    """The repository SHOUTS the Revit nouns it means exactly. A web page
    reading "builds a DOOR or a WINDOW" looks like it is arguing with you, so
    the shouting comes off - except for the words that are acronyms anyway."""
    keep = {"MEP", "IFC", "HVAC", "QA", "CAD", "BIM", "DWG", "NWC", "FBX",
            "PDF", "CSV", "2D", "3D", "RCP", "API", "URL"}

    def one(m):
        word = m.group(0)
        return word if word in keep else word.lower()

    return re.sub(r"\b[A-Z]{2,}(?:-[A-Z]+)*\b", one, text)


def first_sentence(text, limit=190):
    """The first sentence, or the first clause of it if that runs long."""
    if not text:
        return ""
    out = re.split(r"(?<=[a-z0-9\)])\.\s", text)[0].rstrip(". ")
    if len(out) > limit:
        out = re.split(r"\s+-\s+|,\s+(?=so |which |and that )", out)[0].rstrip(", ")
    return out + "."


# ------------------------------------------------------------------ the repo

def read_fragments(heron):
    folder = os.path.join(heron, "brain", "fragments")
    if not os.path.isdir(folder):
        die(f"no fragment library at {folder}")
    by_area = defaultdict(list)
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name, "fragment.yaml")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        cap = field(text, "capability")
        dom = field(text, "domain")
        status = field(text, "heron-status")
        if not (cap and dom and status):
            die(f"{name}/fragment.yaml is missing capability, domain or heron-status")
        if dom not in AREAS:
            die(f"{name}/fragment.yaml has domain {dom!r}, which has no name on the page "
                f"- add it to AREAS in this script")
        by_area[AREAS[dom]].append((label(cap), status == "PROVEN"))
    for area in by_area:
        by_area[area].sort(key=lambda f: f[0].lower())
    return by_area


def read_skills(heron):
    folder = os.path.join(heron, "brain", "skills")
    if not os.path.isdir(folder):
        die(f"no skill library at {folder}")
    by_area = defaultdict(list)
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".yaml"):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as fh:
            text = fh.read()
        nm, dom = field(text, "name"), field(text, "domain")
        risk = field(text, "risk") or ""
        if not (nm and dom):
            die(f"skills/{name} is missing name or domain")
        if dom not in AREAS:
            die(f"skills/{name} has domain {dom!r} - add it to AREAS in this script")
        # purpose is a folded block. Take its first sentence, quieten the
        # SHOUTED Revit nouns, and keep it to something a reader will finish.
        m = re.search(r"^purpose:\s*>\s*\n((?:\s+.+\n)+)", text, re.M)
        purpose = quieten(" ".join(m.group(1).split())) if m else ""
        purpose = first_sentence(purpose)
        # utterances are the words Ajmal actually says, which is the most
        # useful thing on the line - two of them is plenty.
        block = re.search(r"^utterances:\s*\n((?:\s+-\s+.+\n)+)", text, re.M)
        said = re.findall(r"^\s+-\s+(.+?)\s*$", block.group(1), re.M)[:2] if block else []
        by_area[AREAS[dom]].append((nm, purpose, said, risk))
    for area in by_area:
        by_area[area].sort(key=lambda s: s[0].lower())
    return by_area


def read_agents(heron):
    out = subprocess.run([sys.executable, "tools/agent-count.py"], cwd=heron,
                         capture_output=True, text=True, timeout=300)
    m = re.search(r"Register reconciles:\s*(\d+)\s*agents", out.stdout)
    if not m:
        die("tools/agent-count.py did not report a register total")
    return int(m.group(1))


def read_tiers(heron, total):
    """{1: n, 2: n, 3: n} - the TOTAL column of agent-count.py's BY TIER table."""
    out = subprocess.run([sys.executable, "tools/agent-count.py"], cwd=heron,
                         capture_output=True, text=True, timeout=300)
    tiers = {int(t): int(n) for t, n in
             re.findall(r"^\s*T([123])\b.*?(\d+)\s*$", out.stdout, re.M)}
    if sorted(tiers) != [1, 2, 3]:
        die("tools/agent-count.py did not report the three tiers")
    if sum(tiers.values()) != total:
        die(f"the tiers add up to {sum(tiers.values())}, not the register's {total}")
    return tiers


# What a tool is allowed to do, in the words the page uses.
RISKS = [
    ("READ", "Only looks", "Reads the model and answers. Changes nothing, ever."),
    ("ANALYZE", "Only looks", "Reads the model and answers. Changes nothing, ever."),
    ("EXECUTE", "Does something you see", "Acts on the session - a selection, a view - "
                                          "and leaves no mark on the model itself."),
    ("MODIFY", "Can change the model", "Behind the padlock on the ribbon. Nothing here "
                                       "runs unless Changes is switched on."),
]


# Three tools that change nothing themselves but hand the modeller something to
# apply in the Companion. Heron's first sentence for each is about the job -
# "Lay sprinklers out" - and under a heading that says these can only look, it
# reads as if the tool did the writing. Each line here says what the same
# docstring says a few sentences on: the tool reads, the page's Apply writes,
# and Apply needs the Changes switch. read_tools() refuses to use a line here
# for a tool that has stopped being a read, so this cannot go quietly stale.
SAY = {
    "revit_sprinkler_layout":
        "Plan sprinklers for the selected Spaces or Rooms and show the layout in the "
        "Companion. Places nothing - placing is the panel's Apply, behind the padlock.",
    "revit_edit_table":
        "Open a table of elements and their parameters in the Companion. Changes "
        "nothing - the edited cells are written by the page's Apply, behind the padlock.",
    "revit_offer_settings":
        "Put a setting's current values in the Companion as a table, without changing "
        "anything - the page's Apply writes them, behind the padlock.",
}


def read_tools(heron):
    """[(name, risk, the first line a host is served)] for every served tool."""
    table = os.path.join(heron, "mcp", "server", "heron_tools.py")
    with open(table, encoding="utf-8") as fh:
        text = fh.read()
    start = text.index("TOOLS = {")
    depth, risks = 0, {}
    pattern = re.compile(r'[{}]|"([a-z_]+)"\s*:\s*\(\s*([A-Z]+)')
    for m in pattern.finditer(text[text.index("{", start):]):
        token = m.group(0)
        if token == "{":
            depth += 1
        elif token == "}":
            depth -= 1
            if depth == 0:
                break
        elif depth == 1 and m.group(1):
            risks[m.group(1)] = m.group(2)
    if not risks:
        die("could not read the TOOLS table in mcp/server/heron_tools.py")

    import ast
    server = os.path.join(heron, "mcp", "server", "heron_mcp_server.py")
    with open(server, encoding="utf-8") as fh:
        tree = ast.parse(fh.read(), server)
    out = []
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        if not any(ast.unparse(d) == "server.tool()" for d in node.decorator_list):
            continue
        doc = " ".join((ast.get_docstring(node) or "").split())
        # No default. A tool missing from the table is one nobody has classed
        # yet, and the page sorts tools into "can only look" and "can change
        # the model": guessing READ is how a new write tool would be listed as
        # harmless.
        if node.name not in risks:
            die(f"{node.name} is served but has no risk in mcp/server/heron_tools.py")
        out.append((node.name, risks[node.name], SAY.get(node.name) or first_sentence(quieten(doc))))
    if not out:
        die("no @server.tool() functions found in mcp/server/heron_mcp_server.py")
    served = {name: risk for name, risk, _ in out}
    for name in SAY:
        if name not in served:
            die(f"SAY has a line for {name}, which Heron no longer serves")
        if served[name] not in ("READ", "ANALYZE"):
            die(f"SAY says {name} changes nothing, but Heron now classes it {served[name]}")
    return out


def read_ribbon(heron):
    """[(label, tooltip, [(label, tooltip) under its arrow])] for the Heron tab.

    Read from the add-in rather than typed, because typing it is how the page
    came to say "5 buttons, and that is the whole ribbon" while the add-in
    already put seven things on it. The words are the tooltips Revit shows.
    """
    path = os.path.join(heron, "revit", "Heron.Revit.Addin", "HeronApplication.cs")
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    lit = r'"((?:[^"\\]|\\.)*)"'
    unq = lambda t: t.replace('\\"', '"').replace("\\n", " ")

    buttons = {}
    for m in re.finditer(r'var (\w+) = new PushButtonData\(\s*"\w+",\s*' + lit, src):
        var = m.group(1)
        tip = re.search(re.escape(var) + r'\.ToolTip\s*=\s*((?:\s*' + lit + r'\s*\+?)+);', src[m.end():])
        if not tip:
            die(f"the {unq(m.group(2))} button has no ToolTip in {path}")
        buttons[var] = (unq(m.group(2)), unq("".join(re.findall(lit, tip.group(1)))))
    if not buttons:
        die(f"no buttons found in {path}")

    items, groups, placed = [], {}, set()
    for m in re.finditer(r'(\w+)\s*=\s*panel\.AddItem\(\s*new SplitButtonData'
                         r'|panel\.AddItem\(\s*(\w+)\s*\)'
                         r'|(\w+)\.AddPushButton\(\s*(\w+)\s*\)', src):
        group, single, owner, member = m.groups()
        if group:
            groups[group] = len(items)
            items.append(None)
        elif single:
            items.append((*buttons[single], []))
            placed.add(single)
        elif owner in groups:
            i = groups[owner]
            if items[i] is None:
                items[i] = (*buttons[member], [])
            else:
                items[i][2].append(buttons[member])
            placed.add(member)
    # A button that is built and never placed means this reader has fallen
    # behind the way the add-in builds its ribbon. Stop rather than list less.
    for var in buttons:
        if var not in placed:
            die(f"the {buttons[var][0]} button is built in {path} but this script "
                "cannot see where it is placed - update read_ribbon()")
    return [i for i in items if i]


# ------------------------------------------------------------------ the page

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def block_numbers(frag, agents, tools, counted):
    total = sum(len(v) for v in frag.values())
    proven = sum(1 for v in frag.values() for _, p in v if p)
    stamp = (f"Counted on {counted:%-d %B %Y}" if counted
             else "Counted from the repository")
    return "\n".join([
        '    <div class="nums reveal">',
        f'      <div><b>{total}</b><span>fragments in the library</span></div>',
        f'      <div><b>{proven}</b><span>of them proved against a real model</span></div>',
        f'      <div><b>{agents}</b><span>agents behind them</span></div>',
        f'      <div><b>{len(tools)}</b><span>tools the chat can call</span></div>',
        '    </div>',
        f'    <p class="numnote">{stamp}, straight from the '
        f'repository rather than typed here &mdash; {total - proven} fragments are still draft, '
        'meaning they have never met a real model. These numbers move as the work moves.</p>',
    ])


def block_fragments(frag):
    out = ['    <ul class="tlist doms">']
    for area, items in sorted(frag.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        proven = sum(1 for _, p in items if p)
        draft = len(items) - proven
        first = ", ".join(esc(n) for n, _ in items[:3])
        tail = "all proven" if not draft else (
            "proven" if len(items) == 1 else f"{proven} proven, {draft} still draft")
        chips = "".join(
            f'<i>{esc(n)}</i>' if p else f'<i class="d">{esc(n)}</i>' for n, p in items)
        out += [
            '      <li><details>',
            f'        <summary><b>{area} <em>&middot; {len(items)}</em></b>'
            f'<span>{first}&hellip; <em>&middot; {tail}</em></span></summary>',
            f'        <div class="frags">{chips}</div>',
            '      </details></li>',
        ]
    out.append('    </ul>')
    return "\n".join(out)


def block_skills(skills):
    out = []
    for area, items in sorted(skills.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        out += [
            '  <div class="pgrp reveal">',
            f'    <h3>{area} <i>{len(items)}</i></h3>',
            '    <ul class="tlist">',
        ]
        for name, purpose, said, risk in items:
            says = ""
            if said:
                quoted = " &middot; ".join(f"&ldquo;{esc(s)}&rdquo;" for s in said)
                says = f" <em>{quoted}</em>"
            note = f'<span>{esc(purpose)}{says}</span>' if purpose or says else ""
            out.append(f'      <li><b>{esc(name)}</b>{note}</li>')
        out += ['    </ul>', '  </div>', '']
    return "\n".join(out).rstrip()


def block_ribbon(ribbon):
    out = ['    <ul class="tlist">']
    for label, tip, under in ribbon:
        extra = "".join(f" <em>Under its arrow: {esc(l)}</em> &mdash; {esc(t)}" for l, t in under)
        out.append(f'      <li><b>{esc(label)}</b><span>{esc(tip)}{extra}</span></li>')
    out.append('    </ul>')
    return "\n".join(out)


def block_tools(tools):
    """Grouped by what a tool is allowed to do, which is the whole safety
    story of this page: most of them cannot touch the model at all."""
    out, written = [], []
    for risk, title, note in RISKS:
        if title in written:
            continue
        written.append(title)
        risks_here = [r for r, t, _ in RISKS if t == title]
        items = sorted(t for t in tools if t[1] in risks_here)
        if not items:
            continue
        out += [
            '  <div class="pgrp reveal">',
            f'    <h3>{title} <i>{len(items)}</i></h3>',
            f'    <p>{note}</p>',
            '    <ul class="tlist">',
        ]
        for name, _, doc in items:
            out.append(f'      <li><b>{esc(name)}</b><span>{esc(doc)}</span></li>')
        out += ['    </ul>', '  </div>', '']
    return "\n".join(out).rstrip()


def heading(count, areas, noun):
    return f'{count} {noun} &middot; {areas} area{"" if areas == 1 else "s"} of Revit'


def rewrite(page, heron):
    frag = read_fragments(heron)
    skills = read_skills(heron)
    agents = read_agents(heron)
    tools = read_tools(heron)
    ribbon = read_ribbon(heron)
    tiers = read_tiers(heron, agents)
    total = sum(len(v) for v in frag.values())
    proven = sum(1 for v in frag.values() for _, p in v if p)

    looks = sum(1 for _, r, _ in tools if r in ("READ", "ANALYZE"))
    changes = sum(1 for _, r, _ in tools if r == "MODIFY")
    blocks = {
        "numbers": block_numbers(frag, agents, tools, counted_on(heron)),
        "fragments": block_fragments(frag),
        "skills": block_skills(skills),
        "tools": block_tools(tools),
        "ribbon": block_ribbon(ribbon),
        # Figures the prose states. Each was typed once and then sat there
        # while the work moved: "329 have one, 66 do not" under a heading
        # that said 534 of 605.
        "fragments-total": str(total),
        "proven-n": str(proven),
        "draft-n": str(total - proven),
        "agents-total": str(agents),
        "tier-1": str(tiers[1]),
        "tier-2": str(tiers[2]),
        "tier-3": str(tiers[3]),
        "ribbon-heading": f"{len(ribbon)} on the ribbon",
        "skills-heading": heading(sum(len(v) for v in skills.values()), len(skills), "skills"),
        "fragments-heading": heading(sum(len(v) for v in frag.values()), len(frag), "fragments"),
        "tools-heading": f"{len(tools)} tools &middot; {looks} of them can only look",
        "skills-count": str(sum(len(v) for v in skills.values())),
        "proven-count": "%d of %d" % (
            sum(1 for v in frag.values() for _, p in v if p),
            sum(len(v) for v in frag.values())),
        "tools-note": f"Of the {len(tools)} tools the chat can call, {looks} can only read "
                      f"and answer. {changes} can change the model, and not one of them runs "
                      f"unless the padlock on the ribbon is open.",
    }
    for name, body in blocks.items():
        pattern = re.compile(
            rf"(<!-- heron:{name} -->).*?(<!-- /heron:{name} -->)", re.S)
        if not pattern.search(page):
            die(f"the page has no <!-- heron:{name} --> markers")
        page = pattern.sub(lambda m: f"{m.group(1)}\n{body}\n{m.group(2)}"
                           if "\n" in body else f"{m.group(1)}{body}{m.group(2)}", page)
    return page


def main(argv):
    check = "--check" in argv
    rest = [a for a in argv if not a.startswith("-")]
    heron = os.path.abspath(rest[0]) if rest else os.path.join(ROOT, "..", "Heron-AI")
    if not os.path.isdir(heron):
        die(f"no Heron-AI checkout at {heron} - pass its path as the first argument")

    with open(PAGE, encoding="utf-8") as fh:
        before = fh.read()
    after = rewrite(before, heron)

    if after == before:
        print("/heron-ai/ already matches the repository.")
        return 0
    if check:
        print("ERROR:   /heron-ai/ is out of date with the Heron-AI repository.")
        print("\nRun: python3 tools/update_heron.py <path to Heron-AI>")
        return 1
    with open(PAGE, "w", encoding="utf-8") as fh:
        fh.write(after)
    print("/heron-ai/ rewritten from", heron)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
