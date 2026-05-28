# Proxytrace License Server — Implementation Guide

A complete guide to building the **Proxytrace License Server** in a new,
empty repository. The server is the counterpart to the client-side licensing
subsystem tracked in
[JabbaKadabra/Proxytrace#127](https://github.com/JabbaKadabra/Proxytrace/issues/127).

The HTTP contract this server must implement is fixed by the client repo and
reproduced below in §5. The rest of this document is design + style guidance
to keep the two codebases recognisably part of the same family.

---

## 1. Goals & non-goals

### Goals
- Issue **Ed25519-signed JWTs** ("licenses") to customers identified by email.
- Allow Proxytrace deployments to **check** whether a previously issued license is still valid (every 24 h).
- Serve the **public keys** so air-gapped self-hosters can verify offline.
- Maintain a **revocation list** for compromised or refunded licenses.
- Provide a minimal **admin API** to mint, revoke, and list licenses.
- Match the engineering conventions of the main Proxytrace repo so engineers can move between them without re-learning anything.

### Non-goals (v1)
- Stripe / billing integration — keep this server boring; payments live elsewhere and call the admin API.
- A customer-facing UI — admin operations go through `curl` / a small CLI / an internal dashboard built later.
- Multi-tenancy — there is **one** Proxytrace company running one license server. All customers live in the same DB.
- Storing telemetry beyond what helps debug license-check problems (no per-feature usage stats).

---

## 2. Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language / runtime | **.NET 10 / C# 14** | Matches Proxytrace. |
| Web framework | **ASP.NET Core** (controllers) | Matches Proxytrace; controllers > minimal APIs for non-trivial endpoints. |
| DI | **Autofac** with `Module` per project | Matches Proxytrace. |
| Persistence | **EF Core 10 + PostgreSQL** (Npgsql) | License server is small; PG is the production target. Don't bother supporting SQLite/SQL Server here. |
| Signing | **NSec.Cryptography** for Ed25519 | Idiomatic .NET wrapper around libsodium. |
| JWT serialisation | **`Microsoft.IdentityModel.JsonWebTokens`** + custom `CryptoProviderFactory` for EdDSA | Stays inside the Microsoft.IdentityModel ecosystem the client uses. |
| Logging | **Serilog** + structured JSON sink | Standard. |
| Configuration | `IConfiguration` + typed options DTOs | Matches Proxytrace. |
| Background jobs | `BackgroundService` | Matches Proxytrace. None needed for v1 beyond a Quartz-free key-rotation reminder; can come later. |
| Tests | **MSTest + AwesomeAssertions + NSubstitute** | Matches Proxytrace. |
| Container DB tests | **Testcontainers for .NET** (Postgres) | Pragmatic — no in-memory PG provider exists. |
| HTTP client (admin CLI) | `IHttpClientFactory` typed clients | Matches Proxytrace. |
| Container | **Docker** (Linux/amd64+arm64 multi-arch) | Matches Proxytrace. |

**Do not** introduce: AutoMapper, MediatR, FluentValidation, MassTransit. Keep the stack identical to Proxytrace; if it's not in `Proxytrace.sln`'s NuGet manifest, justify before adding.

---

## 3. Repository layout

Mirror Proxytrace's layered architecture exactly. Every project has a single
`Module : Autofac.Module` that wires its own types and (optionally) registers
child modules.

```
ProxytraceLicense.sln
├── ProxytraceLicense.Api/             -- ASP.NET Core host: controllers, DTOs, composition root
├── ProxytraceLicense.Application/     -- Use cases: LicenseMintingService, LicenseCheckService
├── ProxytraceLicense.Domain/          -- Entities, repository interfaces, value objects (pure C#)
├── ProxytraceLicense.Infrastructure/  -- Ed25519 signing, key store, time provider, outbound HTTP if any
├── ProxytraceLicense.Storage/         -- EF Core entities, configurations, migrations, mappers
├── ProxytraceLicense.Common/          -- Validation helpers, DI extensions, IClock
├── ProxytraceLicense.Testing/         -- BaseTest<TModule>, container fixtures
├── tests/
│   ├── ProxytraceLicense.Api.Tests/
│   ├── ProxytraceLicense.Application.Tests/
│   ├── ProxytraceLicense.Domain.Tests/
│   ├── ProxytraceLicense.Infrastructure.Tests/
│   └── ProxytraceLicense.Storage.Tests/
├── tools/
│   └── ProxytraceLicense.Cli/         -- Thin admin CLI (mint / revoke / list) — calls the API, doesn't reach into the DB
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml             -- local: app + Postgres
│   └── k8s/                            -- example manifests if/when needed
├── docs/
│   ├── CONTRIBUTING.md
│   ├── ARCHITECTURE.md                -- this guide, condensed
│   ├── KEY_ROTATION.md
│   └── OPERATIONS.md
├── .editorconfig                      -- copied verbatim from Proxytrace
├── Directory.Build.props              -- common <LangVersion>, <Nullable>, <TreatWarningsAsErrors>
├── Directory.Packages.props           -- central package version management
└── README.md
```

### Layer dependencies (enforce in `Directory.Build.props` or via `ArchUnitNET`)

```
ProxytraceLicense.Api ─► ProxytraceLicense.Application ─► ProxytraceLicense.Domain ─► ProxytraceLicense.Common
                     ─► ProxytraceLicense.Infrastructure ─► ProxytraceLicense.Common
                     ─► ProxytraceLicense.Storage        ─► ProxytraceLicense.Application / Domain
```

Same direction as Proxytrace — no upward references.

### `Directory.Build.props` (root)

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <WarningsNotAsErrors>NU1701</WarningsNotAsErrors>
    <AnalysisMode>AllEnabledByDefault</AnalysisMode>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <NoWarn>$(NoWarn);CA1812</NoWarn>
  </PropertyGroup>
</Project>
```

`CA1812` (internal class never instantiated) is noisy with reflection-based DI.

---

## 4. Domain model

Three persistent entities. All fields use `DateTimeOffset` (never `DateTime`).
Storage entities mirror domain entities but hold raw foreign keys (`Guid`),
identical to Proxytrace's pattern.

### `Customer`
```
Id            : Guid
Email         : string          (unique, lowercased)
CompanyName   : string?         (optional, free text)
CreatedAt     : DateTimeOffset
UpdatedAt     : DateTimeOffset
```

### `License`
```
Id              : Guid          (== jti claim)
CustomerId      : Guid          (FK Customer)
Tier            : LicenseTier   (Free / Enterprise / … — same enum as Proxytrace client)
Features        : string[]      (additive overrides for the tier default)
Limits          : Dictionary<string, long>  (overrides; serialised as JSONB)
IssuedAt        : DateTimeOffset
ExpiresAt       : DateTimeOffset
RevokedAt       : DateTimeOffset?
RevocationReason: string?
SigningKeyId    : string         (kid of the key used to sign — see §6)
IssuedJwt       : string         (the JWT itself — stored for re-issuing on lost-license)
IssuedByAdmin   : string         (admin token / principal who minted)
CreatedAt       : DateTimeOffset
UpdatedAt       : DateTimeOffset
```

### `LicenseCheckEvent` (append-only telemetry, optional but recommended)
```
Id              : Guid
LicenseId       : Guid           (FK License — nullable; we receive jti not Id directly)
Jti             : string         (raw, in case of unknown)
ClientVersion   : string?
CheckedAt       : DateTimeOffset
ResultStatus    : CheckStatus    (Valid / Revoked / Unknown)
ClientIp        : string?        (masked /24 for privacy)
```

Used to detect "license used from 50 different IPs simultaneously" patterns.
Bucket-aggregate on read; don't index every event by IP.

### Repository interfaces (in `ProxytraceLicense.Domain`)

```csharp
internal interface ICustomerRepository  // see §8.6 — Domain is the layer that *declares* these
{
    Task<ICustomer?> FindByEmailAsync(string email, CancellationToken ct);
    Task<ICustomer> AddAsync(ICustomer customer, CancellationToken ct);
}

internal interface ILicenseRepository
{
    Task<ILicense?> FindByJtiAsync(Guid jti, CancellationToken ct);
    Task<IReadOnlyList<ILicense>> ListForCustomerAsync(Guid customerId, CancellationToken ct);
    Task<ILicense> AddAsync(ILicense license, CancellationToken ct);
    Task<ILicense> UpdateAsync(ILicense license, CancellationToken ct);
}

internal interface ILicenseCheckEventRepository
{
    Task AddAsync(ILicenseCheckEvent ev, CancellationToken ct);
}
```

(Interfaces are `public` per Proxytrace style — shown `internal` here only to match the rendered listing.)

Note: per Proxytrace's domain pattern, each entity needs **five files** —
`I[Entity].cs` (public interface), `[Entity].cs` (internal record),
`[Entity]Generator.cs` (test data factory), `[Entity]Entity.cs` (storage
entity), `[Entity]Config.cs` (EF mapper). Reuse the existing reference
implementations from Proxytrace's `User` (no relationships) and `Project`
(1:N) as templates.

---

## 5. HTTP API (frozen by the client repo)

All JSON bodies use `camelCase`. All timestamps are ISO-8601 UTC.
Return errors in the standard ProblemDetails envelope
(`Microsoft.AspNetCore.Mvc.ProblemDetails`).

### `POST /licenses` — mint a license

**Auth:** admin (see §7).

```jsonc
// request
{
  "email": "ada@example.com",
  "companyName": "Acme Corp",        // optional
  "tier": "enterprise",
  "durationDays": 365,
  "limits":   { "projects": 50, "users": 25 },  // optional, overrides tier defaults
  "features": ["AuditLog"]                       // optional, additive
}

// response 200
{
  "jwt": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjYtMDEifQ...",
  "jti": "0193ce20-7d4e-7c5e-8c4a-1b2c3d4e5f60",
  "exp": "2027-05-28T00:00:00Z",
  "tier": "enterprise",
  "email": "ada@example.com"
}
```

Side-effect: creates a `Customer` (if new) and a `License` row.

### `POST /licenses/check` — check a license (called by Proxytrace every 24 h)

**Auth:** none (the JWT acts as the credential). Rate-limit aggressively (see §11).

```jsonc
// request
{ "jti": "0193ce20-...", "version": "0.1.0" }

// response 200
{
  "status": "valid" | "revoked" | "unknown",
  "updatedTier":   null,                       // optional — present iff tier changed since issuance
  "updatedLimits": null,                       // optional — present iff limits changed
  "updatedFeatures": null,                     // optional — present iff features changed
  "checkedAt": "2026-05-28T12:00:00Z"
}
```

Side-effect: records a `LicenseCheckEvent`.

### `POST /licenses/{jti}/revoke` — revoke a license

**Auth:** admin.

```jsonc
// request
{ "reason": "Refunded order #1234" }

// response 204 No Content
```

### `GET /licenses` — list licenses (paginated)

**Auth:** admin.

Query params: `?email=`, `?tier=`, `?status=active|revoked|expired`, `?page=`, `?pageSize=` (max 100).

### `GET /licenses/{jti}` — fetch one license

**Auth:** admin. Returns the full record including the stored JWT.

### `POST /licenses/{jti}/reissue` — reissue a JWT for a lost-license recovery

**Auth:** admin. Same `jti`, fresh `iat`, same `exp`. Returns the new JWT
string. The old JWT remains technically valid until `exp` unless explicitly
revoked first.

### `GET /.well-known/proxytrace-license-key.json` — public keys (JWKS-shaped)

**Auth:** none. Cacheable (`Cache-Control: public, max-age=3600`).

```json
{
  "keys": [
    { "kid": "2026-01", "alg": "EdDSA", "kty": "OKP", "crv": "Ed25519",
      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
    { "kid": "2025-07", "alg": "EdDSA", "kty": "OKP", "crv": "Ed25519",
      "x": "..." }
  ]
}
```

Always include every key that *has ever* signed an outstanding license, so
clients that aren't pinned to embedded keys can still verify.

### `GET /healthz` — liveness

**Auth:** none. Returns `200 OK` with `{ "status": "ok" }`.

### `GET /readyz` — readiness

**Auth:** none. Returns `200 OK` only if DB ping + signing key load both succeed.

### OpenAPI

Expose Swagger UI at `/swagger` in Development. In Production, serve the raw
`/swagger/v1/swagger.json` (behind admin auth, optional) but **disable the
interactive UI** — minor hardening.

---

## 6. JWT signing (Ed25519)

### Library choice

- **NSec.Cryptography** wraps libsodium. Constant-time, modern, and the .NET-idiomatic Ed25519 wrapper.
- Wrap NSec behind your own `IJwtLicenseSigner` interface in
  `ProxytraceLicense.Infrastructure` so a future swap (e.g. to AWS KMS for
  HSM-backed signing) is a single file change.

### Key material

A signing key has:
- `kid` — string id (e.g. `"2026-01"`, year-month).
- `privateKey` — 32 bytes seed (Ed25519). Never log, never serialise outside the secret store.
- `publicKey` — 32 bytes.
- `activatedAt` — when it started signing.
- `retiredAt?` — when it stopped signing (still used for verification).

### Storage

**Source of truth:** environment variables / secret manager. **Never** the
database.

```
PROXYTRACE_LICENSE_SIGNING_KEYS=2026-01:<base64-seed>,2025-07:<base64-seed>
PROXYTRACE_LICENSE_ACTIVE_KEY=2026-01
```

- The **active** key signs new issuances.
- All keys listed sign-or-verify; the JWKS endpoint exposes their public halves.
- To rotate: add the new key, flip `ACTIVE_KEY`, deploy. Old key still verifies. After a subscription cycle, drop the old key.

`KeyVaultLicenseKeyStore` (cloud-secrets adapter) is a clear follow-up but not necessary in v1.

### Signing flow

```csharp
internal interface IJwtLicenseSigner
{
    string Sign(LicenseClaims claims, CancellationToken ct);
    string ActiveKeyId { get; }
}

internal sealed class Ed25519JwtLicenseSigner : IJwtLicenseSigner
{
    private readonly ILicenseKeyStore keys;
    private readonly IClock clock;

    public Ed25519JwtLicenseSigner(ILicenseKeyStore keys, IClock clock)
    {
        this.keys = keys;
        this.clock = clock;
    }

    public string ActiveKeyId => keys.Active.Kid;

    public string Sign(LicenseClaims claims, CancellationToken ct)
    {
        var header = new { alg = "EdDSA", typ = "JWT", kid = keys.Active.Kid };
        var payload = new
        {
            iss = "https://license.proxytrace.dev",
            aud = "proxytrace",
            sub = claims.Email,
            jti = claims.Jti.ToString(),
            iat = clock.UtcNow.ToUnixTimeSeconds(),
            exp = claims.ExpiresAt.ToUnixTimeSeconds(),
            tier = claims.Tier.ToString().ToLowerInvariant(),
            lim = claims.Limits,
            feat = claims.Features,
        };

        var encodedHeader  = Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(header));
        var encodedPayload = Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(payload));
        var signingInput   = $"{encodedHeader}.{encodedPayload}";

        var signature = keys.Active.Sign(Encoding.ASCII.GetBytes(signingInput));
        return $"{signingInput}.{Base64UrlEncoder.Encode(signature)}";
    }
}
```

(Sketch — keep the implementation small and well-tested.)

### Verifying

You generally don't verify on this server (clients do). But verification is
needed for the **reissue** endpoint and for unit-test ergonomics, so expose
an internal `IJwtLicenseValidator` mirroring the one in `Proxytrace.Licensing`.
Sharing actual code between the two repos is not worth the coupling.

### Key generation (operator script)

Ship a tiny `tools/keygen` console:

```
$ dotnet run --project tools/keygen
kid:        2026-01
privateKey: <base64>
publicKey:  <base64>

