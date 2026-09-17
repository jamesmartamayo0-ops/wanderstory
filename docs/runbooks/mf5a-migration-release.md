# MF.5A migration and application release

## Scope and prerequisites

This runbook describes the Pass 1 safety tooling, not authorization to migrate or
deploy. The targeted Pass 1 completion authorization permits one disposable local
schema verification using only existing migrations on the exact target in
section B. It does not authorize production, preview, or Supabase database access,
new/edited migrations, or application promotion. Obtain separate release
authorization before using `db:migrate:release` elsewhere.

Use the reviewed commit, its unchanged migration directory, and locked installed
dependencies. Vercel uses Node 24.x. Verify the focused tests and types on Node 24
before review; do not change Vercel's runtime to work around failures. Serialize
releases to one target: these checks are not a distributed release lock.

Both Windows and non-Windows invoke `process.execPath` with the locally installed
Prisma CLI JavaScript entry and fixed `migrate status` or `migrate deploy`
arguments, always with `shell: false`. No shell, npx, npm exec, or global Prisma
executable is involved. This replaces the Windows `.cmd` launcher that failed
with `EINVAL`.

The CLI resolver uses `createRequire(import.meta.url)` to resolve the exported
`prisma/package.json`, then its `bin.prisma` entry relative to the package. The
installed package's root export is not the CLI. Canonical-path checks require the
metadata/package to belong to this repository's local dependency tree and the
existing JavaScript CLI file to remain within that package, including after
symlink resolution. Missing, non-file, outside-tree, or unresolvable entries fail
with a static safe error before spawning. No executable/argument override exists.

## Configuration contract

Supply configuration through the process environment or the deployment secret
manager. These scripts do not load `.env`; the Prisma child is directed away from
repository dotenv files. Never paste credentials into commands, logs, this
runbook, or source control. `.env.example` documents blank migration placeholders.

Every verification/release requires these independently configured values:

| Variable | Contract |
| --- | --- |
| `MIGRATION_TARGET_ENVIRONMENT` | Exactly `local`, `preview`, or `production`; never inferred from a host. |
| `DATABASE_URL` | Explicit nonempty runtime PostgreSQL URL. |
| `DIRECT_URL` | Explicit nonempty migration PostgreSQL URL; no fallback in either direction. |
| `MIGRATION_EXPECTED_DATABASE` | Exact database name for both endpoints. |
| `MIGRATION_EXPECTED_RUNTIME_HOST` | Exact runtime hostname, case-normalized. |
| `MIGRATION_EXPECTED_RUNTIME_PORT` | Explicit expected port, 1 through 65535. |
| `MIGRATION_EXPECTED_DIRECT_HOST` | Exact direct hostname, case-normalized. |
| `MIGRATION_EXPECTED_DIRECT_PORT` | Explicit expected port, 1 through 65535. |
| `MIGRATION_EXPECTED_PROJECT_REF` | Required only for remote Supabase topology. |
| `MIGRATION_PRODUCTION_PROJECT_REF` | Protected production identity anchor, required remotely. Production must match; preview must differ. No shared-project override. |
| `MIGRATION_STATUS_GATE` | `1` explicitly enables the gate outside Vercel; absent/`0` allows ordinary-local skip. Other nonempty values fail. |

Protect expected identity variables independently of the connection URLs. They are
operator assertions, not environment discovery: setting the production anchor
incorrectly defeats its intended preview/production separation.

Only PostgreSQL protocols and the `public` schema are supported. Credentials must
be present but are never displayed. Supported query options are `schema=public`,
`sslmode=require`/`verify-full`, and the restricted runtime-only `pgbouncer=true`
case below. Unknown or duplicate options, fragments, malformed encodings, socket
overrides, and host/port overrides fail. Both remote URLs must explicitly include
`sslmode=require` or `sslmode=verify-full`; missing TLS mode fails with
`REMOTE_TLS_REQUIRED`. Direct catalog checks require trusted TLS certificates;
a connection failure is fatal.

For local mode, both endpoints must use the same exact loopback hostname and port:
`127.0.0.1`, `localhost`, or `::1`. Mixing loopback aliases is deliberately refused.
LAN/public addresses and remote hostnames are not allowed in local mode.

For remote mode, both endpoints must prove the same explicit Supabase project.
Supported forms are the project direct database hostname on port 5432 with the
standard direct role, or the recognized AWS Supabase pooler hostname with its
project-qualified role. The runtime may use port 5432 or 6543 on that pooler;
`DIRECT_URL` may use only port 5432. Unrecognized/custom topology fails closed.
There is no general-purpose cloud host detection or automatic target selection.

`pgbouncer=true` is permitted only on the runtime `DATABASE_URL` after proving a
remote Supabase transaction-pooler host, project-qualified role, and port 6543.
It is rejected on every `DIRECT_URL`, in local mode, on other topology or ports,
with any value other than exactly `true`, or when duplicated. Endpoint identity
comes from the verifier's runtime/direct call position, never from URL options.
`connection_limit`, `pool_timeout`, and arbitrary driver parameters remain
unsupported. Keep `pgbouncer=true` in the runtime URL and add `sslmode=require`
(or `verify-full`); the session/direct URL on port 5432 must include the TLS mode
and must not include `pgbouncer`.

