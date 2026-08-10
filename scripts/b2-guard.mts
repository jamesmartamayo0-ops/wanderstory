// b2-guard.mts — production-safety guards for the destructive B.2 verification
// scripts (b2-fixtures.mts, b2-replay.mts, b2-cleanup.mts).
//
// Database guard (assertDestructiveScriptSafe) — fail-closed: execution is
// refused UNLESS all of the following hold:
//   1. NODE_ENV is not "production"
//   2. B2_ALLOW_DESTRUCTIVE is set to exactly "true" (explicit operator opt-in)
//   3. DATABASE_URL is present and valid (parses as a URL)
//   4. DATABASE_URL hostname is loopback: localhost | 127.0.0.1 | ::1
//
// Cloudinary guard (assertCloudinaryDestructiveSafe) — fail-closed: execution
// is refused UNLESS all of the following hold:
//   1. CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set
//   2. B2_ALLOWED_CLOUDINARY_CLOUD_NAMES is set (comma-separated allowlist)
//   3. CLOUDINARY_CLOUD_NAME is one of the allowed account names (exact match)
//
// Both guards must be called before any Prisma client construction, database
// query, cloudinary.config(), Cloudinary upload/delete, or file write.

function refuse(context: string, reason: string): never {
  console.error(
    `[${context}] REFUSING TO RUN: ${reason}\n` +
      `This verification script is development-only and must never execute against a production database or Cloudinary account.`
  );
  process.exit(1);
}

export function assertDestructiveScriptSafe(context: string): void {
  if (process.env.NODE_ENV === "production") {
    refuse(context, "NODE_ENV is set to production");
  }
  if (process.env.B2_ALLOW_DESTRUCTIVE !== "true") {
    refuse(context, 'B2_ALLOW_DESTRUCTIVE must be set to exactly "true"');
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    refuse(context, "DATABASE_URL is missing");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    refuse(context, `DATABASE_URL is malformed: "${rawUrl}"`);
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    refuse(context, `DATABASE_URL host "${host}" is not a loopback address`);
  }
  console.log(`[${context}] safety guard passed (local development database confirmed)`);
}

export function assertCloudinaryDestructiveSafe(context: string): void {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    refuse(context, "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set");
  }
  const allowlistRaw = process.env.B2_ALLOWED_CLOUDINARY_CLOUD_NAMES;
  if (!allowlistRaw) {
    refuse(context, "B2_ALLOWED_CLOUDINARY_CLOUD_NAMES must be set to the comma-separated allowlist of test Cloudinary account names");
  }
  const allowed = allowlistRaw.split(",").map((n) => n.trim()).filter(Boolean);
  if (!allowed.includes(process.env.CLOUDINARY_CLOUD_NAME)) {
    refuse(context, `CLOUDINARY_CLOUD_NAME "${process.env.CLOUDINARY_CLOUD_NAME}" is not in B2_ALLOWED_CLOUDINARY_CLOUD_NAMES`);
  }
  console.log(`[${context}] cloudinary guard passed (target account "${process.env.CLOUDINARY_CLOUD_NAME}" is allowlisted)`);
}