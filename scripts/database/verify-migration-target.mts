import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";

export type Environment = Readonly<Record<string, string | undefined>>;
export type TargetEnvironment = "local" | "preview" | "production";
export type MigrationTarget = Readonly<{
  environment: TargetEnvironment;
  runtime: Readonly<{ host: string; port: number; database: string }>;
  direct: Readonly<{ host: string; port: number; database: string }>;
  topology: "loopback" | "supabase";
}>;
type Endpoint = { url: string; host: string; port: number; database: string; user: string; password: string };
type Secrets = { runtime: Endpoint; direct: Endpoint };
const verifiedTargets = new WeakMap<MigrationTarget, Secrets>();
export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const localRequire = createRequire(import.meta.url);

// Only static application-authored messages reach callers or the console.
export class MigrationGuardError extends Error {
  constructor(public readonly code: string) {
    super("Migration safety check failed: " + code);
    this.name = "MigrationGuardError";
  }
}
function fail(code: string): never { throw new MigrationGuardError(code); }
function required(env: Environment, key: string): string {
  const value = env[key];
  if (!value || !value.trim()) fail("MISSING_" + key);
  return value;
}
function normalizedHost(value: string): string {
  return value.toLowerCase().replace(/^\[|\]$/g, "");
}
function expectedPort(env: Environment, key: string): number {
  const value = required(env, key);
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) fail("INVALID_EXPECTED_PORT");
  return Number(value);
}
function endpoint(value: string, kind: "runtime" | "direct"): Endpoint {
  try {
    if (value !== value.trim() || /[\u0000-\u0020\\]/.test(value)) fail("INVALID_DATABASE_URL");
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash) fail("INVALID_DATABASE_URL");
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(database)) fail("INVALID_DATABASE_NAME");
    const host = normalizedHost(url.hostname);
    if (!host || !/^[a-z0-9.:-]+$/.test(host)) fail("INVALID_DATABASE_HOST");
    // No host/port/options override may be smuggled through a query parameter.
    for (const key of url.searchParams.keys()) {
      if (!["schema", "sslmode", "pgbouncer"].includes(key) || url.searchParams.getAll(key).length !== 1) {
        fail("UNSUPPORTED_DATABASE_OPTIONS");
      }
    }
    // Endpoint identity comes only from the caller; topology is checked below.
    if (url.searchParams.has("pgbouncer") &&
        (kind !== "runtime" || url.searchParams.get("pgbouncer") !== "true")) {
      fail("UNSUPPORTED_DATABASE_OPTIONS");
    }
    if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") {
      fail("UNSUPPORTED_DATABASE_SCHEMA");
    }
    const sslMode = url.searchParams.get("sslmode");
    if (sslMode !== null && !["require", "verify-full"].includes(sslMode)) fail("UNSAFE_DATABASE_TLS");
    const port = Number(url.port || 5432);
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (!user || !password || /[\u0000-\u001f\u007f]/.test(user + password)) fail("INVALID_DATABASE_CREDENTIALS");
    return { url: value, host, port, database, user, password };
  } catch (error) {
    if (error instanceof MigrationGuardError) throw error;
    return fail("INVALID_DATABASE_URL");
  }
}

