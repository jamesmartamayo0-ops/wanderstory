import assert from "node:assert/strict";
import test, { before, beforeEach, mock } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import * as fsPromises from "node:fs/promises";
import type {
  DatabaseSnapshot, Environment, MigrationFile,
} from "../scripts/database/verify-migration-target.mjs";
import type { ReleaseChecks } from "../scripts/database/migrate-release.mjs";

const sentinel = "MF5A_SECRET_b9437d2fb51e4d2eb5f19a63c38f681c";
const project = "abcdefghijklmnopqrst";
const otherProject = "zyxwvutsrqponmlkjihg";
const localUrl = "postgresql://fixture:" + sentinel + "@127.0.0.1:55436/wanderstory_mf5a_verify?schema=public";
function local(overrides: Environment = {}): Environment {
  return {
    MIGRATION_TARGET_ENVIRONMENT: "local", DATABASE_URL: localUrl, DIRECT_URL: localUrl,
    MIGRATION_EXPECTED_DATABASE: "wanderstory_mf5a_verify",
    MIGRATION_EXPECTED_RUNTIME_HOST: "127.0.0.1", MIGRATION_EXPECTED_DIRECT_HOST: "127.0.0.1",
    MIGRATION_EXPECTED_RUNTIME_PORT: "55436", MIGRATION_EXPECTED_DIRECT_PORT: "55436",
    ...overrides,
  };
}
function remote(environment: "preview" | "production" = "preview"): Environment {
  return {
    MIGRATION_TARGET_ENVIRONMENT: environment,
    DATABASE_URL: "postgresql://postgres." + project + ":" + sentinel + "@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
    DIRECT_URL: "postgresql://postgres:" + sentinel + "@db." + project + ".supabase.co:5432/postgres?sslmode=verify-full",
    MIGRATION_EXPECTED_DATABASE: "postgres",
    MIGRATION_EXPECTED_RUNTIME_HOST: "aws-0-ap-northeast-1.pooler.supabase.com",
    MIGRATION_EXPECTED_RUNTIME_PORT: "6543", MIGRATION_EXPECTED_DIRECT_HOST: "db." + project + ".supabase.co",
    MIGRATION_EXPECTED_DIRECT_PORT: "5432", MIGRATION_EXPECTED_PROJECT_REF: project,
    MIGRATION_PRODUCTION_PROJECT_REF: environment === "production" ? project : otherProject,
  };
}

