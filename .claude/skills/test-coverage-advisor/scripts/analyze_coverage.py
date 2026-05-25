#!/usr/bin/env python3
"""Fuse cobertura coverage with public-API, churn, and complexity signals.

Emits a single Markdown report on stdout: overall summary, per-layer table, and
a ranked list of files that most deserve more tests.

Designed to be run from the repo root with TestResults/ already populated by
`dotnet test --collect:"XPlat Code Coverage"`.
"""

from __future__ import annotations

import argparse
import glob
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# Files we never want to rank. Mirrors coverage.runsettings ExcludeByFile.
DEFAULT_EXCLUDE_PATTERNS = [
    re.compile(r"/Migrations/"),
    re.compile(r"\.Designer\.cs$"),
    re.compile(r"/Program\.cs$"),
    re.compile(r"/obj/"),
    re.compile(r"/bin/"),
]
TEST_PROJECT_PATTERN = re.compile(r"\.Tests/")

# Heuristic regex for public methods, ctors, and bodied properties.
# Captures the line each public member starts on. Not Roslyn-grade but
# good enough to rank.
PUBLIC_MEMBER_RE = re.compile(
    r"^\s*public\s+(?!class\b|record\b|interface\b|enum\b|struct\b|delegate\b|static\s+class\b|abstract\s+class\b|sealed\s+class\b)"
    r"[^;{=]*?(\w+\s*\([^)]*\)|\w+\s*\{)\s*$",
    re.MULTILINE,
)
COMPLEXITY_TOKENS = re.compile(
    r"\b(if|else\s+if|for|foreach|while|case|catch)\b|&&|\|\||\?[^:]"
)


@dataclass
class FileStats:
    path: str
    covered_lines: set[int] = field(default_factory=set)
    total_lines: set[int] = field(default_factory=set)
    covered_branches: int = 0
    total_branches: int = 0
    public_members: int = 0
    uncovered_public_members: int = 0
    churn: int = 0
    complexity: int = 0

    @property
    def line_cov(self) -> float:
        return len(self.covered_lines) / len(self.total_lines) if self.total_lines else 0.0

    @property
    def branch_cov(self) -> float:
        return self.covered_branches / self.total_branches if self.total_branches else 0.0


def is_excluded(path: str, include_tests: bool) -> bool:
    if not include_tests and TEST_PROJECT_PATTERN.search(path):
        return True
    return any(p.search(path) for p in DEFAULT_EXCLUDE_PATTERNS)


def parse_cobertura(results_dir: str, repo_root: str, include_tests: bool) -> dict[str, FileStats]:
    """Read every coverage.cobertura.xml under results_dir and merge by file."""
    files: dict[str, FileStats] = {}
    xml_paths = glob.glob(os.path.join(results_dir, "**", "coverage.cobertura.xml"), recursive=True)
    if not xml_paths:
        return files

    repo_root_abs = os.path.abspath(repo_root)

    for xml_path in xml_paths:
        try:
            root = ET.parse(xml_path).getroot()
        except ET.ParseError:
            continue
        for cls in root.iter("class"):
            filename = cls.get("filename")
            if not filename:
                continue
            # Normalize to a repo-root-relative path so the same file from
            # different test projects merges into one record.
            abs_path = os.path.abspath(filename if os.path.isabs(filename) else os.path.join(repo_root_abs, filename))
            try:
                rel = os.path.relpath(abs_path, repo_root_abs)
            except ValueError:
                rel = filename
            rel = rel.replace(os.sep, "/")
            if is_excluded(rel, include_tests):
                continue
            stats = files.setdefault(rel, FileStats(path=rel))
            for line in cls.iter("line"):
                try:
                    num = int(line.get("number"))
                    hits = int(line.get("hits", "0"))
                except (TypeError, ValueError):
                    continue
                stats.total_lines.add(num)
                if hits > 0:
                    stats.covered_lines.add(num)
                cond = line.get("condition-coverage")
                if cond:
                    # Format: "50% (1/2)"
                    m = re.search(r"\((\d+)/(\d+)\)", cond)
                    if m:
                        stats.covered_branches += int(m.group(1))
                        stats.total_branches += int(m.group(2))
    return files


def gather_public_api(stats: FileStats, repo_root: str) -> None:
    full = os.path.join(repo_root, stats.path)
    if not os.path.isfile(full):
        return
    try:
        text = Path(full).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return
    line_offsets = [0]
    for ch in text:
        if ch == "\n":
            line_offsets.append(line_offsets[-1] + 1)
    member_lines: list[int] = []
    for m in PUBLIC_MEMBER_RE.finditer(text):
        # Convert offset to 1-based line number.
        offset = m.start()
        line_no = text.count("\n", 0, offset) + 1
        member_lines.append(line_no)
    stats.public_members = len(member_lines)
    # A member is "uncovered" if its starting line is in the total set
    # (i.e. instrumented) but not in the covered set, OR the member body's
    # opening line is not instrumented at all (often means dead/unreached).
    for line_no in member_lines:
        # check a small window for the body
        body_lines = {line_no, line_no + 1, line_no + 2}
        hit = any(bl in stats.covered_lines for bl in body_lines)
        if not hit:
            stats.uncovered_public_members += 1


def gather_complexity(stats: FileStats, repo_root: str) -> None:
    full = os.path.join(repo_root, stats.path)
    if not os.path.isfile(full):
        return
    try:
        text = Path(full).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return
    stats.complexity = len(COMPLEXITY_TOKENS.findall(text))


