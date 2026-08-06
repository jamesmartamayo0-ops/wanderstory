import { prisma } from "./prisma";

export const RATE_LIMIT_RETENTION_HOURS = 24;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
};

function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(now, windowSeconds);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitEntry" ("key", "windowStart", "count", "updatedAt")
    VALUES (${key}, ${windowStart}, 1, NOW())
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimitEntry"."count" + 1, "updatedAt" = NOW()
    RETURNING "count";
  `;

  const count = rows[0]?.count ?? 1;
  const allowed = count <= limit;
  const windowEndMs = windowStart.getTime() + windowSeconds * 1000;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((windowEndMs - now.getTime()) / 1000));

  return {
    allowed,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

export async function countForWindow(
  key: string,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<number> {
  const windowStart = windowStartFor(now, windowSeconds);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM "RateLimitEntry" WHERE "key" = ${key} AND "windowStart" = ${windowStart};
  `;
  return rows[0]?.count ?? 0;
}
