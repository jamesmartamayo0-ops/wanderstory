import { prisma } from "./prisma";
import { sanitizeMetadata } from "./security";
import type {
  AuditEventType,
  AuditTargetType,
  Prisma,
} from "../app/generated/prisma/client";

export type AuditInput = {
  eventType: AuditEventType;
  actorEmail: string;
  actorId?: string | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function audit(input: AuditInput) {
  const safeMetadata = sanitizeMetadata(input.metadata ?? null);

  return prisma.auditLog.create({
    data: {
      eventType: input.eventType,
      actorEmail: input.actorEmail,
      actorId: input.actorId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: safeMetadata === null ? undefined : (safeMetadata as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