let spawnCalls: Array<{ executable: string; args: string[]; options: Record<string, unknown> }> = [];
let childExit = 0;
let childStdout = "";
let childStderr = "";
let childThrows = false;
type MockModule = (name: string, options: { exports: Record<string, unknown> }) => void;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
const originalCreateRequire = createRequire;
const testRequire = originalCreateRequire(resolve("tests/migration-target-guard.test.ts"));
const localMetadata = testRequire.resolve("prisma/package.json");
const localCli = realpathSync(resolve(dirname(localMetadata), JSON.parse(readFileSync(localMetadata, "utf8")).bin.prisma));
let resolutionMode: "normal" | "unresolvable" | "missing" | "outside" | "directory" | "missing-entry" | "entry-directory" | "escaped-entry" = "normal";
const originalRealpath = fsPromises.realpath;
const originalStat = fsPromises.stat;
mockModule("node:fs/promises", { exports: {
  ...fsPromises,
  realpath: async (path: string) => {
    if (resolve(path) === localCli) {
      if (resolutionMode === "missing-entry") throw new Error(sentinel + localUrl);
      if (resolutionMode === "escaped-entry") return resolve("package.json");
    }
    return originalRealpath(path);
  },
  stat: async (path: string) => {
    if (path === localCli && resolutionMode === "entry-directory") return originalStat(dirname(path));
    return originalStat(path);
  },
} });
mockModule("node:module", { exports: { createRequire: (filename: string | URL) => {
  const require = originalCreateRequire(filename);
  const originalResolve = require.resolve;
  require.resolve = Object.assign((id: string, options?: { paths?: string[] }) => {
    if (id === "prisma/package.json") {
      if (resolutionMode === "unresolvable") throw new Error(sentinel + localUrl);
      if (resolutionMode === "missing") return resolve("node_modules/prisma/missing-mf5a-cli-metadata.json");
      if (resolutionMode === "outside") return resolve("package.json");
      if (resolutionMode === "directory") return dirname(localMetadata);
    }
    return originalResolve(id, options);
  }, originalResolve);
  return require;
} } });
mockModule("node:child_process", { exports: { spawn: (
  executable: string, args: string[], options: Record<string, unknown>,
) => {
  spawnCalls.push({ executable, args, options });
  if (childThrows) throw new Error(sentinel + localUrl);
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough; stderr: PassThrough; kill: () => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  queueMicrotask(() => {
    child.stdout.write(childStdout);
    child.stderr.write(childStderr);
    child.emit("close", childExit, null);
  });
  return child;
} } });
let databaseConfigs: Array<Record<string, unknown>> = [];
let databaseCalls: string[] = [];
let databaseThrows = false;
let databaseView: ((index: number) => DatabaseSnapshot) | undefined;
class MockDatabaseClient extends EventEmitter {
  private readonly index: number;
  constructor(config: Record<string, unknown>) {
    super();
    this.index = databaseConfigs.length;
    databaseConfigs.push(config);
  }
  async connect() {
    databaseCalls.push("connect");
    if (databaseThrows) throw new Error(sentinel + localUrl);
  }
  async query(sql: string) {
    databaseCalls.push(sql);
    const view = databaseView?.(this.index) ?? snapshot();
    if (sql.startsWith("SELECT current_database()")) {
      return { rows: [{ database: view.database, migrations_table: view.migrationsTable ? "_prisma_migrations" : null }] };
    }
    if (sql.startsWith("SELECT migration_name")) return { rows: view.migrations };
    if (sql.startsWith("SELECT table_name")) return { rows: view.columns };
    assert.ok(sql === "BEGIN READ ONLY" || sql === "ROLLBACK", "Only read-only statements are permitted");
    return { rows: [] };
  }
  async end() { databaseCalls.push("end"); }
}
mockModule("pg", { exports: { Client: MockDatabaseClient } });
let guard!: typeof import("../scripts/database/verify-migration-target.mjs");
let gate!: typeof import("../scripts/database/assert-migrations-applied.mjs");
let release!: typeof import("../scripts/database/migrate-release.mjs");
before(async () => {
  guard = await import("../scripts/database/verify-migration-target.mjs");
  gate = await import("../scripts/database/assert-migrations-applied.mjs");
  release = await import("../scripts/database/migrate-release.mjs");
});
beforeEach(() => {
  spawnCalls = []; childExit = 0; childStdout = ""; childStderr = ""; childThrows = false;
  databaseConfigs = []; databaseCalls = []; databaseThrows = false; databaseView = undefined;
  resolutionMode = "normal";
});
const files: MigrationFile[] = [
  { name: "20260101000000_first", checksum: "a".repeat(64) },
  { name: "20260102000000_second", checksum: "b".repeat(64) },
];
function snapshot(applied = 2): DatabaseSnapshot {
  return {
    database: "wanderstory_mf5a_verify", migrationsTable: true, columns: [],
    migrations: files.slice(0, applied).map((file) => ({
      migration_name: file.name, checksum: file.checksum,
      finished_at: "2026-01-02", rolled_back_at: null,
    })),
  };
}
function checks(applied = 2) {
  const calls: string[] = [];
  const logs: string[] = [];
  let deployed = false;
  const deps: ReleaseChecks = {
    log: (message) => { logs.push(message); },
    files: async () => { calls.push("files"); return files; },
    inspect: async () => { calls.push("inspect"); return snapshot(deployed ? 2 : applied); },
    status: async () => {
      calls.push("status");
      return !deployed && applied < 2
        ? { exitCode: 1, pendingNames: files.slice(applied).map((file) => file.name) }
        : { exitCode: 0, pendingNames: null };
    },
    deploy: async () => { calls.push("deploy"); deployed = true; return { exitCode: 0, pendingNames: null }; },
    smoke: async () => { calls.push("smoke"); },
  };
  return { calls, logs, deps };
}

