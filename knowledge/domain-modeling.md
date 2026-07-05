# Domain Modeling as a Repeatable Multi-File Pattern

Domain models decay in two directions: either persistence concerns (ORM attributes, foreign-key ids, lazy-loading proxies) invade the business objects, or every entity is modeled slightly differently and no one can add concept N+1 without archaeology. The fix is a rigid, documented, per-entity file pattern with a hard domain/storage boundary — boring on purpose, so that adding an entity is mechanical and reviewing one is instant. This document distills that pattern.

## Principles

1. **Every domain concept follows the same fixed file set.** One interface, one immutable implementation, one test-data generator, one persistence entity, one mapping/configuration — same names, same folders, every time. Uniformity is the feature: deviation is visible at a glance.
2. **The domain/storage boundary is sharp and directional.** Domain objects hold *references to other domain objects*; storage rows hold *foreign-key ids*. Repositories accept and return domain interfaces only — a storage entity never crosses the boundary outward.
3. **Distinguish entities from value objects explicitly.** An entity has identity and lifecycle (id, created/updated timestamps, its own table). A value object has neither — it is embedded or serialized inside its owner and never gets its own repository. Deciding which one a concept is *before* coding prevents both anemic entities and over-tabled values.
4. **Construction goes through injectable factory delegates**, with exactly two paths: *create new* (mints identity and timestamps) and *rehydrate existing* (carries them over). Nothing else may fabricate identity.
5. **Validation is a domain concern, enforced at construction and before persistence** — not a database constraint you discover as a cryptic driver exception.
6. **Base abstractions carry the boilerplate.** Identity, timestamps, generic CRUD, change notification, common query filters live in shared base types; a concrete entity adds only what is unique to it.
7. **The glossary is a living document.** A single page lists every entity and value object with a one-line meaning; it is updated in the same change that alters the model.

## Patterns

### The five-file entity pattern

- **Problem:** ad-hoc entity design means every concept has a different shape, and persistence details leak into domain code.
- **Solution:** for each concept `Thing`, create:

  | File | Layer | Purpose |
  |---|---|---|
  | `IThing` | domain | public interface: properties + the two factory delegates |
  | `Thing` | domain/internal | immutable record implementing `IThing`, extends the entity base |
  | `ThingGenerator` | domain/internal | test-data factory producing valid random instances |
  | `ThingEntity` | storage/internal | ORM record (mutable if the ORM demands), ids instead of references |
  | `ThingConfig` | storage/internal | schema config (indexes, FKs) **and** the two-way domain⇄storage mapper |

  A dedicated repository interface/implementation is added *only* when the entity needs non-trivial queries or N:M relation syncing; simple entities use the generic `IRepository<IThing>`.
- **Rationale:** the pattern is copy-paste-refactor friendly, discoverable by convention-based DI, and reviewable by diff shape alone ("this PR adds five files in the right places"). Keeping mapper and schema config in one class means the person changing a column sees the mapping it feeds.

### Base entity contract: id + audit timestamps, declared once

- **Problem:** every entity re-declaring `Id`/`CreatedAt`/`UpdatedAt` invites drift (one uses naive `DateTime`, one forgets `UpdatedAt`).
- **Solution:** a marker interface (`IDomainEntity`) provides identity and timestamps; the domain base class assigns them on "new" and copies them on "existing". Concrete interfaces never redeclare these members and never introduce parallel "data" interfaces.
- **Rationale:** invariants held in one place are invariants; held in forty places they are statistics.

### Factory delegates for testable construction

- **Problem:** `new Thing(...)` scattered through the code hard-couples callers to the concrete type, prevents interception (validation, decoration), and makes "who is allowed to mint an id?" unanswerable.
- **Solution:** the interface declares two delegate types, mirrored one-to-one by two constructors:

  ```csharp
  public interface IThing : IDomainEntity
  {
      string Name { get; }
      IParent Parent { get; }

      delegate IThing CreateNew(string name, IParent parent);
      delegate IThing CreateExisting(string name, IParent parent, IEntityData existing);
  }
  ```

  DI auto-registers both delegates against the internal record. Application code injects `IThing.CreateNew`; the storage mapper injects `IThing.CreateExisting` to rehydrate rows. Constructor chaining (`this(...)`) keeps the two constructors from duplicating assignment logic. When construction is genuinely multi-phase (e.g. an aggregate that must be stitched together with its first child), register a hand-written factory for the delegate that hides the phases from callers.
- **Rationale:** delegates-as-factories give you interface-typed construction without factory-class boilerplate, keep concrete types internal, and give the container a hook to validate every instance on activation. Tests substitute the delegate trivially.

### Test-data generators as first-class pattern members

- **Problem:** tests hand-roll entities with whatever fields the author remembered, so half the suite silently tests degenerate objects.
- **Solution:** every entity/value object ships a generator (`ThingGenerator : Generator<IThing>`) that produces *valid, randomized* instances via the real factory delegate. Convention-based registration fails startup if a generator is missing.
- **Rationale:** generators centralize "what a plausible Thing looks like", keep tests short, and — because they run the real constructors and validation — double as a continuous test of the entity's invariants.

### FK conventions: references up, ids down

