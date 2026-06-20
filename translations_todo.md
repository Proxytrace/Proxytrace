# Translations (i18n) — Work Log & TODO

Resume notes for the multilingual feature. Branch: **`feature/translations`** (nothing committed yet).
Full system reference: [`docs/i18n.md`](docs/i18n.md). This file tracks what's done and what's left.

## Status snapshot (updated)

The i18n **system is complete and working**. The **string sweep is finished** and the lint guardrail
is now a hard **error** (TODO 2 & 4 done). The `.ts` label maps are translatable (TODO 3 done). The
only remaining functional gap is **filling German** (TODO 1 — blocked on a translation API key).

Current verification (run from `frontend/`):

| Check | Command | State |
|-------|---------|-------|
| Build | `npm run build` | ✅ green |
| Lint  | `npm run lint` | ✅ exit 0 — `no-unlocalized-strings` is now **`error`**, **0** violations |
| Tests | `npm test` | ✅ 612 pass / 1 fail (pre-existing `tracey-tools.spec.ts > list_theories`, unrelated to i18n) |
| Catalog | `npm run i18n:check` | ❌ German strings untranslated (expected — see TODO 1, needs API key) |
| Backend | `dotnet test` (Domain/Api/Storage user tests) | ✅ green |

English source strings are extracted into `frontend/src/locales/en/messages.po`.
German (`de`) still falls back to English at runtime until TODO 1 runs.

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

### 1. Fill German translations — ⏳ BLOCKED (needs a translation API key)
The only remaining functional gap. Needs an OpenAI-compatible endpoint + key (can be Proxytrace's
own proxy). Not runnable in environments without `I18N_TRANSLATE_API_KEY`.
```bash
cd frontend
export I18N_TRANSLATE_API_KEY=...        # required
export I18N_TRANSLATE_BASE_URL=...       # optional (defaults to OpenAI)
export I18N_TRANSLATE_MODEL=...          # optional (default gpt-4o-mini)
npm run i18n:translate                    # fills the empty msgstr in de/messages.po
npm run i18n:check                        # should then pass
```
After: spot-check `src/locales/de/messages.po` that glossary terms stayed English; commit the catalog.

### 2. Finish `features/tracey/` — ✅ DONE
All tracey chat/tool-UI **rendering** strings are wrapped; `tracey-tools.ts`, system prompts and
`knowledge/*` were left untouched (LLM-facing). No `no-unlocalized` violations remain in `features/tracey`.

### 3. Wrap the spec-blocked helper maps — ✅ DONE
Each label map below was converted to `msg` (`MessageDescriptor`), its consumers resolve with
`i18n._()`, and the spec was updated (import shared `i18n`, `beforeAll` activates an empty `en`
catalog, assert `i18n._(label)`). Done: `licenseUtils.ts`, `setupMeta.ts`, `notificationsMeta.ts`,
`providerMeta.ts`, `admin/users.ts`, `suiteWindow.ts`, `testBenchMeta.ts`, `scheduleCadence.ts`,
`proposals/decisionFlow.ts`, `proposals/validatedView.ts`.
Intentionally left English-by-design: `admin/invitesMeta.ts` `inviteStatus` (an enum **token** that
is `===`-compared, not rendered copy — the table renders a separate `<Trans>`), and
`proposals/handoffDoc.ts` (builds a downloaded/copied markdown artifact, not on-screen chrome).
(`jsonSchemaInference.ts` from the original list does not exist.)

### 4. Flip the lint rule `warn` → `error` — ✅ DONE
`frontend/eslint.config.js` now sets `'lingui/no-unlocalized-strings': 'error'` with **0** violations.
The config carries tuned `ignore` / `ignoreNames` / `ignoreFunctions` lists (CSS values, route paths,
URLs, snake_case/dotted machine keys, grid `fr` units, enum/SVG/structural attrs, class & DOM helper
calls) plus `useTsTypes`; class strings go through `cn()`; the irreducible non-copy tokens carry
scoped `// eslint-disable-next-line lingui/no-unlocalized-strings -- <reason>` hatches.

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
