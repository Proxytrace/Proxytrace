# Debug-only API & developer affordances

This page documents affordances that exist **only in local debug builds** to make development and
debugging faster. **Everything here is compiled out of Release builds** — it must never reach a
published/production binary. The hard rule: a debug affordance is gated by `#if DEBUG` (compile-time
exclusion), not merely by an `ASPNETCORE_ENVIRONMENT=Development` runtime check.

## Always-available debug login

A local **DEBUG build** seeds a fixed admin account on startup so you can always sign in through the
normal login form, without knowing the real admin password.

| | |
|---|---|
| **Email** | `debug@proxytrace.dev` |
| **Password** | `#Proxy420!` |
| **Role** | `Admin` (can reach every project) |

### How it works

- `Proxytrace.Api/Debug/DebugLoginSeederHostedService.cs` is an `IHostedService` that, on startup,
  ensures the account exists: it hashes the password with the normal `IPasswordService` and inserts
  the user exactly like `SetupService.CreateFirstAdminAsync`. Login then flows through the ordinary
  `LoginService` — there is **no** password-verification bypass; the credential is a real, hashed
  user row.
- It is **idempotent**: if the account already exists it does nothing.
- It does **not** count as a completed first-run setup. `SetupService.AnyUsersExistAsync()` ignores
  this one account (`Proxytrace.Application/Setup/DebugBackDoorAccount.cs` holds the shared identity,
  also `#if DEBUG`), so a fresh debug database still reports `setupRequired: true` from
  `GET /api/auth/mode` and the onboarding wizard runs as it does for a real install.
- The **entire seeder type and its registration in `Program.cs` are wrapped in `#if DEBUG`**, so the
  credential and the code do not exist in a Release build. The same applies to `DebugBackDoorAccount`.

### Caveats

- On a **fresh database** the login form redirects to `/setup` (first-run onboarding), so the debug
  credential is only *usable* once you have created the real first admin — after that it is available
  on every subsequent sign-in. On an existing dev database it simply adds the debug admin alongside
  your real users.
- Because the account is `Admin`, it can read and mutate every project's data — appropriate for
  local debugging only. **Never** enable this path in a build that is exposed to anyone else.

### Security

- This is a hardcoded back-door credential. It is acceptable **only** because `#if DEBUG` removes it
  from Release. If you ever convert this to a runtime flag, you reintroduce a production risk —
  don't. Keep the compile-time guard.
- Release builds (what the release workflow publishes) are compiled in `Release` configuration, so
  `#if DEBUG` is false and none of this is emitted.

### Release-only guard test

`Proxytrace.Api.Tests/ReleaseBackdoorClosedTests.cs` proves the back-door is gone from a Release
build. The whole test class is wrapped in `#if !DEBUG`, so it is compiled **only** in a non-Debug
configuration — `dotnet test -c Release` (which also builds the `Proxytrace.Api` assembly under test
in Release) runs it, while a normal Debug `dotnet test` skips it (the back-door is intentionally
present in Debug). It asserts, against the compiled Release assembly, that:

- the `Proxytrace.Api.Debug.DebugLoginSeederHostedService` type does not exist,
- no type ships under the `Proxytrace.Api.Debug` namespace, and
- neither credential literal (`debug@proxytrace.dev`, `#Proxy420!`) appears in the assembly bytes of
  **either** `Proxytrace.Api` or `Proxytrace.Application`, and
- `Proxytrace.Application.Setup.DebugBackDoorAccount` does not exist.

If anyone drops the `#if DEBUG` guard, these fail under `-c Release`. Run the guard with
`dotnet test Proxytrace.Api.Tests -c Release`.

## Other debug-only surfaces

- **Swagger UI** (`/swagger`) is served when `ASPNETCORE_ENVIRONMENT=Development` (see `Program.cs`).
  Useful for exercising the API by hand while debugging. This is a runtime check, not `#if DEBUG`,
  because it exposes no credential — only the API surface the caller is already authorized for.