- **Problem:** mixing styles (domain objects holding raw ids, storage rows holding object graphs) makes every relationship a special case and pushes joins into business logic.
- **Solution:** codify per relationship kind:
  - **1:N** — domain holds the parent object (`IParent Parent`); storage holds `Guid ParentId`; the mapper resolves the parent through the parent's repository during rehydration. Delete behavior: `Restrict` for plain references, `Cascade` only for truly owned children.
  - **N:M** — domain holds `IReadOnlyCollection<IChild>`; storage uses a junction row with *no domain counterpart*; a custom repository syncs junction rows inside update.
  - **Append-only history/audit rows** — deliberately FK-free: referenced ids stored as plain nullable id columns plus denormalized snapshot labels, so the history survives deletion of what it points at.
- **Rationale:** three named shapes cover nearly everything; each shape's delete semantics are chosen once, consciously, instead of defaulting to whatever the ORM does. The FK-free case matters most: an audit row that cascades away with its subject is not an audit row.

### Soft-delete (archive) for referenced configuration entities

- **Problem:** hard-deleting a config/model entity that historical data references either blocks on an FK or orphans the history.
- **Solution:** an opt-in `IArchivable` marker + an archivable repository base: delete flips a flag; *list/picker queries* exclude archived rows in SQL; *by-key lookups remain unfiltered* so history and id-resolution still work. Critically: **never use a global ORM query filter** for this — it hides archived rows from by-id lookups too, breaking exactly the history archiving exists to protect. For entities backing irreplaceable history, disable hard delete in the repository (throw, directing callers to archive) *and* keep a database-level `Restrict` FK as the backstop against raw SQL. If a by-key "get or create" matches an archived row, un-archive it rather than leaving a live-but-hidden zombie.
- **Rationale:** the pattern splits one question — "is this row visible?" — by call site instead of globally, which is the entire subtlety of soft delete. App-level enforcement plus a DB backstop covers both the repository path and everything that bypasses it.

### Domain validation, separate from persistence

- **Problem:** relying on DB constraints yields late, cryptic failures; scattering `if` checks yields inconsistent ones.
- **Solution:** entities implement a standard validation hook (`Validate(context)` yielding results); the DI container runs full validation on every activation, and repositories run it again before insert/update. Rules use the shared guard helpers (`NotNullOrWhiteSpace`, `NotDefault`, `InPast`, `NotBefore(a, b)`), cascade into referenced entities by yielding their results, and check closed-set membership explicitly for non-enum constrained values. Always yield the base class's results first.
- **Rationale:** an invalid entity becomes *unrepresentable at runtime* — it cannot be constructed via DI nor persisted — while validation rules stay in the domain layer where they read as business language, not schema DDL.

### The glossary as a living document

- **Problem:** six months in, nobody agrees on what the core nouns mean; new code invents synonyms and the model forks conceptually.
- **Solution:** one `domain-concepts` page: every entity and value object, one to three lines each — what it is, its key relationships, which subsystem consumes it. Marked value objects explicitly ("no storage"). Updating it is part of the definition of done for any model change.
- **Rationale:** the glossary is the cheapest ubiquitous-language tool that actually gets maintained, and it is the highest-leverage context page for onboarding humans and AI assistants alike.

## Pitfalls

- **Leaking storage entities out of repositories** "just for this one query". The first leak normalizes the rest; return domain interfaces or purpose-built read DTOs.
- **Putting ids on domain objects for convenience.** The moment domain code joins by id, the mapper's job has moved into business logic.
- **Skipping the generator** because "this entity is trivial". The missing generator is discovered by the first test that needs it, written hastily, and wrong.
- **Default cascade deletes on high-volume or historical data.** One careless parent delete wipes millions of rows; choose `Restrict` unless the child is truly owned.
- **Global query filters for soft delete.** They break by-id resolution of archived rows — filter list queries only, explicitly, per query.
- **Modeling every noun as an entity.** If it has no lifecycle of its own, it is a value object; giving it a table adds joins, ids, and migration burden for nothing.
- **A rehydration path that re-runs "new" side effects** (fresh ids, timestamps, welcome events). Keep the two construction paths visibly distinct.
- **Glossary drift.** A stale glossary misleads with authority; enforce same-change updates.

## Checklist for a new project

- [ ] Define the entity base contract (id + audit timestamps, offset-aware) and the entity/value-object distinction before the first concept is modeled.
- [ ] Write the N-file pattern down as a table (names, folders, purposes) and create one exemplary reference entity per relationship kind (standalone, 1:N, N:M, archivable).
- [ ] Declare `CreateNew`/`CreateExisting` factory delegates on every entity interface; auto-register them; run validation on activation and pre-persist.
- [ ] Ship the shared guard/validation helper set and the generator base; fail startup when a pattern participant is missing.
- [ ] Codify FK conventions including delete behavior per relationship kind; make FK-free denormalized snapshots the rule for audit/history rows.
- [ ] Decide the soft-delete strategy up front for config entities referenced by history; ban global query filters for it.
- [ ] Add repositories only where queries are non-trivial; keep everything else on the generic repository.
- [ ] Create the domain glossary page with the first entity and put "glossary updated" into the definition of done.
- [ ] Consider a scripted/skill-based walkthrough ("create a new entity") so the pattern is followed mechanically rather than from memory.