for (const key of [
  "DATABASE_URL", "DIRECT_URL", "MIGRATION_TARGET_ENVIRONMENT", "MIGRATION_EXPECTED_DATABASE",
  "MIGRATION_EXPECTED_RUNTIME_HOST", "MIGRATION_EXPECTED_DIRECT_HOST",
  "MIGRATION_EXPECTED_RUNTIME_PORT", "MIGRATION_EXPECTED_DIRECT_PORT",
]) {
  for (const value of [undefined, ""]) {
    test("missing/empty " + key + " fails before DB access and any spawn (" + String(value) + ")", async () => {
      const { deps, calls } = checks();
      const env = local({ [key]: value, MIGRATION_STATUS_GATE: "1" });
      await assert.rejects(release.migrateRelease(env, deps), /MISSING_/);
      await assert.rejects(gate.assertMigrationsApplied(env, deps), /MISSING_/);
      assert.deepEqual(calls, []);
      assert.deepEqual(spawnCalls, []);
      assert.deepEqual(databaseConfigs, []);
    });
  }
}
test("DATABASE_URL alone never substitutes for DIRECT_URL", () => {
  assert.throws(() => guard.verifyMigrationTarget(local({ DIRECT_URL: undefined })), /MISSING_DIRECT_URL/);
});
for (const host of ["127.0.0.1", "localhost", "::1"]) {
  test("local accepts explicit loopback " + host, () => {
    const hostPart = host === "::1" ? "[::1]" : host;
    const url = localUrl.replace("127.0.0.1", hostPart);
    const target = guard.verifyMigrationTarget(local({
      DATABASE_URL: url, DIRECT_URL: url,
      MIGRATION_EXPECTED_RUNTIME_HOST: host, MIGRATION_EXPECTED_DIRECT_HOST: host,
    }));
    assert.equal(target.topology, "loopback");
    assert.equal(target.runtime.host, host);
    assert.ok(Object.isFrozen(target));
    assert.ok(!JSON.stringify(target).includes(sentinel));
    assert.ok(!JSON.stringify(target).includes("postgresql://"));
  });
}
for (const host of ["db.abcdefghijklmnopqrst.supabase.co", "8.8.8.8", "192.168.1.20", "internal.example"]) {
  test("local rejects nonloopback even when expected host agrees: " + host, () => {
    assert.throws(() => guard.verifyMigrationTarget(local({
      DATABASE_URL: localUrl.replace("127.0.0.1", host), DIRECT_URL: localUrl.replace("127.0.0.1", host),
      MIGRATION_EXPECTED_RUNTIME_HOST: host, MIGRATION_EXPECTED_DIRECT_HOST: host,
    })), /LOCAL_REQUIRES_LOOPBACK/);
  });
}
for (const [label, overrides] of [
  ["unknown environment", { MIGRATION_TARGET_ENVIRONMENT: "guess" }],
  ["wrong database", { MIGRATION_EXPECTED_DATABASE: "different" }],
  ["wrong runtime port", { MIGRATION_EXPECTED_RUNTIME_PORT: "55437" }],
  ["wrong direct port", { MIGRATION_EXPECTED_DIRECT_PORT: "55437" }],
  ["runtime/direct mismatch", { DIRECT_URL: localUrl.replace("55436", "55437"), MIGRATION_EXPECTED_DIRECT_PORT: "55437" }],
  ["invalid port", { MIGRATION_EXPECTED_RUNTIME_PORT: "99999" }],
  ["alternate schema", { DIRECT_URL: localUrl.replace("schema=public", "schema=private") }],
  ["query host override", { DIRECT_URL: localUrl + "&host=attacker.example" }],
  ["duplicate schema", { DIRECT_URL: localUrl + "&schema=public" }],
  ["empty TLS mode", { DIRECT_URL: localUrl + "&sslmode=" }],
  ["socket override", { DIRECT_URL: localUrl + "&options=-h/var/run" }],
  ["fragment", { DIRECT_URL: localUrl + "#secret" }],
  ["malformed URL", { DIRECT_URL: "postgresql://fixture:" + sentinel + "@[" }],
] as Array<[string, Environment]>) {
  test("rejects " + label + " without secret-bearing errors", () => {
    assert.throws(() => guard.verifyMigrationTarget(local(overrides)), (error: unknown) => {
      assert.ok(error instanceof guard.MigrationGuardError);
      assert.ok(!String(error).includes(sentinel));
      assert.ok(!String(error).includes(localUrl));
      return true;
    });
  });
}
for (const environment of ["preview", "production"] as const) {
  test("remote " + environment + " requires explicitly matching project topology", () => {
    const target = guard.verifyMigrationTarget(remote(environment));
    assert.equal(target.environment, environment);
    assert.equal(target.topology, "supabase");
    assert.equal(target.runtime.host, "[verified-supabase-host]");
  });
}
for (const [label, overrides] of [
  ["missing production anchor", { MIGRATION_PRODUCTION_PROJECT_REF: undefined }],
  ["preview equals production", { MIGRATION_PRODUCTION_PROJECT_REF: project }],
  ["missing project", { MIGRATION_EXPECTED_PROJECT_REF: undefined }],
  ["wrong project", { MIGRATION_EXPECTED_PROJECT_REF: otherProject }],
  ["unknown topology", { DIRECT_URL: "postgresql://postgres:fixture@other.example:5432/postgres?sslmode=verify-full", MIGRATION_EXPECTED_DIRECT_HOST: "other.example" }],
  ["transaction pooler as DIRECT_URL", { DIRECT_URL: remote().DATABASE_URL, MIGRATION_EXPECTED_DIRECT_HOST: "aws-0-ap-northeast-1.pooler.supabase.com", MIGRATION_EXPECTED_DIRECT_PORT: "6543" }],
] as Array<[string, Environment]>) {
  test("remote rejects " + label, () => {
    assert.throws(() => guard.verifyMigrationTarget({ ...remote(), ...overrides }), guard.MigrationGuardError);
  });
}
test("remote missing TLS cannot pass", () => {
  assert.throws(() => guard.verifyMigrationTarget({
    ...remote(), DIRECT_URL: remote().DIRECT_URL!.replace("?sslmode=verify-full", ""),
  }), /REMOTE_TLS_REQUIRED/);
});
test("ordinary local build skips without inspecting URL, reading files, DB access, or spawn", async () => {
  const { deps, calls, logs } = checks();
  assert.equal(await gate.assertMigrationsApplied({ DATABASE_URL: "malformed-" + sentinel }, deps), "skipped");
  assert.deepEqual(calls, []);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /ordinary local build/);
  assert.deepEqual(spawnCalls, []);
});
for (const env of [
  { VERCEL: "1" }, { VERCEL: "1", VERCEL_ENV: "development" },
  { VERCEL: "1", VERCEL_ENV: "preview" }, { VERCEL_ENV: "production" },
  { VERCEL: "0", VERCEL_ENV: "production" }, { MIGRATION_STATUS_GATE: "typo" },
  { MIGRATION_STATUS_GATE: "1" },
]) {
  test("deployment/verification marker never silently skips: " + JSON.stringify(env), async () => {
    const { deps, calls } = checks();
    await assert.rejects(gate.assertMigrationsApplied(env, deps), guard.MigrationGuardError);
    assert.deepEqual(calls, []);
    assert.deepEqual(spawnCalls, []);
  });
}
test("Vercel environment mismatch fails before checks", async () => {
  const { deps, calls } = checks();
  await assert.rejects(gate.assertMigrationsApplied({
    ...remote("production"), VERCEL: "1", VERCEL_ENV: "preview",
  }, deps), /VERCEL_ENVIRONMENT_MISMATCH/);
  assert.deepEqual(calls, []);
});
for (const environment of ["preview", "production"] as const) {
  test("Vercel " + environment + " cannot be skipped by MIGRATION_STATUS_GATE=0", async () => {
    const { deps, calls } = checks();
    await gate.assertMigrationsApplied({
      ...remote(environment), VERCEL: "1", VERCEL_ENV: environment, MIGRATION_STATUS_GATE: "0",
    }, deps);
    assert.deepEqual(calls, ["files", "inspect", "status", "smoke"]);
    assert.ok(!calls.includes("deploy"));
  });
}
test("explicit local gate passes only status plus read-only smoke", async () => {
  const { deps, calls, logs } = checks();
  assert.equal(await gate.assertMigrationsApplied(local({ MIGRATION_STATUS_GATE: "1" }), deps), "ready");
  assert.deepEqual(calls, ["files", "inspect", "status", "smoke"]);
  assert.ok(!JSON.stringify(logs).includes(sentinel));
  assert.ok(!JSON.stringify(logs).includes(localUrl));
});
test("prebuild pending migrations fail and never call deploy", async () => {
  const { deps, calls } = checks(1);
  await assert.rejects(gate.assertMigrationsApplied(local({ MIGRATION_STATUS_GATE: "1" }), deps), /MIGRATIONS_NOT_READY/);
  assert.ok(!calls.includes("deploy"));
  assert.ok(!calls.includes("smoke"));
});
test("prebuild module cannot import the deploy capability", () => {
  const source = readFileSync("scripts/database/assert-migrations-applied.mts", "utf8");
  assert.doesNotMatch(source, /deployPrismaMigrations|migrateRelease|migrate-release|["']deploy["']/);
});
test("expected pending suffix permits fixed release sequence", async () => {
  const { deps, calls } = checks(1);
  await release.migrateRelease(local(), deps);
  assert.deepEqual(calls, ["files", "inspect", "status", "inspect", "deploy", "status", "inspect", "smoke"]);
});
test("up-to-date release still uses fixed idempotent deploy sequence", async () => {
  const { deps, calls } = checks();
  await release.migrateRelease(local(), deps);
  assert.deepEqual(calls, ["files", "inspect", "status", "inspect", "deploy", "status", "inspect", "smoke"]);
});
test("exit 1 without an exact expected pending list stops before deploy", async () => {
  const { deps, calls } = checks(1);
  deps.status = async () => ({ exitCode: 1, pendingNames: null });
  await assert.rejects(release.migrateRelease(local(), deps), /UNEXPECTED_MIGRATION_STATUS/);
  assert.ok(!calls.includes("deploy"));
});
for (const phase of ["inspect", "status", "deploy", "smoke"] as const) {
  test("release stops on " + phase + " failure", async () => {
    const { deps, calls } = checks();
    Object.assign(deps, { [phase]: async () => { calls.push(phase); throw new Error("controlled test failure"); } });
    await assert.rejects(release.migrateRelease(local(), deps));
    assert.equal(calls.at(-1), phase);
  });
}
test("failed, edited, unknown, duplicate and out-of-order migrations are rejected", () => {
  for (const change of [
    (s: DatabaseSnapshot) => { s.migrations[0].finished_at = null; },
    (s: DatabaseSnapshot) => { s.migrations[0].checksum = "c".repeat(64); },
    (s: DatabaseSnapshot) => { s.migrations[0].migration_name = "unknown"; },
    (s: DatabaseSnapshot) => { s.migrations.push(s.migrations[0]); },
    (s: DatabaseSnapshot) => { s.migrations.shift(); },
    (s: DatabaseSnapshot) => { s.migrationsTable = false; },
  ]) {
    const s = snapshot();
    change(s);
    assert.throws(() => guard.compareMigrationHistory(files, s), guard.MigrationGuardError);
  }
});
test("Prisma status output parser distinguishes pending from failed history", () => {
  const output = "Following migration have not yet been applied:\n20260102000000_second\n\n";
  assert.deepEqual(guard.classifyCommandOutput(1, output, ""), { exitCode: 1, pendingNames: [files[1].name] });
  assert.equal(guard.classifyCommandOutput(1, output, "Schema engine error: " + sentinel).pendingNames, null);
});
test("fixed process calls use shell:false and never forward raw credential output", async () => {
  const target = guard.verifyMigrationTarget(local());
  childStdout = sentinel + localUrl;
  childStderr = sentinel;
  const result = await guard.readPrismaStatus(target);
  assert.deepEqual(result, { exitCode: 0, pendingNames: null });
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].executable, process.execPath);
  assert.deepEqual(spawnCalls[0].args, [localCli, "migrate", "status"]);
  assert.equal(spawnCalls[0].options.shell, false);
  assert.deepEqual(spawnCalls[0].options.stdio, ["ignore", "pipe", "pipe"]);
  assert.ok(!JSON.stringify(result).includes(sentinel));
  await guard.deployPrismaMigrations(target); // Spawn mocked: no migration or DB access.
  assert.equal(spawnCalls[1].executable, process.execPath);
  assert.deepEqual(spawnCalls[1].args, [localCli, "migrate", "deploy"]);
});

