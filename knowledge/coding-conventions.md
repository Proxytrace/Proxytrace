# Codified Coding Conventions as a Hard Gate

Style rules that live in senior engineers' heads do not scale: every new contributor (human or AI) re-litigates them, review threads fill with nits, and the codebase drifts into inconsistency that hides real bugs. The alternative is a short, written, *enforced* convention set — where everything enforceable is a build/lint failure and everything else is a documented rule with a stated reason. This document distills that philosophy.

## Principles

1. **Write conventions down, per area, and keep them next to the code.** A one-page style doc per concern (backend style, domain patterns, validation, testing) beats a monolithic handbook nobody reads. Docs are part of the definition of done: change the behavior, change the doc, same commit.
2. **Prefer mechanical enforcement over willpower.** Warnings-as-errors, lint rules that block raw primitives, formatting enforced by tooling. Any rule a machine can check should never appear in a human review comment.
3. **Make the safe thing the default and the unsafe thing loud.** Immutable-by-default records, `internal`-by-default visibility, non-nullable-by-default references. Escaping the default should require visible, greppable ceremony — or be outright forbidden.
4. **A convention needs a stated failure mode.** "Never suppress nullability" is memorable because the doc explains *why* (it converts a compile-time proof obligation into a runtime crash). Rules without rationale get cargo-culted, then abandoned.
5. **One blessed way per problem class.** One locking primitive, one validation helper set, one time type, one DI style. Choice is a cost; every second way to do something doubles the review surface.
6. **Small units, explicit dependencies.** Constructor injection everywhere, no service locators, no hidden statics — because a unit whose dependencies are visible in its signature is a unit that can be tested and reasoned about.

## Patterns

### Warnings as errors, solution-wide

- **Problem:** warnings accumulate into noise; once there are 300, the one that matters is invisible, and "we'll clean them up later" never happens.
- **Solution:** enable treat-warnings-as-errors globally in the shared build configuration (e.g. a `Directory.Build.props`, a root ESLint config with `--max-warnings 0`, `#![deny(warnings)]`), from day one. Unused variables, obsolete APIs, and nullability issues fail the build.
- **Rationale:** the compiler is the cheapest reviewer you will ever have. Zero-warning baselines are only achievable at project start — retrofitting is 100x the cost.

### Nullable discipline: no suppression, ever

