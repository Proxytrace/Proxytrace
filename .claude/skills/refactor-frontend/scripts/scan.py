#!/usr/bin/env python3
"""Scan the Trsr frontend for refactoring candidates.

Emits a ranked table of files that violate BEST_PRACTICES.md, scored by the
smells the guide cares about (oversized files, multiple components per file,
inline SVGs, raw useQuery in pages, stray useEffect, inline styles, any/as-any).

Pure stdlib, no deps. Run from the repo root or from frontend/.

    python3 scan.py                 # human table, worst first
    python3 scan.py --json          # machine-readable, for building the plan
    python3 scan.py --top 15        # limit rows
    python3 scan.py --path some/dir # scan a specific subtree

The score is a smell proxy, not a verdict. Read the flagged file before acting:
a 320-line file that is genuinely one cohesive component may be fine; a 180-line
file with 6 components and 4 useEffects is not. Use the per-signal columns, not
just the total.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# --- signal patterns -------------------------------------------------------
# Heuristics, deliberately simple. They over- and under-count at the margins;
# they exist to rank, not to adjudicate.
RE_COMPONENT_LINE = re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*[:=].*=>)")
RE_INLINE_STYLE = re.compile(r"style=\{\{")
RE_RAW_QUERY = re.compile(r"\buse(?:Query|Mutation|InfiniteQuery)\s*\(")
RE_INLINE_SVG = re.compile(r"<svg\b")
RE_USE_EFFECT = re.compile(r"\buseEffect\s*\(")
RE_ANY = re.compile(r":\s*any\b|\bas\s+any\b")
# non-null assertion: ident! or )! not part of != / !== / !!. Best-effort.
RE_NONNULL = re.compile(r"[\w\)\]]\!(?![=\!])")

# Hard limits from BEST_PRACTICES.md §1.
FILE_HARD = 300
FILE_SOFT = 200
COMPONENTS_PER_FILE = 2  # rule: >2 component functions in one file -> split

WEIGHTS = {
    "over_hard": 6.0,      # per 100 lines beyond the hard limit
    "over_soft": 1.5,      # per 100 lines between soft and hard
    "extra_components": 4.0,  # per component fn beyond the allowed 2
    "inline_style": 0.4,
    "raw_query": 1.5,
    "inline_svg": 2.0,
    "use_effect": 1.0,
    "any": 5.0,            # forbidden outright
    "nonnull": 5.0,        # forbidden outright
}


def is_page(path: str) -> bool:
    """A feature page: features/<f>/<Feature>.tsx. Raw queries here are worse."""
    parts = path.replace("\\", "/").split("/")
    if "features" not in parts:
        return False
    name = os.path.basename(path)
    return name[:1].isupper() and name.endswith(".tsx")


def analyze(path: str) -> dict:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    lines = text.count("\n") + 1
    # Count PascalCase function/const declarations, but skip lazy route consts
    # (`const Page = lazy(...)`) and styled/hoc factories — they are not the
    # multiple-components-per-file smell the rule targets.
    comps = sum(
        1 for ln in text.splitlines()
        if RE_COMPONENT_LINE.match(ln) and "lazy(" not in ln
    )
    inline_style = len(RE_INLINE_STYLE.findall(text))
    raw_query = len(RE_RAW_QUERY.findall(text))
    inline_svg = len(RE_INLINE_SVG.findall(text))
    use_effect = len(RE_USE_EFFECT.findall(text))
    anys = len(RE_ANY.findall(text))
    nonnull = len(RE_NONNULL.findall(text))

    score = 0.0
    reasons: list[str] = []
    if lines > FILE_HARD:
        score += WEIGHTS["over_hard"] * (lines - FILE_HARD) / 100
        reasons.append(f"{lines} lines (>{FILE_HARD} hard limit)")
    elif lines > FILE_SOFT:
        score += WEIGHTS["over_soft"] * (lines - FILE_SOFT) / 100
        reasons.append(f"{lines} lines (>{FILE_SOFT} soft)")
    if comps > COMPONENTS_PER_FILE:
        extra = comps - COMPONENTS_PER_FILE
        score += WEIGHTS["extra_components"] * extra
        reasons.append(f"{comps} component fns (>2 -> split)")
    if inline_style:
        score += WEIGHTS["inline_style"] * inline_style
        reasons.append(f"{inline_style} inline style={{}}")
    if raw_query:
        mult = 1.6 if is_page(path) else 1.0
        score += WEIGHTS["raw_query"] * raw_query * mult
        where = "in page" if is_page(path) else ""
        reasons.append(f"{raw_query} raw useQuery/useMutation {where}".strip())
    if inline_svg:
        score += WEIGHTS["inline_svg"] * inline_svg
        reasons.append(f"{inline_svg} inline <svg>")
    if use_effect:
        score += WEIGHTS["use_effect"] * use_effect
        reasons.append(f"{use_effect} useEffect")
    if anys:
        score += WEIGHTS["any"] * anys
        reasons.append(f"{anys} any/as-any (forbidden)")
    if nonnull:
        score += WEIGHTS["nonnull"] * nonnull
        reasons.append(f"{nonnull} non-null '!' (forbidden)")

    return {
        "path": path,
        "lines": lines,
        "components": comps,
        "inline_style": inline_style,
        "raw_query": raw_query,
        "inline_svg": inline_svg,
        "use_effect": use_effect,
        "any": anys,
        "nonnull": nonnull,
        "score": round(score, 1),
        "reasons": reasons,
    }


def resolve_root(path_arg: str | None) -> str:
    if path_arg:
        return path_arg
    for cand in ("frontend/src", "src"):
        if os.path.isdir(cand):
            return cand
    sys.exit("could not find frontend/src or src; pass --path")


def main() -> None:
    ap = argparse.ArgumentParser(description="Rank frontend refactoring candidates.")
    ap.add_argument("--path", help="subtree to scan (default: frontend/src or src)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    ap.add_argument("--top", type=int, default=30, help="rows to show (default 30)")
    ap.add_argument("--all", action="store_true", help="include files with score 0")
    args = ap.parse_args()

    root = resolve_root(args.path)
    results = []
    for dirpath, _dirs, files in os.walk(root):
        if "node_modules" in dirpath or "/dist" in dirpath:
            continue
        for f in files:
            if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts"):
                results.append(analyze(os.path.join(dirpath, f)))

    results.sort(key=lambda r: r["score"], reverse=True)
    if not args.all:
        results = [r for r in results if r["score"] > 0]
    results = results[: args.top]

    if args.json:
        print(json.dumps(results, indent=2))
        return

    if not results:
        print("No candidates found. Frontend is clean by these signals.")
        return

    print(f"{'SCORE':>6}  {'LINES':>5}  {'CMP':>3}  {'STY':>3}  {'QRY':>3}  "
          f"{'SVG':>3}  {'EFF':>3}  {'ANY':>3}  {'!':>2}  FILE")
    print("-" * 100)
    for r in results:
        print(f"{r['score']:>6}  {r['lines']:>5}  {r['components']:>3}  "
              f"{r['inline_style']:>3}  {r['raw_query']:>3}  {r['inline_svg']:>3}  "
              f"{r['use_effect']:>3}  {r['any']:>3}  {r['nonnull']:>2}  {r['path']}")
    print()
    print("Legend: CMP=component fns  STY=inline style  QRY=raw useQuery/Mutation")
    print("        SVG=inline <svg>  EFF=useEffect  ANY=any/as-any  !=non-null assert")
    print("Top reasons:")
    for r in results[:8]:
        print(f"  {r['path']}: {'; '.join(r['reasons'])}")


if __name__ == "__main__":
    main()
