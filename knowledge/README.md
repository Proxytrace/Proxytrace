# Software Design Knowledge Base

Transferable design knowledge distilled from this project, written to be reused in **future,
unrelated projects**. Each guide is abstracted away from this product: principles and patterns
first, with concrete technologies (C#, EF Core, React, Lingui, …) appearing only as illustrations
of one possible instantiation. Every pattern states the failure mode it prevents, and every guide
ends with a checklist for applying it to a new project.

## Guides

### Backend design

| Guide | Topic |
|-------|-------|
| [architecture.md](architecture.md) | Onion architecture: concentric rings, inward-only dependencies, immutable interface-abstracted core, per-project DI modules, ports & adapters, lean deployables |
| [domain-modeling.md](domain-modeling.md) | Immutable, interface-abstracted entities (with full worked example), update-by-reconstruction, factory delegates, FK conventions, domain validation, living glossary |
| [persistence.md](persistence.md) | Provider abstraction over multiple DB engines, migration discipline, domain/ORM split, indexing, concurrency |
| [coding-conventions.md](coding-conventions.md) | Codified style: nullable discipline, guard clauses, warnings-as-errors, lint as the only gate |

### Quality & operations

| Guide | Topic |
|-------|-------|
| [testing.md](testing.md) | Layered test strategy: unit/integration/e2e/perf, harness as fixture, real-stack e2e, failure triage |
| [performance.md](performance.md) | Perf budgets in version control, seeded at-scale perf suite, why tiny-dataset tests miss scale bugs |
| [observability.md](observability.md) | Audit logging pipeline (capture, immutable storage, retention, read API) and notification channels |
| [release-engineering.md](release-engineering.md) | Changelog-in-the-same-change, tag-triggered releases, versioned artifacts, update checks, rc prereleases |

### Security & product control

| Guide | Topic |
|-------|-------|
| [security.md](security.md) | At-rest secret protection behind seams, blind indexes, key-ring lifecycle, backfills, MFA/TOTP, debug-only affordances |
| [feature-gating.md](feature-gating.md) | License/tier gating: single gate interface, tiers as data, graceful degradation, tier-matrix testing |

### Frontend & UX

| Guide | Topic |
|-------|-------|
| [frontend.md](frontend.md) | Written visual system, lint-enforced UI primitives layer, feature folders, hook-isolated data fetching |
| [i18n.md](i18n.md) | Internationalization as day-one architecture: message macros, extraction pipeline, committed catalogs |
| [realtime-events.md](realtime-events.md) | Server-push (SSE/WebSocket) design: broadcaster abstraction, typed events, thin payloads + refetch |

### Process & knowledge

| Guide | Topic |
|-------|-------|
| [documentation.md](documentation.md) | Docs treated like tests, index tables with read-before triggers, contributor vs user-manual audiences |
| [ai-assisted-development.md](ai-assisted-development.md) | Structuring a repo for AI assistants: short root instruction file, executable skills, enforceable invariants |

## How to use in a new project

1. Skim [architecture.md](architecture.md), [documentation.md](documentation.md) and
   [ai-assisted-development.md](ai-assisted-development.md) before writing the first line of code —
   they shape the repository itself.
2. Pull in the topic guides as the corresponding concern first appears (first entity →
   domain-modeling; first user-facing string → i18n; first secret at rest → security).
3. Work through each guide's *Checklist for a new project* section; the checklists are the
   condensed, actionable form of the whole guide.
