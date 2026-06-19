# Translations (i18n) — Work Log & TODO

Resume notes for the multilingual feature. Branch: **`feature/translations`** (nothing committed yet).
Full system reference: [`docs/i18n.md`](docs/i18n.md). This file tracks what's done and what's left.

## Status snapshot (as of last session)

The i18n **system is complete and working**; the remaining work is finishing the string sweep,
filling German, and tightening guardrails.

Current verification (run from `frontend/`):

| Check | Command | State |
|-------|---------|-------|
| Build | `npm run build` | ✅ green |
| Lint  | `npm run lint` | ✅ exit 0, **0 errors**, ~1368 `no-unlocalized` **warnings** left |
| Tests | `npm test` | ✅ 612 pass / 1 fail (pre-existing `tracey-tools.spec.ts > list_theories`, unrelated to i18n) |
| Catalog | `npm run i18n:check` | ❌ 1316 German strings untranslated (expected — see TODO 1) |
| Backend | `dotnet test` (Domain/Api/Storage user tests) | ✅ green |

**1321 English source strings** are extracted into `frontend/src/locales/en/messages.po`.
German (`de`) has only 5 seeded translations; the rest fall back to English at runtime.

## What's already done

- **Backend**: `User.Language` (BCP-47, default `en`), `SupportedLanguages` (`en`,`de`), validation,
  `PATCH /api/users/me`, `MeDto.Language`, EF migration `AddUserLanguage` (backfills `en`). Tests in
  `Proxytrace.Domain.Tests/UserValidationTests.cs` + `Proxytrace.Api.Tests/{UsersController,AuthController}Tests.cs`.
- **Frontend engine**: Lingui v6 — `frontend/lingui.config.ts`, `frontend/src/i18n/index.ts`
  (instance, `dynamicActivate`, `SUPPORTED_LOCALES`, `LOCALE_NAMES`, locale resolution),
  `main.tsx` `I18nProvider`, macro transform in **both** `vite.config.ts` and `vitest.config.ts`
  (via `@rolldown/plugin-babel` + `linguiTransformerBabelPreset`).
- **Locale wiring**: `useMe()` (`src/hooks/useMe.ts`) + `LocaleSync` (`src/i18n/LocaleSync.tsx`);
  language picker in the account menu (`src/components/layout/LanguageMenuItems.tsx`).
- **Translation tool**: `frontend/scripts/i18n/translate.mjs` + `glossary.json` (idempotent, glossary-aware).
- **Lint guardrail**: `eslint-plugin-lingui` `no-unlocalized-strings` at **`warn`** (`.tsx`-scoped) in
  `frontend/eslint.config.js`.
- **Docs**: `docs/i18n.md`, CLAUDE.md (index row + hard rule), domain-entities/validation/database,
  `frontend/docs/BEST_PRACTICES.md`, `manual/guide/language.md`, CHANGELOG `[Unreleased]`.
- **String sweep**: all shared components + every feature folder migrated (1321 strings).

---

## TODO (pick up here)