Add to deployment as:
  PROXYTRACE_LICENSE_SIGNING_KEYS=2026-01:<base64-private>
  PROXYTRACE_LICENSE_ACTIVE_KEY=2026-01
```

Document the rotation playbook in `docs/KEY_ROTATION.md`.

---

## 7. Authentication

Two surfaces with very different threat models.

### `POST /licenses/check` and `GET /.well-known/...` — public

No auth. The JWT (or absence of one) is the credential. Protected with:
- Rate limiting by IP (`Microsoft.AspNetCore.RateLimiting`, fixed-window).
- Strict request-body validation (JSON schema, 4 KB max).
- Always returns `valid`/`revoked`/`unknown` — never leaks whether a `jti` exists in the DB beyond that.

### `POST /licenses`, `POST /licenses/{jti}/revoke`, `GET /licenses`, `POST /licenses/{jti}/reissue` — admin

Pick **one** of these and stick with it. mTLS is preferred for the long run; the bearer token is the cheaper v1.

**v1 (recommended starting point) — Bearer token from an env var.**

```
PROXYTRACE_LICENSE_ADMIN_TOKENS=tok_aaa:alice@proxytrace,tok_bbb:bob@proxytrace
```

- Tokens are random 32-byte base64 strings.
- Multiple admin tokens supported so revoking one (e.g. on offboarding) is non-disruptive.
- Each request: `Authorization: Bearer tok_aaa` → resolves to an admin principal name, stamped into `License.IssuedByAdmin` for audit.
- Implement as an `AuthenticationHandler<AdminAuthOptions>` registered with scheme name `"admin"`. `[Authorize(AuthenticationSchemes = "admin")]` on admin controllers/actions.
- Constant-time comparison (`CryptographicOperations.FixedTimeEquals`) for the token match.

**v2 (later) — mTLS.** Issue a per-admin client certificate; ASP.NET Core natively supports cert auth via `services.AddAuthentication().AddCertificate(...)`. Configure nginx/Caddy in front to require client certs.

### CORS

Disabled by default. The admin tools call the server directly; Proxytrace deployments do too. No browser surfaces in v1.

### Security headers

Use a tiny middleware to set:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'`
- `Referrer-Policy: no-referrer`