/** Pure: no dotenv, Prisma config, process spawning, or DB connection. */
export function verifyMigrationTarget(env: Environment): MigrationTarget {
  const environment = required(env, "MIGRATION_TARGET_ENVIRONMENT");
  if (!["local", "preview", "production"].includes(environment)) fail("INVALID_TARGET_ENVIRONMENT");
  // Check both values before parsing either one.
  const runtimeUrl = required(env, "DATABASE_URL");
  const directUrl = required(env, "DIRECT_URL");
  const expectedDatabase = required(env, "MIGRATION_EXPECTED_DATABASE");
  const runtimeHost = normalizedHost(required(env, "MIGRATION_EXPECTED_RUNTIME_HOST"));
  const directHost = normalizedHost(required(env, "MIGRATION_EXPECTED_DIRECT_HOST"));
  const runtimePort = expectedPort(env, "MIGRATION_EXPECTED_RUNTIME_PORT");
  const directPort = expectedPort(env, "MIGRATION_EXPECTED_DIRECT_PORT");
  const runtime = endpoint(runtimeUrl, "runtime");
  const direct = endpoint(directUrl, "direct");
  if (runtime.database !== expectedDatabase || direct.database !== expectedDatabase) fail("DATABASE_MISMATCH");
  if (runtime.host !== runtimeHost || direct.host !== directHost) fail("HOST_MISMATCH");
  if (runtime.port !== runtimePort || direct.port !== directPort) fail("PORT_MISMATCH");
  if (env.VERCEL === "1" && (env.VERCEL_ENV !== environment || environment === "local")) {
    fail("VERCEL_ENVIRONMENT_MISMATCH");
  }
  let topology: MigrationTarget["topology"];
  if (environment === "local") {
    const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!loopback.has(runtime.host) || !loopback.has(direct.host)) fail("LOCAL_REQUIRES_LOOPBACK");
    if (runtime.host !== direct.host || runtime.port !== direct.port) fail("LOGICAL_TARGET_MISMATCH");
    topology = "loopback";
  } else {
    const project = required(env, "MIGRATION_EXPECTED_PROJECT_REF");
    const productionProject = required(env, "MIGRATION_PRODUCTION_PROJECT_REF");
    if (!/^[a-z0-9]{20}$/.test(project) || !/^[a-z0-9]{20}$/.test(productionProject)) {
      fail("INVALID_PROJECT_REFERENCE");
    }
    if ((environment === "production") !== (project === productionProject)) fail("REMOTE_ENVIRONMENT_MISMATCH");
    const host = "db." + project + ".supabase.co";
    const isDirect = (entry: Endpoint) => entry.host === host && entry.port === 5432 && entry.user === "postgres";
    const isPooler = (entry: Endpoint) =>
      /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(entry.host) &&
      [5432, 6543].includes(entry.port) && entry.user === "postgres." + project;
    if (!(isDirect(runtime) || isPooler(runtime)) ||
        !(isDirect(direct) || (isPooler(direct) && direct.port === 5432))) {
      fail("UNPROVEN_REMOTE_TOPOLOGY");
    }
    for (const entry of [runtime, direct]) {
      if (!new URL(entry.url).searchParams.has("sslmode")) fail("REMOTE_TLS_REQUIRED");
    }
    topology = "supabase";
  }
  // Proven remote topology permits port 6543 only for the Supabase pooler.
  if (new URL(runtime.url).searchParams.has("pgbouncer") &&
      (topology !== "supabase" || runtime.port !== 6543)) {
    fail("UNSUPPORTED_DATABASE_OPTIONS");
  }
  const safeEndpoint = (entry: Endpoint) => Object.freeze({
    host: topology === "loopback" ? entry.host : "[verified-supabase-host]",
    port: entry.port, database: entry.database,
  });
  const target = Object.freeze({
    environment: environment as TargetEnvironment,
    runtime: safeEndpoint(runtime), direct: safeEndpoint(direct), topology,
  });
  verifiedTargets.set(target, { runtime, direct });
  return target;
}
function secretsFor(target: MigrationTarget): Secrets {
  return verifiedTargets.get(target) ?? fail("UNVERIFIED_TARGET");
}

export type MigrationFile = { name: string; checksum: string };
export type MigrationRow = {
  migration_name: string; checksum: string; finished_at: string | null; rolled_back_at: string | null;
};
export type DatabaseSnapshot = {
  database: string;
  migrationsTable: boolean;
  migrations: MigrationRow[];
  columns: Array<{ table_name: string; column_name: string; data_type: string; udt_name: string }>;
};
export type HistoryResult = { pending: string[] };

export async function readMigrationFiles(): Promise<MigrationFile[]> {
  try {
    const root = resolve(repositoryRoot, "prisma/migrations");
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    if (!directories.length || directories.some((name) => !/^\d{14}_[a-z0-9_]+$/.test(name))) {
      fail("INVALID_LOCAL_MIGRATIONS");
    }
    return await Promise.all(directories.map(async (name) => ({
      name,
      checksum: createHash("sha256").update(await readFile(resolve(root, name, "migration.sql"))).digest("hex"),
    })));
  } catch (error) {
    if (error instanceof MigrationGuardError) throw error;
    return fail("LOCAL_MIGRATIONS_UNREADABLE");
  }
}