for (const mode of ["unresolvable", "missing", "outside", "directory", "missing-entry", "entry-directory", "escaped-entry"] as const) {
  test("local CLI resolution fails safely before spawn: " + mode, async () => {
    resolutionMode = mode;
    await assert.rejects(guard.readPrismaStatus(guard.verifyMigrationTarget(local())), (error: unknown) => {
      assert.match(String(error), /LOCAL_PRISMA_CLI_UNAVAILABLE/);
      assert.ok(!String(error).includes(sentinel));
      assert.ok(!String(error).includes(localUrl));
      return true;
    });
    assert.deepEqual(spawnCalls, []);
  });
}

test("fixed wrappers ignore extra executable, command, and shell-fragment arguments", async () => {
  const target = guard.verifyMigrationTarget(local({ PRISMA_CLI: sentinel, PRISMA_COMMAND: "db push" }));
  const status = guard.readPrismaStatus as (...args: unknown[]) => Promise<unknown>;
  const deploy = guard.deployPrismaMigrations as (...args: unknown[]) => Promise<unknown>;
  await status(target, "cmd.exe", "db push", "; echo " + sentinel);
  await deploy(target, "powershell.exe", "migrate dev", "&& " + sentinel);
  assert.deepEqual(spawnCalls.map((call) => call.executable), [process.execPath, process.execPath]);
  assert.deepEqual(spawnCalls.map((call) => call.args), [
    [localCli, "migrate", "status"], [localCli, "migrate", "deploy"],
  ]);
  assert.ok(spawnCalls.every((call) => call.options.shell === false));
  assert.equal("runFixedPrisma" in guard, false);
  assert.equal("resolveLocalPrismaCli" in guard, false);
});