### 1. Fill German translations (highest impact — German UI is mostly English right now)
Needs an OpenAI-compatible endpoint + key (can be Proxytrace's own proxy).
```bash
cd frontend
export I18N_TRANSLATE_API_KEY=...        # required
export I18N_TRANSLATE_BASE_URL=...       # optional (defaults to OpenAI)
export I18N_TRANSLATE_MODEL=...          # optional (default gpt-4o-mini)
npm run i18n:translate                    # fills the 1316 empty msgstr in de/messages.po
npm run i18n:check                        # should then pass
```
After: spot-check `src/locales/de/messages.po` that glossary terms stayed English; commit the catalog.

### 2. Finish `features/tracey/`
The Tracey subagent hit a session limit mid-run, so some chat-UI strings are still raw (it has the
most remaining warnings, ~145, though some are false-positives). It correctly touched only
`tool-ui/*` renderers — **do NOT** wrap `tracey-tools.ts`, system prompts, or `knowledge/*` (those
are LLM-facing). Read `frontend/docs/TRACEY.md` first. Find leftovers:
```bash
cd frontend && npm run lint 2>&1 | grep -A1 "features/tracey" | grep no-unlocalized
```

### 3. Wrap the spec-blocked helper maps
These render English but aren't translatable yet — each has a `*.spec.ts`/`*.test.ts` asserting
string equality, so converting the map to `msg` (`MessageDescriptor`) also requires updating the
spec to resolve via `i18n._()` (or assert on `.id`). Files:
- `src/components/license/licenseUtils.ts` — `TIER_LABEL`, `FEATURE_LABELS`, `upgradeCopy`, `licenseSourceNote` (`licenseUtils.test.ts`; also consumed by `UpgradeModal.tsx`, `setup/setupMeta.ts`, `LicenseBadge.tsx`)
- `src/features/setup/setupMeta.ts` — tier summary + provider presets (`Setup.spec.ts`)
- `src/features/notifications/notificationsMeta.ts` — `SEVERITY_LABEL` (`notificationsMeta.spec.ts`)
- `src/features/providers/providerMeta.ts` — `PROVIDER_KIND_OPTIONS`/`kindLabel` (`providerMeta.spec.ts`; mostly brand names)
- `src/features/admin/users.ts` (`authSourceLabel`), `src/features/admin/invitesMeta.ts` (`inviteStatus`)
- `src/features/proposals/decisionFlow.ts` (`statusLabel`), `src/features/proposals/validatedView.ts` (`adoptionLabel`), `src/features/proposals/handoffDoc.ts`
- `src/features/suites/suiteWindow.ts` (`suiteWindowLabel`), `src/features/evaluator-playground/{testBenchMeta.ts runLabel, jsonSchemaInference.ts}`
- `src/lib/scheduleCadence.ts` — `WEEKDAY_LABELS` (consumed by `runs/components/ScheduleCadenceField.tsx`)

### 4. Flip the lint rule `warn` → `error`
In `frontend/eslint.config.js`, after the sweep is clean: change `'lingui/no-unlocalized-strings'`
to `'error'`. First drive the warning count to zero — for genuine non-copy strings the rule
misfires on, either extend `ignoreNames`/`ignoreFunctions` or add
`// eslint-disable-next-line lingui/no-unlocalized-strings -- <reason>`. ~1368 warnings today are a
mix of false-positives + items 2 & 3 above.

### 5. e2e test (deferred)
Add a Playwright spec (use the `create-e2e-test` skill): log in → account menu → switch to German →
assert a known label renders in German → reload → assert it persisted (from the backend).

### 6. Manual screenshot (deferred)
`manual/guide/language.md` is text-only. Add a screenshot of the account-menu language picker via
the `manual-screenshots` skill (kiosk can reach the account menu).

---

## Gotchas / conventions (don't relearn the hard way)

- **Macro transform must be in BOTH configs.** `vite.config.ts` AND `vitest.config.ts` need the
  Lingui babel preset, or test imports of macro-using modules fail with
  "Cannot find package 'babel-plugin-macros'".
- **`.po` churn**: `lingui extract` rewrites `POT-Creation-Date` on every run, so extract is NOT
  wired into `predev/prebuild/pretest` — run `npm run i18n:extract` manually after adding labels.
- **`t` shadowing**: `t` from `useLingui()` collides with `.map(t => …)` / `.filter(t => …)` params.
  Rename the local param (e.g. `toast`, `tool`, `transition`) — several files already do this.
- **`t-call-in-function` is an error**: `t` must be used inside a component/hook. Module-level label
  maps use `msg` + resolve at render with `const { i18n } = useLingui(); i18n._(value)`.
- **Glossary** (`frontend/scripts/i18n/glossary.json`): Tool, User, Assistant, System, Trace, Token,
  Prompt, Agent, Proxy, Suite, Evaluator, Theory, Proposal, TTFT, … stay English. Wrapping them in
  macros is fine (the translate tool keeps them English).
- **Dev loop**: add label → `npm run i18n:extract` → `npm run i18n:translate` → commit catalogs.
