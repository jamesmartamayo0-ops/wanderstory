"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import {
  createSocialDraftSchema,
  updateSocialDraftSchema,
  transitionSocialDraftStatusSchema,
  deleteSocialDraftSchema,
} from "@/lib/validation/social-draft.schema";
import * as socialDraftService from "@/services/social-draft.service";
import type {
  SerializedSocialDraft,
  SocialDraftActionResult,
} from "@/types/social-draft";

function forbidden(reason: "UNAUTHORIZED" | "FORBIDDEN") {
  return {
    success: false as const,
    code: reason,
    error: reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

function validationFailure(error?: ZodError) {
  return {
    success: false as const,
    code: "VALIDATION_ERROR" as const,
    error: "Invalid social draft input",
    ...(error && { fieldErrors: error.flatten().fieldErrors }),
  };
}

function operationFailure() {
  return {
    success: false as const,
    code: "OPERATION_FAILED" as const,
    error: "Social draft operation failed",
  };
}

function hasExactFields(formData: FormData, allowed: readonly string[]): boolean {
  if (!(formData instanceof FormData)) return false;
  const seen = new Set<string>();
  for (const [key, value] of formData.entries()) {
    // React includes action transport fields in progressively enhanced forms.
    if (key.startsWith("$ACTION_")) continue;
    if (!allowed.includes(key) || seen.has(key) || typeof value !== "string") {
      return false;
    }
    seen.add(key);
  }
  return true;
}

function mediaInput(formData: FormData) {
  if (!formData.has("mediaId")) return undefined;
  const value = formData.get("mediaId");
  return value === "" ? null : value;
}

function serializeDraft(
  draft: Awaited<ReturnType<typeof socialDraftService.getSocialDraftsByJourney>>[number],
): SerializedSocialDraft {
  return {
    id: draft.id,
    journeyId: draft.journeyId,
    platform: draft.platform,
    caption: draft.caption,
    mediaId: draft.mediaId,
    status: draft.status,
    createdById: draft.createdById,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

// Like TimelineEditor, the caller binds journeyId and adapts useActionState
// with (_previousState, formData) => boundAction(formData).
export async function createSocialDraft(
  journeyId: string,
  formData: FormData,
): Promise<SocialDraftActionResult<{ draft: SerializedSocialDraft; created: boolean }>> {
  try {
    const authz = await requirePermission("social:create", {
      targetType: "JOURNEY",
      targetId: typeof journeyId === "string" ? journeyId : null,
    });
    if (!authz.ok) return forbidden(authz.reason);
    if (!hasExactFields(formData, ["platform", "caption", "mediaId"])) {
      return validationFailure();
    }
    const parsed = createSocialDraftSchema.safeParse({
      journeyId,
      platform: formData.get("platform"),
      caption: formData.has("caption") ? formData.get("caption") : undefined,
      mediaId: mediaInput(formData),
    });
    if (!parsed.success) return validationFailure(parsed.error);

    const result = await socialDraftService.createSocialDraftWithOutcome(
      parsed.data,
      authz.actor.id,
    );
    if (!result.success) return result;
    const { draft, created } = result.data;
    if (created) {
      await auditFromRequest({
        eventType: "SOCIAL_DRAFT_CREATED",
        actorId: authz.actor.id,
        actorEmail: authz.actor.email,
        targetType: "SOCIAL_DRAFT",
        targetId: draft.id,
        metadata: { journeyId },
      });
    }
    revalidatePath(`/admin/journeys/${journeyId}/social`);
    return { success: true, data: { draft: serializeDraft(draft), created } };
  } catch {
    return operationFailure();
  }
}

export async function updateSocialDraft(
  journeyId: string,
  formData: FormData,
): Promise<SocialDraftActionResult> {
  try {
    const authz = await requirePermission("social:update", {
      targetType: "JOURNEY",
      targetId: typeof journeyId === "string" ? journeyId : null,
    });
    if (!authz.ok) return forbidden(authz.reason);
    if (!hasExactFields(formData, ["draftId", "updatedAt", "caption", "mediaId"])) {
      return validationFailure();
    }
    const parsed = updateSocialDraftSchema.safeParse({
      journeyId,
      draftId: formData.get("draftId"),
      updatedAt: formData.get("updatedAt"),
      ...(formData.has("caption") && { caption: formData.get("caption") }),
      ...(formData.has("mediaId") && { mediaId: mediaInput(formData) }),
    });
    if (!parsed.success) return validationFailure(parsed.error);

    const result = await socialDraftService.updateSocialDraft(parsed.data);
    if (!result.success) return result;
    const fields = ["caption", "mediaId"].filter((field) => formData.has(field));
    await auditFromRequest({
      eventType: "SOCIAL_DRAFT_UPDATED",
      actorId: authz.actor.id,
      actorEmail: authz.actor.email,
      targetType: "SOCIAL_DRAFT",
      targetId: result.data.id,
      metadata: { journeyId, fields },
    });
    revalidatePath(`/admin/journeys/${journeyId}/social`);
    return { success: true, data: serializeDraft(result.data) };
  } catch {
    return operationFailure();
  }
}

export async function transitionSocialDraftStatus(
  journeyId: string,
  formData: FormData,
): Promise<SocialDraftActionResult> {
  try {
    const authz = await requirePermission("social:ready", {
      targetType: "JOURNEY",
      targetId: typeof journeyId === "string" ? journeyId : null,
    });
    if (!authz.ok) return forbidden(authz.reason);
    if (!hasExactFields(formData, ["draftId", "updatedAt", "targetStatus"])) {
      return validationFailure();
    }
    const parsed = transitionSocialDraftStatusSchema.safeParse({
      journeyId,
      draftId: formData.get("draftId"),
      updatedAt: formData.get("updatedAt"),
      targetStatus: formData.get("targetStatus"),
    });
    if (!parsed.success) return validationFailure(parsed.error);

    const result = await socialDraftService.transitionSocialDraftStatus(parsed.data);
    if (!result.success) return result;
    await auditFromRequest({
      eventType: "SOCIAL_DRAFT_STATUS_CHANGED",
      actorId: authz.actor.id,
      actorEmail: authz.actor.email,
      targetType: "SOCIAL_DRAFT",
      targetId: result.data.id,
      metadata: {
        journeyId,
        fromStatus: parsed.data.targetStatus === "READY" ? "DRAFT" : "READY",
        toStatus: parsed.data.targetStatus,
      },
    });
    revalidatePath(`/admin/journeys/${journeyId}/social`);
    return { success: true, data: serializeDraft(result.data) };
  } catch {
    return operationFailure();
  }
}

export async function deleteSocialDraft(
  journeyId: string,
  formData: FormData,
): Promise<SocialDraftActionResult<null>> {
  try {
    const authz = await requirePermission("social:delete", {
      targetType: "JOURNEY",
      targetId: typeof journeyId === "string" ? journeyId : null,
    });
    if (!authz.ok) return forbidden(authz.reason);
    if (!hasExactFields(formData, ["draftId"])) return validationFailure();
    const parsed = deleteSocialDraftSchema.safeParse({
      journeyId,
      draftId: formData.get("draftId"),
    });
    if (!parsed.success) return validationFailure(parsed.error);

    const result = await socialDraftService.deleteSocialDraft(parsed.data);
    if (!result.success) return result;
    await auditFromRequest({
      eventType: "SOCIAL_DRAFT_DELETED",
      actorId: authz.actor.id,
      actorEmail: authz.actor.email,
      targetType: "SOCIAL_DRAFT",
      targetId: parsed.data.draftId,
      metadata: { journeyId },
    });
    revalidatePath(`/admin/journeys/${journeyId}/social`);
    return { success: true, data: null };
  } catch {
    return operationFailure();
  }
}
