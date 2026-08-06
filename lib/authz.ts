import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export type AuthzResult =
  | { ok: true; session: Session }
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