(Matches Proxytrace's stance.)

---

## 8. Code style — non-negotiables

These mirror Proxytrace's `CLAUDE.md` so an engineer's muscle memory transfers.

### 8.1 General

- **Constructor injection only.** No primary constructors. No `static` services, no service locator, no `IServiceProvider` injection.
- **`record` types** for all domain entities and storage entities.
- `internal` by default — only interfaces and POCO DTOs are `public`.
- `required` properties with `init` accessors on storage entities.
- `var` when the right-hand side makes the type obvious; otherwise explicit.
- Expression-bodied members for true one-liners; block bodies with braces otherwise.
- `this(...)` constructor chaining for "new vs existing" entity ctors.
- `nameof(...)` for every exception/validation argument name.
- Collection expressions (`[]`, `[x, y]`, `[..a, ..b]`) when natural.
- **No `!` (null-suppression).** Anywhere. Period.
- **No `IServiceProvider` injection.** Use Autofac factories or named registrations.

### 8.2 Domain entities pattern (mirrors Proxytrace)

For each persistent concept, five files exactly:

| File | Location | Purpose |
| --- | --- | --- |
| `I[Entity].cs` | `ProxytraceLicense.Domain/[Entity]/` | Public interface + `CreateNew` / `CreateExisting` delegates. Extends `IDomainEntity`. |
| `[Entity].cs` | `ProxytraceLicense.Domain/[Entity]/Internal/` | `internal record`, extends `DomainEntity`. |
| `[Entity]Generator.cs` | `ProxytraceLicense.Domain/[Entity]/Internal/` | Test data factory extending `DomainEntityGenerator<I[Entity]>`. |
| `[Entity]Entity.cs` | `ProxytraceLicense.Storage/Internal/Entities/[Entity]/` | EF `internal record`, extends `Entity`, decorated `[StoredDomainEntity(typeof(I[Entity]))]`. |
| `[Entity]Config.cs` | `ProxytraceLicense.Storage/Internal/Entities/[Entity]/` | `AbstractEntityConfiguration<[Entity]Entity>` + `IMapper<I[Entity], [Entity]Entity>`. |

Repository interface + storage repository added only when needed (here: yes — we have queries beyond `GetById`).

`IDomainEntity` provides `Id`, `CreatedAt`, `UpdatedAt` — do not redeclare.

### 8.3 Domain object pattern (no storage of its own)

`LicenseClaims` (the in-memory representation of a freshly minted JWT payload),
`TierDefaults` (the same `LicensePolicy` table as the client — duplicate it
verbatim, do not share a NuGet package; tier maths is small enough that
drift cost > coupling cost).

### 8.4 Validation

`Validate(ValidationContext)` on every domain entity, yielding `base.Validate` first. Use the same helpers Proxytrace ships:

```csharp
Validation.NotNullOrWhiteSpace(Email, nameof(Email));
Validation.NotDefault(CustomerId, nameof(CustomerId));
Validation.InPast(CreatedAt, nameof(CreatedAt));
Validation.NotBefore(ExpiresAt, IssuedAt, nameof(ExpiresAt));
```

Activate Autofac's `OnActivated` validation, plus re-validate inside repository `AddAsync`/`UpdateAsync`. Copy `Proxytrace.Common.Validation` verbatim into `ProxytraceLicense.Common`.

### 8.5 Cancellation

Every async method takes `CancellationToken` as the final parameter. Plumb it from the `HttpContext.RequestAborted` down to EF queries.

### 8.6 Modules

One `Module : Autofac.Module` per project, named exactly `[ProjectName].Module`. Reflection-discover entities, generators, configurations, and repositories the same way Proxytrace does — copy `Proxytrace.Common.DependencyInjection` extensions and the `Proxytrace.Domain.Module` / `Proxytrace.Storage.Module` discovery helpers.

`ProxytraceLicense.Api.Module` is the composition root and:
1. Builds `IConfiguration` from `appsettings.json` + `appsettings.development.json` + env vars.
2. Loads the signing key from env (fail fast with a clear message if missing or malformed).
3. Registers child modules in dependency order: `Common`, `Infrastructure`, `Domain`, `Storage`, `Application`.
4. Wires up `AddControllers()`, `AddAuthentication("admin")`, `AddProblemDetails()`, rate limiting, Serilog, OpenAPI.

### 8.7 EditorConfig

Copy Proxytrace's `.editorconfig` verbatim. Don't drift.

---

## 9. Database

### Postgres schema (after first migration)

```
customer (
  id              uuid primary key,
  email           citext not null unique,
  company_name    text,
  created_at      timestamptz not null,
  updated_at      timestamptz not null
);

license (
  id                  uuid primary key,
  customer_id         uuid not null references customer(id) on delete restrict,
  tier                text not null,
  features            text[] not null default '{}',
  limits              jsonb not null default '{}',
  issued_at           timestamptz not null,
  expires_at          timestamptz not null,
  revoked_at          timestamptz,
  revocation_reason   text,
  signing_key_id      text not null,
  issued_jwt          text not null,
  issued_by_admin     text not null,
  created_at          timestamptz not null,
  updated_at          timestamptz not null
);
create index license_customer_id_idx on license(customer_id);
create index license_revoked_at_idx  on license(revoked_at) where revoked_at is not null;
create index license_expires_at_idx  on license(expires_at);

license_check_event (
  id              uuid primary key,
  license_id      uuid references license(id) on delete set null,
  jti             text not null,
  client_version  text,
  checked_at      timestamptz not null,
  result_status   text not null,
  client_ip       inet
);
create index license_check_event_license_id_idx on license_check_event(license_id, checked_at desc);
```

- `citext` for case-insensitive email (`CREATE EXTENSION citext;` in the initial migration).
- `jsonb` for `limits` — typed access via EF Core's `HasConversion`.
- `client_ip` masked to `/24` on insert (privacy).

### EF Core conventions

- Snake_case column names (`UseSnakeCaseNamingConvention()` from EFCore.NamingConventions).
- `DateTimeOffset` columns map to `timestamptz`.
- Use `await db.SaveChangesAsync(ct)` everywhere; never block.
- Repositories live in `ProxytraceLicense.Storage/Internal/Entities/[Entity]/`, decorated `[UsedImplicitly]`.

### Migrations

```bash
# run from ProxytraceLicense.Storage/
dotnet ef migrations add InitialSchema
dotnet ef database update
```

Apply on startup with a small `IDatabaseInitializer` (matches Proxytrace's pattern) — guarded behind `Database.EnsureMigrationsApplied=true` config so prod can disable it.

---

## 10. Testing

### Layout

Mirror Proxytrace exactly:

```
tests/ProxytraceLicense.Domain.Tests/
tests/ProxytraceLicense.Application.Tests/
tests/ProxytraceLicense.Infrastructure.Tests/
tests/ProxytraceLicense.Storage.Tests/
tests/ProxytraceLicense.Api.Tests/
```

Every test extends `BaseTest<TModule>` (copied from
`Proxytrace.Testing.BaseTest`). The DI container is rebuilt per test method;
override `ConfigureContainer` for stubs.

### Stack

- **MSTest** as the runner.
- **AwesomeAssertions** (Proxytrace's chosen fluent-assertions fork).
- **NSubstitute** for mocks.
- **Testcontainers.PostgreSql** for storage tests — one Postgres container per `[ClassInitialize]`, fresh schema per test.

### What to test

Minimum bar before merging anything:

- **Domain unit tests** for every validation rule (e.g. `License.Validate` rejects negative durations).
- **Signer test** that signs a known claims set and a recomputed signature matches (deterministic; use a fixed seed).
- **Validator test** that round-trips through the signer.
- **Repository tests** against real Postgres (Testcontainers) for `FindByJti`, `ListForCustomer`, the revocation update path.
- **Controller tests** using `WebApplicationFactory<Program>` covering:
  - Admin auth: missing token → 401; bad token → 403; good token → 200.
  - `POST /licenses` happy path + duplicate email creates a new license for the existing customer.
  - `POST /licenses/check` for valid / revoked / expired / unknown `jti`.
  - Rate-limit kick-in on `/licenses/check`.
- **Telemetry test**: each `/licenses/check` writes a `LicenseCheckEvent` row.

Exception assertions use `FluentActions.Invoking(...).Should().ThrowAsync<T>()` to match Proxytrace.

### CI

GitHub Actions, matching Proxytrace's workflow:

```yaml
- run: dotnet restore ProxytraceLicense.sln
- run: dotnet build  ProxytraceLicense.sln --no-restore --configuration Release
- run: dotnet test   ProxytraceLicense.sln --no-build  --configuration Release \
        --logger "trx" --results-directory TestResults
```

Postgres tests run in CI inside the Docker daemon Testcontainers boots — works on GitHub-hosted runners.

---

## 11. Operational concerns

### Configuration (env vars)

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `ProxytraceLicense__ConnectionStrings__Default` | yes | — | Postgres conn string. |
| `PROXYTRACE_LICENSE_SIGNING_KEYS` | yes | — | `kid:base64,kid:base64,...` |
| `PROXYTRACE_LICENSE_ACTIVE_KEY` | yes | — | `kid` of the key used for new issuances. |
| `PROXYTRACE_LICENSE_ADMIN_TOKENS` | yes | — | `token:name,token:name,...` |
| `ASPNETCORE_ENVIRONMENT` | no | `Production` | Standard. |
| `Logging__LogLevel__Default` | no | `Information` | Standard. |
| `RateLimit__CheckPerMinutePerIp` | no | `60` | `/licenses/check` budget per IP. |

### Logging

- Serilog → console JSON in containers; redact `Authorization` header, never log JWTs in full (only the first 8 chars + `…`).
- Mint and revoke events are logged at `Information` with structured fields.
- Failed admin auth logged at `Warning` with source IP.

### Rate limiting

- `/licenses/check`: 60 req/min per IP (fixed window). Soft cap; clients only hit it once per 24 h, so anything over a few req/sec is suspect.
- `/licenses` (admin): 30 req/min per token.
- `/healthz` and `/readyz`: not rate-limited.

### Health & readiness

- `/healthz` — process is up. Returns immediately.
- `/readyz` — runs `SELECT 1` against Postgres + ensures the active signing key has loaded. Used by Kubernetes / load balancer.

### Backups

Postgres backups via the hosting platform (RDS, Cloud SQL, etc.) — daily, 30-day retention. **Critical:** signing key seeds are NOT in the DB and MUST be backed up out-of-band (1Password vault for ops, separate from the DB backup).

### Disaster recovery

Loss of the active private key = ability to mint new licenses lost. Old licenses keep verifying via JWKS. Recovery: rotate to a new key (already-deployed clients won't recognise it until you ship a release with the new key embedded). **Therefore: protect the seeds.**

### Deployment

**Dockerfile** (multi-stage, distroless final):

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish ProxytraceLicense.Api -c Release -o /app /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS runtime
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["dotnet", "ProxytraceLicense.Api.dll"]
```

**`deploy/docker-compose.yml`** for local dev:
- `db` (postgres:17)
- `api` (the server) — depends on `db`, mounts a generated test signing key, exposes `:8080`.

Production target: Fly.io / Render / Kubernetes — the app is stateless beyond the DB. No sticky sessions, no on-disk state.

---

## 12. Getting started — first-week checklist

1. `gh repo create proxytrace-license-server --private` (or whatever the org convention is).
2. Copy `.editorconfig`, `Directory.Build.props`, `.gitignore` from `JabbaKadabra/Proxytrace`.
3. Scaffold projects:
   ```bash
   dotnet new sln -n ProxytraceLicense
   for p in Common Domain Storage Application Infrastructure Api Testing; do
     dotnet new classlib -n ProxytraceLicense.$p -o ProxytraceLicense.$p
     dotnet sln add ProxytraceLicense.$p
   done
   # turn Api into a web app
   rm -rf ProxytraceLicense.Api && dotnet new webapi -n ProxytraceLicense.Api -o ProxytraceLicense.Api --use-controllers
   dotnet sln add ProxytraceLicense.Api
   # test projects
   for p in Common Domain Storage Application Infrastructure Api; do
     dotnet new mstest -n ProxytraceLicense.$p.Tests -o tests/ProxytraceLicense.$p.Tests
     dotnet sln add tests/ProxytraceLicense.$p.Tests
   done
   ```
4. Copy `Proxytrace.Common` source files (`Validation`, `DependencyInjection`, async/type extensions, `IClock`) verbatim into `ProxytraceLicense.Common`. These are tiny, generic, and not worth shipping as a private NuGet.
5. Copy `Proxytrace.Testing.BaseTest` + its module discovery helpers verbatim into `ProxytraceLicense.Testing`.
6. Implement entities in this order: `Customer` → `License` → `LicenseCheckEvent`. Each one: domain → storage → tests, then move on.
7. Implement `Ed25519JwtLicenseSigner` + tests with a fixed seed.
8. Implement `/licenses` admin endpoint + tests.
9. Implement `/licenses/check` + tests.
10. Implement `/.well-known/proxytrace-license-key.json` + tests.
11. Wire `Dockerfile`, `docker-compose.yml`, GitHub Actions CI.
12. Run an end-to-end test: mint a JWT via `/licenses`, paste it into a local `./dev.sh` Proxytrace as `PROXYTRACE_LICENSE`, point `PROXYTRACE_LICENSE_SERVER_URL` (Debug build only) at your local server, watch the 24 h check succeed.

---

## 13. What lives in the client repo, not here

Just to draw the line clearly:

- The **embedded public key** lives in the Proxytrace client repo
  (`Proxytrace.Licensing/LicensePublicKeys.cs`). It is the matching public
  half of the seed listed in `PROXYTRACE_LICENSE_SIGNING_KEYS` here. When
  rotating: generate the keypair here, ship the private half into this
  server's env, ship the public half into a new Proxytrace release.
- The **`LicenseTier` / `LicenseFeature` / `LicenseLimit` enums** are
  duplicated in both repos. Keep them aligned by code review, not by sharing
  a library — drift is cheap to catch (a mismatched enum value shows up as
  `unknown` tier in the client and the client falls back to Free).
- The **state machine** (Active / Grace / Expired / Free) is purely
  client-side. This server emits stateless answers.

---

## 14. Things to read before starting

- [JabbaKadabra/Proxytrace#127](https://github.com/JabbaKadabra/Proxytrace/issues/127) — the matching client issue. Same contract, opposite end.
- `Proxytrace/CLAUDE.md` — code style and patterns. Almost all of it applies here.
- `Proxytrace/Proxytrace.Domain/User/` — simplest reference entity (no relationships). Use as a template for `Customer`.
- `Proxytrace/Proxytrace.Domain/Project/` — 1:N reference entity. Use as a template for `License → Customer`.
- `Proxytrace/Proxytrace.Application/Cleanup/Internal/AgentCallCleanupService.cs` — pattern for any future background jobs.
- RFC 8037 (CFRG curves for JOSE) — Ed25519 in JWT, the canonical spec.

---

## 15. Quality bar before going live

- [ ] `dotnet build` + `dotnet test` pass with `TreatWarningsAsErrors=true`.
- [ ] No `IServiceProvider` injections, no `!`, no static services in non-test code.
- [ ] Every endpoint has at least one happy-path and one rejection test.
- [ ] Admin tokens are read from env vars, never hard-coded.
- [ ] Signing key seed never appears in logs (verify by grepping log capture in tests).
- [ ] `/healthz` and `/readyz` wired into k8s/load-balancer.
- [ ] Rate limit on `/licenses/check` verified with an integration test.
- [ ] Backups configured + restore tested.
- [ ] Key rotation rehearsed on staging end-to-end.
- [ ] `README.md` documents: env vars, how to mint your first license, how to rotate keys, what to do if the active key leaks.
