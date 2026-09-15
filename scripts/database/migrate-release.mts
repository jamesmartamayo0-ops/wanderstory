import {
  compareMigrationHistory, defaultChecks, deployPrismaMigrations, isMain,
  MigrationGuardError, reportFailure, verifyMigrationTarget,
  type Environment, type GateChecks,
} from "./verify-migration-target.mjs";

export type ReleaseChecks = GateChecks & { deploy: typeof deployPrismaMigrations };
const defaults: ReleaseChecks = { ...defaultChecks, deploy: deployPrismaMigrations };

/** Explicit operator entry point. Never imported or invoked by prebuild. */
export async function migrateRelease(env: Environment, checks: ReleaseChecks = defaults): Promise<void> {
  const target = verifyMigrationTarget(env);
  checks.log(JSON.stringify(target));
  const files = await checks.files();
  const before = compareMigrationHistory(files, await checks.inspect(target));
  const status = await checks.status(target);
  // Prisma 7 returns 1 for an expected pending suffix too, not only for errors.
  const expectedPending = before.pending.length > 0 && status.exitCode === 1 &&
    JSON.stringify(status.pendingNames) === JSON.stringify(before.pending);
  if (!(status.exitCode === 0 && before.pending.length === 0) && !expectedPending) {
    throw new MigrationGuardError("UNEXPECTED_MIGRATION_STATUS");
  }
  // Recheck immediately before the only mutating command. No automatic retries.
  const rechecked = compareMigrationHistory(files, await checks.inspect(target));
  if (JSON.stringify(rechecked) !== JSON.stringify(before)) throw new MigrationGuardError("MIGRATION_HISTORY_CHANGED");
  if ((await checks.deploy(target)).exitCode !== 0) throw new MigrationGuardError("MIGRATION_DEPLOY_FAILED");
  if ((await checks.status(target)).exitCode !== 0) throw new MigrationGuardError("POST_MIGRATION_STATUS_FAILED");
  const after = compareMigrationHistory(files, await checks.inspect(target));
  if (after.pending.length) throw new MigrationGuardError("PENDING_MIGRATIONS");
  await checks.smoke(target);
  checks.log("Migration release passed; application promotion remains a separate operator action.");
}
if (isMain(import.meta.url)) {
  try { await migrateRelease(process.env); } catch (error) { reportFailure(error); }
}
