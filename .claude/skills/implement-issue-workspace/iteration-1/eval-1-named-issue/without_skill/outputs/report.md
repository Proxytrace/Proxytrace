# Implement issue #217 — Report

## 1. Selected issue

**#217 — "User email-notification default min-severity is Info, not Warning as the spec intends"**
Labels: `bug`, `priority:low`. State: open.

The issue claims the persisted per-user default for `UserEntity.EmailNotificationMinSeverity`
should be `Warning` (per a cited design spec), but is `Info`, so pre-existing users would receive
extra Info-level emails once SMTP is enabled.

### Key finding — the premise is wrong; `Info` is deliberate

Investigation showed `Info` is correct and intentional, **not** a bug. Changing it to `Warning`
would have *broken* the shipped design:

- **Shipped UI** (`frontend/src/components/layout/EmailNotificationMenuItems.tsx`) is a tri-state
  per-user control: **All / Critical / None**. "All" maps to `Info`; **there is no "Warning"
  option** for per-user preferences. A stored `Warning` would render as "All" and get normalized
  back to `Info` on the next save.
- **CHANGELOG** (feature shipped in #203) says: *"choosing All, Critical, or None from the account
  menu (defaulting to All)"* — i.e. the per-user default is **All = `Info`**.
- The **spec file the issue cites does not exist** in the repo:
  `docs/superpowers/specs/2026-06-20-email-notifications-design.md` is absent.
- The `Warning` default the issue points at belongs to the **operator-wide**
  `EmailSettings.MinSeverity` floor (`frontend/.../EmailNotificationsSection.tsx` defaults
  `minSeverity: Warning`) — a *separate* threshold. An email must clear **both** the operator floor
  and the recipient's per-user threshold. The issue conflates the two thresholds.

The issue itself anticipates this: *"If `Info` was deliberate, update the spec/CHANGELOG to match."*
The CHANGELOG already matches. The correct resolution is to **remove the documentation ambiguity**
that produced the report — not to change behavior. All three creation call sites (`SetupService`,
`JitUserProvisioner` OIDC, `InviteService`) rely on the `IUser.CreateNew` delegate default, so no
behavioral code change is warranted.

## 2. Branch

Branch name: `fix/217-email-min-severity-default-clarify`

```bash
git checkout -b fix/217-email-min-severity-default-clarify
git add -A
git commit -F <message>   # message in section 4
```

(All performed in the isolated worktree
`/home/daniel/Proxytrace/.claude/worktrees/agent-adb9c92681579bd3e`. No push.)

## 3. Diff

```diff
diff --git a/Proxytrace.Domain.Tests/UserTests.cs b/Proxytrace.Domain.Tests/UserTests.cs
index af901de1..78016e60 100644
--- a/Proxytrace.Domain.Tests/UserTests.cs
+++ b/Proxytrace.Domain.Tests/UserTests.cs
@@ -19,6 +19,9 @@ public sealed class UserTests : DomainTest<Module>
         var user = create("u@example.test", externalSubject: null, passwordHash: "hash", UserRole.Member);
 
         user.EmailNotificationsEnabled.Should().BeTrue();
+        // Info is deliberate: it is the account-menu "All" choice and the documented default (see
+        // CHANGELOG "defaulting to All"). It is NOT the operator-wide EmailSettings.MinSeverity
+        // floor (default Warning); do not "correct" this to Warning.
         user.EmailNotificationMinSeverity.Should().Be(NotificationSeverity.Info);
     }
 
diff --git a/Proxytrace.Domain/User/IUser.cs b/Proxytrace.Domain/User/IUser.cs
index c31d5ecb..f736ae36 100644
--- a/Proxytrace.Domain/User/IUser.cs
+++ b/Proxytrace.Domain/User/IUser.cs
@@ -34,7 +34,13 @@ public interface IUser : IDomainEntity<IUser>
     /// <summary>Whether the user receives email notifications. Defaults to <see langword="true"/>.</summary>
     bool EmailNotificationsEnabled { get; }
 
-    /// <summary>Minimum <see cref="NotificationSeverity"/> that triggers an email. Defaults to <see cref="NotificationSeverity.Info"/> (the "All" option in the account menu).</summary>
+    /// <summary>
+    /// Per-user minimum <see cref="NotificationSeverity"/> that triggers an email. Defaults to
+    /// <see cref="NotificationSeverity.Info"/>, which the account menu surfaces as the "All" choice
+    /// (All / Critical / None). This is the recipient's own threshold and is intentionally distinct
+    /// from the operator-wide <c>EmailSettings.MinSeverity</c> floor (which defaults to
+    /// <see cref="NotificationSeverity.Warning"/>); a notification must clear both to be emailed.
+    /// </summary>
     NotificationSeverity EmailNotificationMinSeverity { get; }
 
     /// <summary>Updates the user's <see cref="Role"/> and persists.</summary>
diff --git a/Proxytrace.Storage/Internal/Entities/User/UserConfig.cs b/Proxytrace.Storage/Internal/Entities/User/UserConfig.cs
index 0a2556e1..1a0a34c3 100644
--- a/Proxytrace.Storage/Internal/Entities/User/UserConfig.cs
+++ b/Proxytrace.Storage/Internal/Entities/User/UserConfig.cs
@@ -27,6 +27,9 @@ internal class UserConfig : AbstractEntityConfiguration<UserEntity>, IMapper<IUs
         builder.Property(e => e.Language).HasDefaultValue("en");
 
         builder.Property(e => e.EmailNotificationsEnabled).HasDefaultValue(true);
+        // Backfills existing rows (and any insert that omits the column) to the per-user "All"
+        // threshold = Info. This is intentionally the recipient threshold, not the operator-wide
+        // EmailSettings.MinSeverity floor (default Warning); see IUser.EmailNotificationMinSeverity.
         builder.Property(e => e.EmailNotificationMinSeverity).HasDefaultValue(NotificationSeverity.Info);
     }
 
diff --git a/Proxytrace.Storage/Internal/Entities/User/UserEntity.cs b/Proxytrace.Storage/Internal/Entities/User/UserEntity.cs
index 3625fbad..108fae84 100644
--- a/Proxytrace.Storage/Internal/Entities/User/UserEntity.cs
+++ b/Proxytrace.Storage/Internal/Entities/User/UserEntity.cs
@@ -23,6 +23,10 @@ internal record UserEntity : Entity
     /// <summary><see cref="Proxytrace.Domain.User.IUser.EmailNotificationsEnabled"/>. Defaults to true.</summary>
     public bool EmailNotificationsEnabled { get; init; } = true;
 
-    /// <summary><see cref="Proxytrace.Domain.User.IUser.EmailNotificationMinSeverity"/>. Defaults to Info.</summary>
+    /// <summary>
+    /// <see cref="Proxytrace.Domain.User.IUser.EmailNotificationMinSeverity"/>. Defaults to
+    /// <see cref="NotificationSeverity.Info"/> (the account-menu "All" choice) — deliberately,
+    /// not the operator-wide <c>EmailSettings.MinSeverity</c> floor.
+    /// </summary>
     public NotificationSeverity EmailNotificationMinSeverity { get; init; } = NotificationSeverity.Info;
 }
diff --git a/docs/notifications.md b/docs/notifications.md
index e7f64369..6dfccb93 100644
--- a/docs/notifications.md
+++ b/docs/notifications.md
@@ -87,6 +87,14 @@ Resolves recipients and sends one email per recipient with failure isolation:
 Target deep links route to `/runs?id=`, `/agents?id=`, or `/proposals?id=` depending on
 `NotificationTargetKind`.
 
+**Two severity thresholds.** Emailing a notification requires clearing **both**:
+
+- the **operator-wide** `EmailSettings.MinSeverity` floor (step 2) — defaults to `Warning`;
+- each recipient's **per-user** `IUser.EmailNotificationMinSeverity` (step 4) — defaults to
+  `Info`, which the account menu surfaces as the **All** choice (All / Critical / None; see the
+  CHANGELOG "defaulting to All"). This per-user `Info` default is deliberate and is *not* the
+  operator floor — do not "align" it to `Warning`.
+
 ## Email settings store
 
 ### `EmailSettings` record
```

Stat: `5 files changed, 26 insertions(+), 2 deletions(-)`.

## 4. Commit

Single commit `f4539262`:

```
docs: clarify per-user email min-severity default is deliberately Info (#217)

#217 reports the persisted default for `UserEntity.EmailNotificationMinSeverity`
is `Info`, expecting `Warning` per a design spec. Investigation shows `Info` is
correct and deliberate, not a bug:

- The shipped account-menu control (`EmailNotificationMenuItems.tsx`) is a
  tri-state All / Critical / None. The "All" choice maps to `Info`; there is no
  "Warning" option for per-user preferences.
- The CHANGELOG entry for the email feature (#203) states users choose
  "All, Critical, or None ... (defaulting to All)", i.e. the per-user default
  is All = `Info`.
- The spec file the issue cites
  (`docs/superpowers/specs/2026-06-20-email-notifications-design.md`) does not
  exist in the repo.
- The `Warning` default the issue points at belongs to the *operator-wide*
  `EmailSettings.MinSeverity` floor — a separate threshold. The issue conflates
  the two; an email must clear both.

The issue's premise ("if Info was deliberate, update the docs to match") is the
correct resolution. Behavior is unchanged; this only removes the ambiguity that
produced the report:

- IUser / UserEntity / UserConfig: doc comments now state Info is the per-user
  "All" default and call out the distinct operator floor.
- docs/notifications.md: document the two-threshold model and both defaults.
- UserTests: comment the existing regression assertion so the Info default is
  not "corrected" to Warning in future.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

```

## 5. Verification

Run in the worktree with the repo's .NET 10 SDK (`dotnet 10.0.109`):

| Step | Command | Result |
|------|---------|--------|
| Build Storage (+ Domain transitively) | `dotnet build Proxytrace.Storage/Proxytrace.Storage.csproj -clp:ErrorsOnly` | **Build succeeded** — 0 warnings, 0 errors |
| Build Domain.Tests | `dotnet build Proxytrace.Domain.Tests/Proxytrace.Domain.Tests.csproj -clp:ErrorsOnly` | **Build succeeded** — 0 warnings, 0 errors |
| Run UserTests | `dotnet test Proxytrace.Domain.Tests/Proxytrace.Domain.Tests.csproj --filter "FullyQualifiedName~UserTests" --no-build` | **Passed!** 3/3 (incl. the `Info` default regression guard) |

Docs: per CLAUDE.md, `docs/notifications.md` (maintained AI doc for this area) was updated in the
same change. No CHANGELOG entry added because behavior is unchanged (clarification only); the
existing CHANGELOG line "defaulting to All" already documents the correct default. No migration
added — the column default stays `0`/`Info`, which is correct. No frontend/i18n change (no UI
strings touched). No manual page touched (user/operator-facing behavior unchanged).

Not run (out of scope / time): full solution build, full `dotnet test` suite, e2e. The touched
projects build clean and the targeted tests pass.

## 6. Planned PR (NOT executed)

```bash
gh pr create \
  --repo Proxytrace/Proxytrace \
  --base master \
  --head fix/217-email-min-severity-default-clarify \
  --title "fix: clarify per-user email min-severity default is deliberately Info (#217)" \
  --body "$(cat <<'BODY'
Closes #217.

## Summary

#217 reports that the persisted per-user default for `UserEntity.EmailNotificationMinSeverity` is
`Info` and expects `Warning` per a design spec. **Investigation shows `Info` is correct and
deliberate — there is no behavioral bug.** This PR resolves the issue per its own escape hatch
("if `Info` was deliberate, update the docs to match") by removing the ambiguity that produced the
report.

## Why `Info` is correct (not `Warning`)

- The shipped per-user account-menu control (`EmailNotificationMenuItems.tsx`) is a tri-state
  **All / Critical / None**. "All" maps to `Info`; there is **no "Warning" option** for per-user
  preferences. Storing `Warning` would render as "All" and normalize back to `Info` on next save.
- The CHANGELOG for the email feature (#203) says users choose "All, Critical, or None ...
  **(defaulting to All)**" — i.e. the per-user default is All = `Info`.
- The spec file the issue cites
  (`docs/superpowers/specs/2026-06-20-email-notifications-design.md`) **does not exist** in the repo.
- The `Warning` default the issue points at is the **operator-wide** `EmailSettings.MinSeverity`
  floor — a separate threshold. An email must clear **both** the operator floor and the recipient's
  per-user threshold. The issue conflates them.

## Changes (docs/comments only — no behavior change)

- `IUser.cs`, `UserEntity.cs`, `UserConfig.cs`: doc comments now state the per-user `Info` default
  is the account-menu "All" choice and is distinct from the operator floor.
- `docs/notifications.md`: documents the two-threshold model and both defaults.
- `UserTests.cs`: comments the existing `Info`-default regression assertion so it is not
  "corrected" to `Warning` later.

## Verification

- `dotnet build` of Storage (+ Domain) and Domain.Tests: clean (0 warnings, 0 errors).
- `dotnet test --filter UserTests`: 3/3 pass.
- No migration / no CHANGELOG entry (behavior unchanged; existing CHANGELOG already says
  "defaulting to All"). No UI/i18n change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

## 7. Notes

- **Judgment call (the central one):** The issue asks to flip the default to `Warning`, but doing so
  would contradict the shipped UI (All/Critical/None, no Warning) and the CHANGELOG ("defaulting to
  All"), and would store a value the account menu cannot represent. I treated the issue as a real
  *documentation/clarity* defect rather than a behavioral one — exactly the alternative the issue
  text offers. The fix is the smaller, safer, correct one.
- **Spec file absent:** The whole issue rests on
  `docs/superpowers/specs/2026-06-20-email-notifications-design.md`, which is not present in the repo.
  If a real spec lived out of tree and genuinely mandated `Warning` as the *per-user* default, the
  design decision (and the All/Critical/None UI) would need revisiting — but that is a deliberate UX
  change, not a default tweak, and out of scope for a `priority:low` bug. Worth a maintainer glance.
- **No migration needed:** the column default (`0`/`Info`) is correct, so the existing migration is
  untouched. The `Warning` route would have required a follow-up migration plus a decision on
  re-defaulting existing rows — another reason the doc-only resolution is preferable here.
- **Branch label:** `fix/` prefix consistent with the repo's `feature/`-style branch naming; change
  is doc/comment-only despite the `bug` label.
- **Dry-run guards honored:** no `git push`, no `gh pr create`, no comments/labels created. All work
  is local to the isolated worktree.