## A. Ordinary local development

With no deployment marker and `MIGRATION_STATUS_GATE` absent or `0`, run:

```text
npm run build
```

The npm `prebuild` lifecycle prints one explicit ordinary-local skip message,
opens no database connection, and launches no Prisma child. This is not a
deployment approval. The unchanged Next.js application may still require its
normal database during prerendering; the migration gate does not mock application
data or change the existing routes' build requirements.

The existing `/destinations/search-index` prerender requires a schema even when
the deployment gate skips. Full build verification therefore uses the explicitly
authorized disposable schema below, never a remote database or a source-code
change to bypass prerendering.

## B. Disposable local verification

Use a separately authorized, proven-disposable PostgreSQL 16 target. The intended
safe identity is `127.0.0.1:55436`, database `wanderstory_mf5a_verify`. Print only
that safe identity and inspect the exact container before connecting. Never use
the repository's configured URLs. Set both URLs and all expected target values
only in the verification process, with target environment `local`.

```text
npm run db:migrate:target
```

This performs pure validation first, then read-only identity/catalog checks on
both endpoints. To require migration status and smoke checks, set
`MIGRATION_STATUS_GATE=1` in the process and run `npm run prebuild`.

An empty/unmanaged database still fails the normal gate and release preflight;
this remediation does not weaken that safety rule or add a bootstrap option.

The targeted completion authorization permits one fresh `postgres:16` container
named `wanderstory-mf5a-verify`, published only at `127.0.0.1:55436`, with database
`wanderstory_mf5a_verify`, role `mf5a_verify`, and a random disposable password.
Before creation, stop if that name exists or port 55436 is listening. Never reuse
or remove an unknown container. Supply credentials only process-locally.

Before any migration application, verify the exact container identity, PostgreSQL
16 version, both process-scoped URL targets, and the implemented target verifier.
For this initially unmanaged disposable database only, independently prove an
empty public catalog and absent migration ledger, record the pre-application
status and expected existing migration names, then use the same guarded fixed
direct-Node `deployPrismaMigrations` launcher once to apply existing migrations.
This separately authorized bootstrap is not a production release-preflight
bypass and does not change the ordinary release runner. Require up-to-date status,
matching applied history, and the full read-only gate/smoke afterward.

Run `npm.cmd run build` with both URLs explicitly overridden to this same target
and only synthetic public/service configuration where needed. Do not seed data,
edit `.env`, or alter application source. Regardless of success or failure, stop
and remove only the container created for this test, remove its disposable data,
and prove that the container is absent and port 55436 has no listener.

## C. Vercel preview deployment

`VERCEL=1`, `VERCEL_ENV=preview`, and
`MIGRATION_TARGET_ENVIRONMENT=preview` must agree. Set all URL/expected-target
variables and both project identity variables in the correct environment scope.
The preview project must differ from the protected production project reference.

The gate is mandatory even if `MIGRATION_STATUS_GATE=0`. Missing configuration,
failed topology/identity checks, pending migrations, failed or divergent history,
nonzero migration status, or failed smoke checks stop the build.

## D. Vercel production deployment

`VERCEL=1`, `VERCEL_ENV=production`, and
`MIGRATION_TARGET_ENVIRONMENT=production` must agree. The expected project must
equal the protected production identity anchor. All other mandatory checks are
the same as preview. Development/unknown Vercel environments and inconsistent
deployment markers fail; they cannot silently select the ordinary-local path.

Before release, obtain fresh read-only Vercel evidence for project name,
framework, build command, root directory, install command, output directory, and
Node runtime. Previously supplied evidence had null overrides and Node 24.x; it
is not a substitute for a fresh check. If an unexpected explicit dashboard build
override appears, stop and report it without changing settings.

The repository `vercel.json` contract pins `buildCommand` to `npm run build` and
preserves the security-maintenance cron exactly. Do not call `next build`
directly in deployment, because that bypasses npm's `prebuild` lifecycle.

**Vercel prebuild never applies migrations.** Complete the separately authorized
schema migration before application promotion. Successful prebuild is a check,
not a migration runner or permission to promote.

## E. Explicit migration release

Only after separate authorization and protected target configuration, run:

```text
npm run db:migrate:release
```

The fixed sequence is:

1. Require explicit environment and both URLs; validate every expected target
   value and supported topology before a database connection or child process.
2. Print only safe target fields. Read both endpoints' database name, migration
   ledger, and public column catalog inside read-only transactions; require them
   to agree. Compare migration names/checksums with the reviewed local files.
3. Run `process.execPath` with fixed arguments `[resolvedLocalPrismaCli,
   "migrate", "status"]`. Raw child stdout/stderr is not forwarded.
4. Accept exit 0 only with no pending migrations. Accept exit 1 only when Prisma's
   known pending-list output matches the independently verified pending suffix
   exactly. Unknown/nonmatching status, failed rows, unmanaged history, altered
   checksums, divergent/holey history, or unexpected migration names stop release.