export function compareMigrationHistory(files: MigrationFile[], snapshot: DatabaseSnapshot): HistoryResult {
  if (!snapshot.migrationsTable) fail("UNMANAGED_DATABASE");
  const applied = new Set<string>();
  for (const row of snapshot.migrations) {
    const file = files.find((entry) => entry.name === row.migration_name);
    if (!file || file.checksum !== row.checksum) fail("MIGRATION_HISTORY_DIVERGED");
    if (row.rolled_back_at !== null) continue;
    if (row.finished_at === null) fail("FAILED_MIGRATION_HISTORY");
    if (applied.has(row.migration_name)) fail("DUPLICATE_MIGRATION_HISTORY");
    applied.add(row.migration_name);
  }
  let pendingSeen = false;
  for (const file of files) {
    if (!applied.has(file.name)) pendingSeen = true;
    else if (pendingSeen) fail("MIGRATION_HISTORY_DIVERGED");
  }
  return { pending: files.filter((file) => !applied.has(file.name)).map((file) => file.name) };
}

/** Fresh pg connections, READ ONLY transactions; no Prisma config import. */
export async function inspectDatabase(target: MigrationTarget, kind: "runtime" | "direct"): Promise<DatabaseSnapshot> {
  const entry = secretsFor(target)[kind];
  const { Client } = await import("pg");
  const client = new Client({
    host: entry.host, port: entry.port, database: entry.database,
    user: entry.user, password: entry.password,
    ssl: target.topology === "supabase" ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 10000, query_timeout: 10000,
    statement_timeout: 10000, application_name: "wanderstory-migration-guard",
    options: "-c default_transaction_read_only=on",
  });
  // Do not allow EventEmitter errors to print a provider exception.
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const identity = await client.query<{ database: string; migrations_table: string | null }>(
      "SELECT current_database() AS database, to_regclass('public._prisma_migrations')::text AS migrations_table",
    );
    const migrationsTable = identity.rows[0].migrations_table !== null;
    const rows = migrationsTable ? (await client.query<MigrationRow>(
      'SELECT migration_name, checksum, finished_at::text, rolled_back_at::text FROM public."_prisma_migrations" ORDER BY migration_name, started_at',
    )).rows : [];
    const columns = (await client.query<DatabaseSnapshot["columns"][number]>(
      "SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
    )).rows;
    await client.query("ROLLBACK");
    if (identity.rows[0].database !== target[kind].database) fail("CONNECTED_DATABASE_MISMATCH");
    return { database: identity.rows[0].database, migrationsTable, migrations: rows, columns };
  } catch {
    return fail("DATABASE_READ_FAILED");
  } finally {
    await client.end().catch(() => {});
  }
}

export async function verifyLogicalTarget(target: MigrationTarget): Promise<DatabaseSnapshot> {
  const direct = await inspectDatabase(target, "direct");
  const runtime = await inspectDatabase(target, "runtime");
  if (JSON.stringify(direct) !== JSON.stringify(runtime)) fail("LOGICAL_TARGET_MISMATCH");
  return direct;
}

/** Checks every scalar column currently declared by the trusted repo schema. */
export async function verifySchemaSmoke(target: MigrationTarget): Promise<void> {
  const snapshot = await verifyLogicalTarget(target);
  const history = compareMigrationHistory(await readMigrationFiles(), snapshot);
  if (history.pending.length) fail("PENDING_MIGRATIONS");
  const schema = await readFile(resolve(repositoryRoot, "prisma/schema.prisma"), "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  for (const model of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    for (const field of model[2].matchAll(/^\s+(\w+)\s+(\w+)(\?|\[\])?/gm)) {
      if (modelNames.includes(field[2])) continue; // Relation-only fields have no SQL column.
      if (!snapshot.columns.some((column) => column.table_name === model[1] && column.column_name === field[1])) {
        fail("SCHEMA_SMOKE_FAILED");
      }
    }
  }
}

