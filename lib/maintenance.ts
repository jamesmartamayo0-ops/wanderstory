import { prisma } from "./prisma";
import { RATE_LIMIT_RETENTION_HOURS } from "./rate-limit";

export const AUDIT_LOG_RETENTION_DAYS = 90;
export const LOGIN_ATTEMPT_RETENTION_DAYS = 90;

function envDays(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function cleanupRateLimits(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RATE_LIMIT_RETENTION_HOURS * 60 * 60 * 1000);
  const result = await prisma.rateLimitEntry.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}

export async function cleanupAuditLogs(now: Date = new Date()): Promise<number> {
  const days = envDays("AUDIT_LOG_RETENTION_DAYS", AUDIT_LOG_RETENTION_DAYS);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

export async function cleanupLoginAttempts(now: Date = new Date()): Promise<number> {
  const days = envDays("LOGIN_ATTEMPT_RETENTION_DAYS", LOGIN_ATTEMPT_RETENTION_DAYS);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

export type MaintenanceSummary = {
  rateLimitsRemoved: number;
  auditLogsRemoved: number;
  loginAttemptsRemoved: number;
};

export async function runSecurityMaintenance(
  now: Date = new Date(),
): Promise<MaintenanceSummary> {
  const [rateLimitsRemoved, auditLogsRemoved, loginAttemptsRemoved] =
    await Promise.all([
      cleanupRateLimits(now),
      cleanupAuditLogs(now),
      cleanupLoginAttempts(now),
    ]);

  return { rateLimitsRemoved, auditLogsRemoved, loginAttemptsRemoved };
}