5. Recheck history immediately before the mutating command; stop on change.
6. Run `process.execPath` with fixed arguments `[resolvedLocalPrismaCli,
   "migrate", "deploy"]` exactly once. Stop on error; there is no automatic retry
   or arbitrary subcommand dispatcher.
7. Run the same fixed direct-Node status invocation again; require success.
8. Recheck history and run read-only schema smoke verification on both endpoints.
   Require no pending files and every scalar table/column declared by the current
   repository schema. This is a presence smoke test, not a comprehensive type,
   index, constraint, or foreign-key drift audit. Mapped model/column names are
   not part of the current schema; future schema mapping needs corresponding
   smoke-test review.
9. Emit a safe success message. Application deployment/promotion is a separate
   authorized action and is never performed by these scripts.

Migration checksums are computed from the reviewed file bytes. Preserve canonical
line endings; checksum disagreement stops release rather than rewriting files.
An unmanaged database requires a separately reviewed initialization/baseline
procedure, not a bypass of this guard.

## Failures and rollback

Stop promotion on any failure. Keep the previous application active where
possible and investigate through approved, secret-safe operational tooling. Raw
provider/Prisma exceptions and credentials are deliberately suppressed here.

Database inspection failures keep the exact external failure and exit code 1:

```text
Migration diagnostic: {"pass":"initial","endpoint":"direct","operation":"connect","category":"postgres","code":"08P01"}
Migration safety check failed: DATABASE_READ_FAILED
```

This is an illustrative diagnostic, not evidence of a production cause. The
failure reporter emits one diagnostic line immediately before the existing error
line. Its only keys are `pass`, `endpoint`, `operation`, `category`, and `code`.
The original provider error is neither retained nor serialized.

- `pass`: `initial` for prebuild's first inspection and standalone target
  verification; `smoke` for schema smoke's inspection; `release-precheck` for both
  release inspections before deploy; `release-postcheck` for the inspection after
  deploy and its status check. Release schema smoke still uses `smoke`.
- `endpoint`: `direct` or `runtime`, with the existing direct-first order.
- `operation`: `connect`, `begin_read_only`, `identity_query`, `migration_query`,
  `columns_query`, `rollback`, or `identity_check`. `begin_read_only` is the first
  query, distinct from the subsequent identity SELECT.
- `category`: `authentication`, `tls`, `network`, `timeout`, `postgres`,
  `identity_mismatch`, or `unknown`. Categories use only exact allowlisted codes
  and the internal connected-database mismatch marker. `08P01` means a protocol
  violation, not proof of a startup-parameter rejection; `57014` does not prove a
  timeout. Both remain `postgres`. Message-only errors remain `unknown`.
- `code`: an exact allowlisted primitive string or `null`. The SQLSTATE allowlist
  is `28000`, `28P01`, `08000`, `08001`, `08003`, `08004`, `08006`, `08007`,
  `08P01`, `0A000`, `22023`, `25006`, `3D000`, `42501`, `42601`, `42703`, `42704`,
  `42P01`, `53300`, `57014`, `57P01`, `57P02`, `57P03`, and `XX000`. System codes
  are limited to `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`,
  `EHOSTUNREACH`, `ENETUNREACH`, `CERT_HAS_EXPIRED`, `DEPTH_ZERO_SELF_SIGNED_CERT`,
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, and `ERR_TLS_CERT_ALTNAME_INVALID`.
  Unknown codes, including unlisted five-character strings, become `null`.

Only an own data property named `code` is inspected; getters, inherited values,
coercion, and arbitrary error names are ignored. No message, stack, detail, hint,
cause, URL, host, port, database, username, password, configuration, provider
response, or query text is included in the diagnostic. Keep the bounded line for
investigation; do not enable raw provider logging to fill gaps in it.

This diagnostic does not change connection options, TLS verification, read-only
protections, queries, endpoint routing, release sequencing, or failure cleanup.
A failure stops the remaining steps. A `smoke` failure in prebuild can follow a
successful status command; prebuild still cannot deploy migrations. A
`release-postcheck` failure follows an already attempted deploy and does not
authorize a retry. Runtime evidence is still needed before selecting a fix.

Never edit an already-applied migration, automatically repair its ledger, or
attempt a destructive rollback. Prefer an independently reviewed forward-fix
migration with a compatible application rollout. Partial migration failures need
an explicit recovery decision; the release runner does not retry or resolve them.

## Focused verification

```text
npm run test:mf5a:pass1
npx tsc --noEmit --incremental false
npm run lint
```

The focused tests use synthetic environments and mocked process/database paths;
mocked deploy sequencing alone is not evidence of a real migration application.
Record disposable integration evidence separately from unit/mock results. Verify
Node 24 using an ephemeral official Linux container with a read-only repository
mount, copy only required nonsecret sources internally, install locked dependencies
there, and run the focused tests, Pass 1 TypeScript, ordinary-local prebuild, and
an explicit gate rejection. Do not copy `.env` files; remove the container after
verification. Do not change source or Vercel settings to hide a failed exit gate.
