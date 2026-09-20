#!/usr/bin/env python3
"""Keep the hardcoded years-of-experience honest.

The VISIBLE "11 years" on every page already computes itself: assets/app.js
fills any [data-yrs] element from a May 2015 start date. That markup reads
`<span data-yrs>11</span> years`, so the literal string "11 years" never
appears for it - which is exactly why the regex below cannot touch it.

What app.js cannot reach is the text a crawler reads without running any
JavaScript: the JSON-LD Person description, hasOccupation.experienceRequirements,
and the meta / og: / twitter: descriptions. Those sat at "11 years" in ten
files, correct on the day they were typed and wrong every May afterwards with
nothing to catch it.

So they are rewritten here instead, in the file, at rest. A runtime fix would
have left the raw HTML stale for precisely the readers that matter.

    python tools/update_years.py           # rewrite, report what changed
    python tools/update_years.py --check    # touch nothing, exit 1 if stale

--check is what CI runs, so a stale year fails the build rather than waiting
to be noticed.
"""

import os
import re
import sys
from datetime import date

# Ajmal started in Doha in May 2015. The same constant lives in assets/app.js;
# if one moves the other has to, and --check will not notice because both
# sides would agree on the wrong number.
START = date(2015, 5, 1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# "11 years" wherever it is literal text. The data-yrs spans are immune by
# construction - a tag sits between the number and the word - and that is
# load-bearing, not luck. Two digits only: a four-digit match would eat a year.
PATTERN = re.compile(r"\b\d{1,2} years\b")


def years_since(start: date, today: date) -> int:
    """Whole years elapsed, the same arithmetic app.js does."""
    y = today.year - start.year
    if (today.month, today.day) < (start.month, start.day):
        y -= 1
    return y


def html_files() -> list:
    found = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "vendor", "__printout")]
        for name in files:
            if name.endswith(".html"):
                found.append(os.path.join(base, name))
    return sorted(found)


def main() -> int:
    check_only = "--check" in sys.argv
    years = years_since(START, date.today())
    want = "%d years" % years

    stale = []
    for path in html_files():
        with open(path, encoding="utf-8") as fh:
            src = fh.read()

        hits = PATTERN.findall(src)
        wrong = [h for h in hits if h != want]
        if not wrong:
            continue

        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        stale.append((rel, sorted(set(wrong)), len(wrong)))

        if not check_only:
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.write(PATTERN.sub(want, src))

    if not stale:
        print("Years clean. Every hardcoded figure says %s." % want)
        return 0

    verb = "would be rewritten" if check_only else "rewritten"
    for rel, wrong, count in stale:
        print("  %-42s %s -> %s  (%d)" % (rel, ", ".join(wrong), want, count))

    if check_only:
        print("\n%d file(s) carry a stale year. Run: python tools/update_years.py" % len(stale))
        return 1

    print("\n%d file(s) %s to %s." % (len(stale), verb, want))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
