import {
  compareMigrationHistory, defaultChecks, isMain, MigrationGuardError,
  reportFailure, verifyMigrationTarget, type Environment, type GateChecks,
} from "./verify-migration-target.mjs";

export async function assertMigrationsApplied(env: Environment, checks: GateChecks = defaultChecks): Promise<"skipped" | "ready"> {
  if (env.VERCEL !== undefined && env.VERCEL !== "1") {
    // A genuine Vercel build must not be made to skip by a malformed marker.
    if (env.VERCEL_ENV) throw new MigrationGuardError("INVALID_VERCEL_MARKER");
  }
  if (env.VERCEL === "1") {
    if (!["preview", "production"].includes(env.VERCEL_ENV ?? "") ||
        env.MIGRATION_TARGET_ENVIRONMENT !== env.VERCEL_ENV) {
      throw new MigrationGuardError("VERCEL_ENVIRONMENT_MISMATCH");
    }
  } else if (env.MIGRATION_STATUS_GATE !== "1") {
    if (env.VERCEL_ENV) throw new MigrationGuardError("INVALID_VERCEL_MARKER");
    if (env.MIGRATION_STATUS_GATE && env.MIGRATION_STATUS_GATE !== "0") {
      throw new MigrationGuardError("INVALID_STATUS_GATE_MARKER");
    }
    checks.log("Migration deployment gate skipped: ordinary local build (no deployment or verification marker).");
    return "skipped";
  }
  const target = verifyMigrationTarget(env);
  checks.log(JSON.stringify(target));
  const history = compareMigrationHistory(await checks.files(), await checks.inspect(target));
  const status = await checks.status(target);
  if (history.pending.length || status.exitCode !== 0) throw new MigrationGuardError("MIGRATIONS_NOT_READY");
  await checks.smoke(target);
  checks.log("Migration deployment gate passed.");
  return "ready";
}
if (isMain(import.meta.url)) {
  try { await assertMigrationsApplied(process.env); } catch (error) { reportFailure(error); }
}
