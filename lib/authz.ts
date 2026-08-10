import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { canAccess, type PermissionKey, type AdminRole } from "@/lib/permissions";
import { auditFromRequest } from "@/lib/audit";
import type {
  AuditTargetType,
  Prisma,
} from "../app/generated/prisma/client";

export type AuthzResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" };

export type PermissionResult =
  | {
      ok: true;
      actor: { id: string; email: string; name?: string | null; role: AdminRole };
    }
  | { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" };

export async function requireAdminAuth(): Promise<AuthzResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }
  return { ok: true, session };
}

export async function requireRole(
  requiredRole: "SUPER_ADMIN"
): Promise<AuthzResult> {
  const base = await requireAdminAuth();
  if (!base.ok) {
    return base;
  }
  if (base.session.user.role !== requiredRole) {
    return { ok: false, reason: "FORBIDDEN" };
  }
  return base;
}

export type PermissionTarget = {
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function requirePermission(
  permission: PermissionKey,
  target?: PermissionTarget
): Promise<PermissionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }

  const role = session.user.role as AdminRole;
  if (!canAccess(role, permission)) {
    await auditFromRequest({
      eventType: "AUTHORIZATION_DENIED",
      actorEmail: (session.user.email as string) ?? "unknown",
      actorId: (session.user.id as string) ?? null,
      targetType: target?.targetType ?? null,
      targetId: target?.targetId ?? null,
      metadata: {
        permission,
        ...(target?.metadata ? { ...(target.metadata as object) } : {}),
      } as Prisma.InputJsonValue,
    });
    return { ok: false, reason: "FORBIDDEN" };
  }

  return {
    ok: true,
    actor: {
      id: session.user.id as string,
      email: session.user.email as string,
      name: session.user.name ?? null,
      role,
    },
  };
}