- **Problem:** null-suppression operators (`!` in C#/TypeScript, `unwrap()` sprinkled in Rust, `as` casts) delete a proof obligation. Each one is a deferred `NullReferenceException` with no stack context.
- **Solution:** enable strict nullability and *forbid the suppression operator outright* — in the style doc as a hard rule and, where possible, via lint. When the compiler flags a nullable, the fix is structural: make the type honest (nullable property), add a guard clause that throws a meaningful exception, or redesign so the value can't be null there.
- **Rationale:** with warnings-as-errors, suppression doesn't even "fix" anything locally — it just moves the failure from compile time (precise, cheap) to runtime (vague, in production). Banning it removes the temptation to trade a red squiggle for a 3 a.m. page.

### Guard clauses with named parameters

- **Problem:** invalid arguments discovered deep inside a call chain produce useless diagnostics; ad-hoc `if (x == null) throw new Exception("bad")` checks are inconsistent and unsearchable.
- **Solution:** validate at the boundary of every constructor/method that has preconditions, using a small shared helper library, and always name the offending parameter via a compiler-checked mechanism:

  ```csharp
  public Widget(string name, Endpoint endpoint)
  {
      Guard.NotNullOrWhiteSpace(name, nameof(name));
      Guard.NotNull(endpoint, nameof(endpoint));
      ...
  }
  ```
- **Rationale:** failures surface at the earliest frame with an exact culprit. `nameof`/equivalent keeps messages correct through renames — string literals silently rot.

### Immutability and visibility by default

- **Problem:** mutable, public-everything code invites action-at-a-distance: any layer can flip any flag on any object.
- **Solution:** model domain data as immutable records (no setters); make implementation types `internal`/package-private and expose only interfaces and plain DTOs publicly; allow mutability only where a framework demands it (e.g. ORM entities), clearly quarantined in the storage layer.
- **Rationale:** immutability makes concurrency and caching safe by construction; minimal visibility keeps the public API surface — the part you must never break — deliberately small.

### One blessed primitive per concern

- **Problem:** five ways to lock, three time types, two validation styles — every combination is a potential bug (e.g. holding a monitor across an `await`, mixing local and UTC timestamps).
- **Solution:** pick one and write it down with the rationale and the (rare, comment-justified) exceptions. Examples of the genre:
  - all timestamps are offset-aware (`DateTimeOffset`/`Instant`), never naive local time;
  - all in-process concurrency goes through one injected, keyed async-lock abstraction — raw `lock`/semaphores forbidden in feature code because they are unsafe across awaits; a narrow documented exception exists for synchronous non-DI infrastructure and must cite the rule;
  - every async method takes and forwards a cancellation token.
- **Rationale:** the "keyed, injected lock" flavor matters: keying by the narrowest natural id (entity id) avoids serializing unrelated work, and injection makes locking visible and testable. The pattern generalizes — whenever a primitive is easy to misuse, wrap it once, inject the wrapper, ban the raw form.

### DI over statics and service locators

- **Problem:** static state and `serviceProvider.GetService<T>()` hide dependencies, defeat test doubles, and create initialization-order landmines.
- **Solution:** constructor injection only; avoid `static` except for pure extension methods and constants; treat injecting the container/provider itself as a smell requiring justification.
- **Rationale:** a class whose constructor lists its collaborators is self-documenting and swap-testable. Service locators are DI with the benefits removed.

### Reference implementations as executable documentation

- **Problem:** written rules can't cover every nuance; contributors need a "known-good" example to pattern-match against.
- **Solution:** the convention docs explicitly name reference implementations ("for a simple entity look at X, for an N:M relationship look at Y"). When the pattern evolves, upgrade the reference first.
- **Rationale:** examples encode the tacit 20% no rulebook captures, and pointing at one file ends debates fast. This is especially high-leverage when AI assistants contribute: they follow named exemplars far more reliably than prose.

### Lint/build as the only gate

- **Problem:** conventions enforced in code review are enforced inconsistently, late, and at social cost.
- **Solution:** anything expressible as a rule becomes tooling: forbid raw UI primitives in favor of the design-system components via lint; block builds on warnings; run the full build/lint before claiming any change done. Human review then spends itself on design and correctness.
- **Rationale:** a gate that sometimes lets things through is not a gate. Machines don't get tired or play favorites.

## Pitfalls

- **Adopting strictness late.** Turning on warnings-as-errors or strict null checks against an existing codebase produces thousands of errors and gets reverted. Start strict.
- **Rules without rationale.** They get ignored the first time they're inconvenient. Every rule in the doc should answer "or else what?"
- **Documented rules with undocumented exceptions.** If an exception is legitimate (the sync-lock case), enumerate the sanctioned uses in the doc and require a comment at each site pointing back to it.
- **Style docs that drift from the code.** Enforce doc updates in the same change as behavior changes; a wrong doc is worse than none.
- **Nit-picking in review what tooling should catch.** If reviewers keep flagging the same mechanical issue, that's a missing lint rule, not a training problem.
- **Suppression escape hatches "just this once".** One `!` becomes fifty. Zero-tolerance is easier to hold than any threshold.

## Checklist for a new project

- [ ] Enable treat-warnings-as-errors / max-warnings=0 in the shared build config before the first feature commit.
- [ ] Enable strict nullability and add a written (and where possible lint-enforced) ban on the suppression operator.
- [ ] Create a one-page style doc per area (general style, domain patterns, validation, testing); link them from the repo's AI/contributor entry-point file.
- [ ] Ship a tiny shared guard/validation helper library and use it in every constructor with preconditions.
- [ ] Decide the blessed primitive for time, locking, cancellation, and serialization; document each with rationale and sanctioned exceptions.
- [ ] Default to immutable records and minimal visibility; quarantine framework-forced mutability in the adapter layer.
- [ ] Ban statics (except extensions/constants) and service-locator patterns; use constructor injection exclusively.
- [ ] Name reference implementations in the docs and keep them exemplary.
- [ ] Wire lint rules for any convention that reviewers flag more than twice.
- [ ] Make "docs updated in the same change" part of the definition of done.
