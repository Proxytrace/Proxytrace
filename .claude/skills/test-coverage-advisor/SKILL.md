---
name: test-coverage-advisor
description: Discovers test coverage for a .NET solution and produces a prioritized list of recommendations on where to add tests. Use this skill whenever the user asks about test coverage, low-tested code, where to add tests next, coverage gaps, untested public API, "what's not covered", "do we have enough tests", or wants a coverage report — even if they don't say the word "coverage" explicitly. Also use it when the user mentions improving test quality, a coverage push, or sprint planning around testing for a .NET / dotnet repo.
---

# Test Coverage Advisor

Produce a prioritized, signal-rich coverage report for a .NET solution. The report is delivered inline in the conversation — no files are written. It ranks gaps using four signals: line/branch coverage, untested public API surface, recent git churn, and code complexity.

## When this skill applies

Trigger this skill any time the user wants to understand, audit, or improve test coverage on a .NET solution. Typical user phrasings:

- "Where should I add tests?"
- "What's our coverage looking like?"
- "Which files are most under-tested?"
- "Audit test coverage for this repo."
- "Plan a testing sprint."

It also applies in adjacent framings — code quality reviews, pre-release checklists, or onboarding briefings — whenever the user wants to know what is risky and untested.

## Workflow

Always follow this order. The steps are cheap individually and the analyzer fuses them; skipping a step degrades the recommendations.

### 1. Locate or generate coverage data

Look for an existing `coverage.runsettings` at the repo root and a `scripts/coverage.sh` (or equivalent). If they exist, prefer them — they likely encode the repo's exclusions.

```bash
bash scripts/coverage.sh
```

If the repo has no coverage script, fall back to the canonical incantation. Coverlet's `XPlat Code Coverage` collector ships with the .NET SDK, so no extra install is required for cobertura output.

```bash
dotnet test <Solution>.sln \
  --collect:"XPlat Code Coverage" \
  --results-directory TestResults \
  --logger "console;verbosity=minimal"
```

This drops one `coverage.cobertura.xml` per test project under `TestResults/<guid>/`.

**Use existing results only if they are fresh** (mtime within the current session, or the user confirms). Coverage gets stale fast and silently misleads recommendations.

### 2. Run the analyzer

The analyzer fuses coverage + public-API + churn + complexity into a single ranked report.

```bash
python3 .claude/skills/test-coverage-advisor/scripts/analyze_coverage.py \
  --results-dir TestResults \
  --repo-root . \
  --top 15
```

Flags worth knowing:

- `--top N` — how many ranked recommendations to surface (default 15). For a quick "headline" view use `--top 5`.
- `--churn-days N` — git history window for the churn signal (default 90). Shrink for hot-area focus, widen for a long-tail audit.
- `--include-tests` — by default the analyzer ignores `*.Tests` / `Migrations` / `*.Designer.cs` / `Program.cs` (matching `coverage.runsettings`). Only pass this if the user wants to inspect the test code itself.

The script emits Markdown to stdout: an overall summary table, per-layer breakdown, and the ranked list. Stream it back to the user as the body of your reply.

### 3. Interpret, don't just paste

The script gives data; **you** give the recommendation. After printing the table, add a short narrative section:

- Name the **top 3 concrete files or types** the user should tackle first, and **why** — phrase it in terms of the actual signals (e.g., "public surface of `OptimizationProposalService` is 80% untested and it changed in 6 of the last 20 commits").
- Call out **layer-level imbalances** ("Trsr.Application is at 42% but Trsr.Domain is at 91% — the orchestration layer is doing the most and is least tested").
- If churn is concentrated in a low-coverage area, flag it as a **regression risk**, not a coverage chore.
- If a high-complexity file has zero tests, treat it as **higher priority than a larger file with light tests** — uncovered branches in dense code hide real bugs.

Avoid generic advice. "Add more tests to X" is useless. "The five public methods on `AgentCallIngestor` listed below are entry points with zero coverage; start with `IngestAsync` because it owns the parse-and-persist pipeline" is the bar.

### 4. Offer a next step

Close the report with one of:

- A proposal to draft tests for the top-ranked file (offer, don't auto-do).
- A pointer to look at the per-layer table if the user is doing planning rather than execution.
- A note on what would sharpen the next run (e.g., "if you commit your in-flight WIP, the churn signal will be more accurate").

## Signal definitions (what the analyzer measures)

So you can explain the report when asked:

- **Line / branch coverage** — read directly from cobertura `<line>` and `<branch>` elements. Excludes files matching the repo's `ExcludeByFile` patterns and any class with `[GeneratedCode]` / `[CompilerGenerated]`.
- **Uncovered public API** — counts `public`-modifier methods, properties (with bodies), and constructors in each `.cs` file via a regex-driven scan. Cross-references their line ranges against the covered-line set to flag entirely-uncovered public members. This is a heuristic, not Roslyn; it will occasionally miscount expression-bodied members or multi-line signatures, but it's right often enough to rank usefully.
- **Churn** — `git log --since="<N> days" --pretty=format: --name-only -- '*.cs'` counted per file. Files with zero commits in the window get a churn score of 0.
- **Complexity** — heuristic cyclomatic count: occurrences of `if`, `else if`, `for`, `foreach`, `while`, `case`, `catch`, `&&`, `||`, `?:` per file. Cheap, correlates well enough with real complexity to rank.

The priority score is roughly `(1 - line_cov) * (1 + churn_norm) * (1 + complexity_norm) * (1 + public_api_uncovered_norm)`. The formula is in the script; tweak there if you need to re-weight.

## Output expectations

Always include in your reply:

1. The Markdown table the analyzer prints (verbatim is fine).
2. A short interpretation paragraph (3–6 sentences) that calls out the top 1–3 priorities by name with reasons.
3. A single offered next step.

Do **not**:

- Write a `coverage-report.md` file or any artifact unless the user asks.
- Pretty-print the cobertura XML or paste raw test logs.
- Recommend specific test method names — leave that for the follow-up where you actually draft the tests.

## Edge cases

- **No tests have ever run**: if `TestResults/` is empty even after the script runs, surface the build/test failures from `dotnet test` and stop. Don't fabricate a coverage report.
- **No git history** (fresh clone, shallow checkout): churn signal returns zeros. Note this in the report so the user knows the ranking is missing one dimension.
- **Frontend in the repo**: this skill targets .NET only. If the user asks about frontend coverage too, say so and offer to run `npm test -- --coverage` separately; do not try to fuse the two in one report.
- **Multiple solutions in the repo**: ask which one before running. Don't guess.
