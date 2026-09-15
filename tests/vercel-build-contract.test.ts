import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel pins the npm build lifecycle and preserves the security cron", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(config.buildCommand, "npm run build");
  assert.deepEqual(config.crons, [{
    path: "/api/cron/security-maintenance", schedule: "0 2 * * *",
  }]);
  assert.deepEqual(Object.keys(config).sort(), ["buildCommand", "crons"]);
  for (const key of ["builds", "routes", "outputDirectory", "installCommand", "framework"]) {
    assert.equal(Object.hasOwn(config, key), false, `${key} must remain absent`);
  }
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(scripts.prebuild, "tsx scripts/database/assert-migrations-applied.mts");
  assert.equal(scripts.build, "next build --turbopack");
});
