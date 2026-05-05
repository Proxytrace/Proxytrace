---
description: Plan refactoring operations for a given component, module, or subsystem and write a prioritized todo list into REFACTORING-TODO.md
argument-hint: <component|module|directory>
---

Analyze `$ARGUMENTS` for refactoring opportunities and update `REFACTORING-TODO.md` at the repo root.

## Step 1 — Explore the scope

Resolve `$ARGUMENTS` to concrete file paths. Read the relevant files thoroughly. Look for:

- Files that are very long (>300 lines) compared to their peers
- Repeated logic copy-pasted across multiple files
- Inlined sub-components or helpers that belong in shared abstractions
- Naming inconsistencies or ambiguous identifiers
- Layering violations (e.g. storage types leaking into domain, data access in layout components)
- Dead code, commented-out blocks, or in-source TODO comments
- Missing validation at system boundaries
- Hardcoded values that should be configurable
- Missing, thin, or misdirected tests
- Performance anti-patterns (N+1 queries, redundant renders, synchronous blocking on async paths)

## Step 2 — Rank the findings

Group findings into actionable items with a priority:

- **P1 — Correctness / reliability risk**: bugs waiting to happen, missing validation, race conditions
- **P2 — Maintainability blocker**: anything that makes the next feature significantly harder to add
- **P3 — Cleanup / quality**: duplication removal, naming, file splits, style consistency
- **P4 — Nice-to-have**: minor optimizations, cosmetic improvements

Within each priority group, order by impact descending.

## Step 3 — Write REFACTORING-TODO.md

Read the current `REFACTORING-TODO.md` (it may not exist yet).

- **File does not exist:** create it with a fresh numbered list for `$ARGUMENTS`.
- **File exists:**
  - Keep all items that cover scope *outside* `$ARGUMENTS`.
  - Replace or merge items that overlap with `$ARGUMENTS` — no duplicates.
  - Insert new items in priority order relative to existing ones and re-number the entire list.
  - Preserve the completion status of any already-finished items.

Each item must follow this format:

```markdown
## N. [Short imperative title]

**Scope:** `path/to/file.ext` (or directory / layer)
**Priority:** P1 | P2 | P3 | P4

[One or two sentences describing the observed problem.]

**Approach:**
- Concrete bullet describing what to change
- Additional bullet if needed
```

## Step 4 — Report back

After writing the file, tell the user:

1. How many items were added, updated, or removed.
2. The top 2–3 most impactful items (title + one sentence each).
3. Any files explicitly excluded from analysis (auto-generated, vendored, out of scope).

Do not implement any of the refactoring items. This skill produces a plan only.
