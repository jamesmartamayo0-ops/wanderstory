import { runSecurityMaintenance } from "../lib/maintenance";

async function main() {
  const summary = await runSecurityMaintenance();
  console.log(
    JSON.stringify({
      ok: true,
      ...summary,
      ranAt: new Date().toISOString(),
    }),
  );
}

main().catch((error: unknown) => {
  console.error("Security maintenance failed:", error);
  process.exit(1);
});