test("all platforms use direct Node without a shell or package-executor dependency", () => {
  const source = readFileSync("scripts/database/verify-migration-target.mts", "utf8");
  assert.match(source, /spawn\(process\.execPath, \[cli, "migrate", command\]/);
  assert.doesNotMatch(source, /npx|npm exec|cmd\.exe|powershell|process\.platform|shell:\s*true/);
  assert.match(source, /createRequire\(import\.meta\.url\)/);
  assert.match(source, /localRequire\.resolve\("prisma\/package\.json"\)/);
});
test("forged target fails before process launch", async () => {
  await assert.rejects(guard.readPrismaStatus({ ...guard.verifyMigrationTarget(local()) }), /UNVERIFIED_TARGET/);
  assert.deepEqual(spawnCalls, []);
});
test("spawn exception is reduced to a safe static error", async () => {
  childThrows = true;
  await assert.rejects(guard.readPrismaStatus(guard.verifyMigrationTarget(local())), (error: unknown) => {
    assert.match(String(error), /PRISMA_PROCESS_FAILED/);
    assert.ok(!String(error).includes(sentinel));
    return true;
  });
});
test("no gate code loads dotenv or application Prisma before validation", () => {
  for (const file of ["verify-migration-target", "assert-migrations-applied", "migrate-release"]) {
    const source = readFileSync("scripts/database/" + file + ".mts", "utf8");
    assert.doesNotMatch(source, /import\s+.*(?:dotenv|lib\/prisma|prisma\.config)/);
    assert.doesNotMatch(source, /shell:\s*true|execSync|execFile|migrate dev|db push/);
  }
});

test("logical verification checks both endpoints using only read-only database calls", async () => {
  const result = await guard.verifyLogicalTarget(guard.verifyMigrationTarget(local()));
  assert.deepEqual(result, snapshot());
  assert.equal(databaseConfigs.length, 2);
  for (const config of databaseConfigs) {
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 55436);
    assert.equal(config.database, "wanderstory_mf5a_verify");
    assert.equal(config.ssl, false);
    assert.equal(config.options, "-c default_transaction_read_only=on");
    assert.equal(config.connectionString, undefined);
  }
  assert.equal(databaseCalls.filter((sql) => sql === "BEGIN READ ONLY").length, 2);
  assert.equal(databaseCalls.filter((sql) => sql === "ROLLBACK").length, 2);
  assert.equal(databaseCalls.filter((sql) => sql === "end").length, 2);
  assert.deepEqual(spawnCalls, []);
});

