import { prisma } from "./prisma";
import { loginEmailKey, loginIpKey } from "./security";
import type { PrismaClient } from "../app/generated/prisma/client";

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

export function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions,
  now: Date = new Date(),
  db: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(now, windowSeconds);

  const rows = await db.$queryRaw<{ count: number }[]>`
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

export async function resetRateLimit(
  key: string,
  db: Pick<PrismaClient, "rateLimitEntry"> = prisma,
): Promise<number> {
  const result = await db.rateLimitEntry.deleteMany({ where: { key } });
  return result.count;
}

export type LoginRateLimitOptions = {
  limit: number;
  windowSeconds: number;
  trustProxy?: boolean;
};

export type LoginRateLimitResult = {
  allowed: boolean;
  emailCount: number;
  retryAfterSeconds: number;
  infraFailure: boolean;
};

export async function checkLoginRateLimit(
  email: string,
  ip: string | null | undefined,
  { limit, windowSeconds, trustProxy = false }: LoginRateLimitOptions,
  now: Date = new Date(),
  db: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<LoginRateLimitResult> {
  try {
    const emailResult = await checkRateLimit(
      loginEmailKey(email),
      { limit, windowSeconds },
      now,
      db,
    );

    let ipResult: RateLimitResult | null = null;
    if (emailResult.allowed && trustProxy) {
      const ipKey = loginIpKey(ip);
      if (ipKey) {
        ipResult = await checkRateLimit(
          ipKey,
          { limit, windowSeconds },
          now,
          db,
        );
      }
    }

    const ipBlocked = ipResult !== null && !ipResult.allowed;
    return {
      allowed: emailResult.allowed && !ipBlocked,
      emailCount: emailResult.count,
      retryAfterSeconds:
        ipBlocked && emailResult.allowed
          ? (ipResult?.retryAfterSeconds ?? 0)
          : emailResult.retryAfterSeconds,
      infraFailure: false,
    };
  } catch (error) {
    console.error("Rate limit check failed; failing closed:", error);
    return {
      allowed: false,
      emailCount: 0,
      retryAfterSeconds: 0,
      infraFailure: true,
    };
  }
}