def gather_churn(stats_by_path: dict[str, FileStats], repo_root: str, days: int) -> None:
    try:
        result = subprocess.run(
            ["git", "-C", repo_root, "log", f"--since={days}.days", "--pretty=format:", "--name-only", "--", "*.cs"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return
    if result.returncode != 0:
        return
    counts: dict[str, int] = defaultdict(int)
    for line in result.stdout.splitlines():
        line = line.strip()
        if line:
            counts[line.replace(os.sep, "/")] += 1
    for rel, stats in stats_by_path.items():
        stats.churn = counts.get(rel, 0)


def layer_of(path: str) -> str:
    for part in path.split("/"):
        if part.startswith("Proxytrace."):
            return part
    return "other"


def normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    mx = max(values)
    if mx == 0:
        return [0.0 for _ in values]
    return [v / mx for v in values]


def rank(files: list[FileStats]) -> list[tuple[FileStats, float]]:
    if not files:
        return []
    churn_norm = dict(zip([f.path for f in files], normalize([f.churn for f in files])))
    cx_norm = dict(zip([f.path for f in files], normalize([f.complexity for f in files])))
    api_norm = dict(zip([f.path for f in files], normalize([f.uncovered_public_members for f in files])))
    scored: list[tuple[FileStats, float]] = []
    for f in files:
        gap = 1.0 - f.line_cov
        score = gap * (1 + churn_norm[f.path]) * (1 + cx_norm[f.path]) * (1 + api_norm[f.path])
        scored.append((f, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def pct(n: float) -> str:
    return f"{n * 100:5.1f}%"


def render_report(files: dict[str, FileStats], top: int, churn_days: int) -> str:
    out: list[str] = []
    file_list = list(files.values())
    if not file_list:
        return "_No coverage data found. Run `dotnet test --collect:\"XPlat Code Coverage\"` first._"

    total_lines = sum(len(f.total_lines) for f in file_list)
    covered_lines = sum(len(f.covered_lines) for f in file_list)
    total_br = sum(f.total_branches for f in file_list)
    covered_br = sum(f.covered_branches for f in file_list)
    overall_line = covered_lines / total_lines if total_lines else 0
    overall_br = covered_br / total_br if total_br else 0

    out.append("## Coverage summary")
    out.append("")
    out.append(f"- Files analyzed: **{len(file_list)}**")
    out.append(f"- Overall line coverage: **{pct(overall_line)}** ({covered_lines}/{total_lines})")
    out.append(f"- Overall branch coverage: **{pct(overall_br)}** ({covered_br}/{total_br})")
    out.append(f"- Churn window: last **{churn_days} days** of git history")
    out.append("")

    # Per-layer rollup
    layers: dict[str, list[FileStats]] = defaultdict(list)
    for f in file_list:
        layers[layer_of(f.path)].append(f)
    out.append("## By layer")
    out.append("")
    out.append("| Layer | Files | Line cov | Branch cov |")
    out.append("|---|---:|---:|---:|")
    for layer in sorted(layers):
        lf = layers[layer]
        tl = sum(len(f.total_lines) for f in lf)
        cl = sum(len(f.covered_lines) for f in lf)
        tb = sum(f.total_branches for f in lf)
        cb = sum(f.covered_branches for f in lf)
        out.append(
            f"| {layer} | {len(lf)} | {pct(cl/tl if tl else 0)} | {pct(cb/tb if tb else 0)} |"
        )
    out.append("")

    # Ranked recommendations
    scored = rank(file_list)
    out.append(f"## Top {top} files to test next")
    out.append("")
    out.append("Ranked by `(1 - line_cov) * (1 + churn) * (1 + complexity) * (1 + uncovered_public_api)`.")
    out.append("")
    out.append("| # | File | Line | Branch | Pub API uncov | Churn | Cx | Score |")
    out.append("|---:|---|---:|---:|---:|---:|---:|---:|")
    for i, (f, score) in enumerate(scored[:top], 1):
        pub = f"{f.uncovered_public_members}/{f.public_members}" if f.public_members else "—"
        out.append(
            f"| {i} | `{f.path}` | {pct(f.line_cov)} | {pct(f.branch_cov)} | {pub} | {f.churn} | {f.complexity} | {score:.2f} |"
        )
    out.append("")

    # Zero-coverage public surfaces — worth calling out separately
    untested_with_public = [f for f in file_list if f.line_cov == 0 and f.public_members > 0]
    if untested_with_public:
        untested_with_public.sort(key=lambda f: (-f.public_members, f.path))
        out.append("## Files with public API and zero coverage")
        out.append("")
        for f in untested_with_public[: max(5, top // 2)]:
            out.append(f"- `{f.path}` — {f.public_members} public members, complexity {f.complexity}, churn {f.churn}")
        out.append("")

    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", default="TestResults")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--churn-days", type=int, default=90)
    ap.add_argument("--include-tests", action="store_true")
    args = ap.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    files = parse_cobertura(args.results_dir, repo_root, args.include_tests)
    if not files:
        print(
            f"_No coverage.cobertura.xml files found under {args.results_dir}. "
            f"Run `dotnet test --collect:\"XPlat Code Coverage\"` first._"
        )
        return 1

    for stats in files.values():
        gather_public_api(stats, repo_root)
        gather_complexity(stats, repo_root)
    gather_churn(files, repo_root, args.churn_days)

    print(render_report(files, args.top, args.churn_days))
    return 0


if __name__ == "__main__":
    sys.exit(main())