test("runtime/direct catalog disagreement fails without any process", async () => {
  databaseView = (index) => {
    const view = snapshot();
    if (index === 1) view.columns.push({ table_name: "unexpected", column_name: "id", data_type: "text", udt_name: "text" });
    return view;
  };
  await assert.rejects(guard.verifyLogicalTarget(guard.verifyMigrationTarget(local())), /LOGICAL_TARGET_MISMATCH/);
  assert.deepEqual(spawnCalls, []);
});

test("remote catalog checks use verified TLS and the two explicit endpoints (mock only)", async () => {
  databaseView = () => ({ ...snapshot(), database: "postgres" });
  await guard.verifyLogicalTarget(guard.verifyMigrationTarget(remote()));
  assert.equal(databaseConfigs[0].host, "db." + project + ".supabase.co");
  assert.equal(databaseConfigs[1].host, "aws-0-ap-northeast-1.pooler.supabase.com");
  for (const config of databaseConfigs) assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.deepEqual(spawnCalls, []);
});

test("provider connection errors are redacted and the connection is closed", async () => {
  databaseThrows = true;
  await assert.rejects(guard.inspectDatabase(guard.verifyMigrationTarget(local()), "direct"), (error: unknown) => {
    assert.match(String(error), /DATABASE_READ_FAILED/);
    assert.ok(!String(error).includes(sentinel));
    assert.ok(!String(error).includes(localUrl));
    return true;
  });
  assert.deepEqual(databaseCalls, ["connect", "end"]);
});