export type CommandResult = { exitCode: number; pendingNames: string[] | null };
type FixedCommand = "status" | "deploy";
// No raw child output is returned or forwarded. Only the exact pending list is recognized.
export function classifyCommandOutput(exitCode: number, stdout: string, stderr: string): CommandResult {
  const pending = stdout.match(/Following migrations? have not yet been applied:\r?\n((?:\d{14}_[a-z0-9_]+\r?\n)+)/);
  return {
    exitCode,
    pendingNames: exitCode === 1 && pending && !/error|failed|diverg/i.test(stderr)
      ? pending[1].trim().split(/\r?\n/) : null,
  };
}
function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== "" && path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path);
}
async function resolveLocalPrismaCli(): Promise<string> {
  try {
    // The package's root export is a type entry, not its executable. Resolve the
    // exported metadata, then its CLI bin relative to the verified local package.
    const dependencies = await realpath(resolve(repositoryRoot, "node_modules"));
    const metadataPath = await realpath(localRequire.resolve("prisma/package.json"));
    const packageRoot = await realpath(resolve(dependencies, "prisma"));
    if (!isWithin(dependencies, packageRoot) || dirname(metadataPath) !== packageRoot ||
        !(await stat(metadataPath)).isFile()) fail("LOCAL_PRISMA_CLI_UNAVAILABLE");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const bin = metadata.bin?.prisma;
    if (metadata.name !== "prisma" || typeof bin !== "string" || isAbsolute(bin)) {
      fail("LOCAL_PRISMA_CLI_UNAVAILABLE");
    }
    const candidate = resolve(packageRoot, bin);
    if (!isWithin(packageRoot, candidate)) fail("LOCAL_PRISMA_CLI_UNAVAILABLE");
    const cli = await realpath(candidate);
    if (!isWithin(packageRoot, cli) || ![".js", ".cjs", ".mjs"].includes(extname(cli)) ||
        !(await stat(cli)).isFile()) fail("LOCAL_PRISMA_CLI_UNAVAILABLE");
    return cli;
  } catch {
    return fail("LOCAL_PRISMA_CLI_UNAVAILABLE");
  }
}
async function runFixedPrisma(target: MigrationTarget, command: FixedCommand): Promise<CommandResult> {
  const credentials = secretsFor(target);
  if (command !== "status" && command !== "deploy") fail("COMMAND_NOT_ALLOWED");
  const cli = await resolveLocalPrismaCli();
  const childEnv: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
    if (process.env[key]) childEnv[key] = process.env[key];
  }
  Object.assign(childEnv, {
    DATABASE_URL: credentials.runtime.url, DIRECT_URL: credentials.direct.url,
    DOTENV_CONFIG_PATH: resolve(repositoryRoot, "node_modules/.migration-guard-no-env"),
    DOTENV_CONFIG_QUIET: "true", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1",
  });
  return new Promise((resolveResult, reject) => {
    let settled = false;
    let size = 0;
    let stdout = "";
    let stderr = "";
    const rejectSafe = () => {
      if (!settled) { settled = true; reject(new MigrationGuardError("PRISMA_PROCESS_FAILED")); }
    };
    try {
      const child = spawn(process.execPath, [cli, "migrate", command], {
          shell: false, windowsHide: true, cwd: repositoryRoot,
          env: childEnv, stdio: ["ignore", "pipe", "pipe"],
        });
      const timeout = setTimeout(() => { rejectSafe(); child.kill(); }, 120000);
      const collect = (stream: "stdout" | "stderr", chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024) { rejectSafe(); child.kill(); return; }
        if (stream === "stdout") stdout += chunk.toString("utf8"); else stderr += chunk.toString("utf8");
      };
      child.stdout.on("data", (chunk: Buffer) => collect("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => collect("stderr", chunk));
      child.on("error", () => { clearTimeout(timeout); rejectSafe(); });
      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        if (settled) return;
        if (signal || code === null) { rejectSafe(); return; }
        settled = true;
        resolveResult(classifyCommandOutput(code, stdout, stderr));
      });
    } catch { rejectSafe(); }
  });
}
export const readPrismaStatus = (target: MigrationTarget) => runFixedPrisma(target, "status");
// Only the release runner imports this capability; prebuild has no deploy dependency.
export const deployPrismaMigrations = (target: MigrationTarget) => runFixedPrisma(target, "deploy");

export const defaultChecks = {
  files: readMigrationFiles, inspect: verifyLogicalTarget, status: readPrismaStatus,
  smoke: verifySchemaSmoke, log: (message: string) => console.log(message),
};
export type GateChecks = typeof defaultChecks;

export function reportFailure(error: unknown): void {
  console.error(error instanceof MigrationGuardError ? error.message : "Migration safety check failed: OPERATION_FAILED");
  process.exitCode = 1;
}
export function isMain(url: string): boolean {
  return !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;
}
if (isMain(import.meta.url)) {
  try {
    const target = verifyMigrationTarget(process.env);
    console.log(JSON.stringify(target));
    await verifyLogicalTarget(target);
    console.log("Migration target verified.");
  } catch (error) { reportFailure(error); }
}