test("forged target fails before constructing any database client", async () => {
  await assert.rejects(guard.inspectDatabase({ ...guard.verifyMigrationTarget(local()) }, "direct"), /UNVERIFIED_TARGET/);
  assert.deepEqual(databaseConfigs, []);
});

test("schema smoke verifies current scalar columns and rejects a missing one (mock only)", async () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const columns: DatabaseSnapshot["columns"] = [];
  for (const model of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    for (const field of model[2].matchAll(/^\s+(\w+)\s+(\w+)(\?|\[\])?/gm)) {
      if (!models.includes(field[2])) columns.push({ table_name: model[1], column_name: field[1], data_type: "text", udt_name: "text" });
    }
  }
  assert.ok(columns.length > 50);
  const localFiles = await guard.readMigrationFiles();
  databaseView = () => ({
    ...snapshot(), columns,
    migrations: localFiles.map((file) => ({
      migration_name: file.name, checksum: file.checksum,
      finished_at: "2026-01-02", rolled_back_at: null,
    })),
  });
  await guard.verifySchemaSmoke(guard.verifyMigrationTarget(local()));
  columns.pop();
  await assert.rejects(guard.verifySchemaSmoke(guard.verifyMigrationTarget(local())), /SCHEMA_SMOKE_FAILED/);
  assert.deepEqual(spawnCalls, []);
});
