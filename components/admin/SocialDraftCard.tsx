"use client";

import { useEffect, useReducer, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import MediaPicker from "./MediaPicker";
import type {
  SerializedSocialDraft,
  SocialDraftActionErrorCode,
  SocialDraftActionResult,
  SocialStudioData,
  SocialStudioMediaItem,
  SocialStudioPreview,
} from "@/types/social-draft";

type StudioEntry = SocialStudioData["drafts"][number];
type Mutation = "create" | "update" | "ready" | "revert" | "delete";
type CardError = {
  code: SocialDraftActionErrorCode | "TRANSPORT";
  fieldErrors?: Record<string, string[]>;
};
export type SocialDraftCardProps = {
  platform: SerializedSocialDraft["platform"];
  entry: StudioEntry | null;
  renderId: string;
  journeyStatus: SocialStudioData["journey"]["status"];
  media: SocialStudioMediaItem[];
  defaultPreview: SocialStudioPreview;
  capabilities: { create: boolean; update: boolean; ready: boolean; delete: boolean };
  createAction: (form: FormData) => Promise<SocialDraftActionResult<{ draft: SerializedSocialDraft; created: boolean }>>;
  updateAction: (form: FormData) => Promise<SocialDraftActionResult>;
  transitionAction: (form: FormData) => Promise<SocialDraftActionResult>;
  deleteAction: (form: FormData) => Promise<SocialDraftActionResult<null>>;
};

const reasonLabels: Record<StudioEntry["eligibility"]["reasons"][number], string> = {
  EDITORIAL_NOT_READY: "Mark this draft Ready after completing it.",
  JOURNEY_NOT_PUBLISHED: "Publish the Journey before sharing this draft publicly.",
  JOURNEY_NOT_PUBLIC: "The Journey must have Public visibility.",
  PUBLICATION_CONSENT_MISSING: "Publication consent has not been given.",
  CAPTION_REQUIRED: "Add and save a caption.",
  INSTAGRAM_MEDIA_REQUIRED: "Select and save an image for Instagram. Preview images do not count.",
  MEDIA_UNTRUSTED: "The selected image is no longer an allowed image for this Journey. Replace or remove it after reverting to Draft if necessary.",
  SITE_ORIGIN_UNAVAILABLE: "The public site address is unavailable. Ask a site administrator to check its configuration.",
};
const errorLabels: Record<CardError["code"], string> = {
  VALIDATION_ERROR: "Check the draft fields below and try again.",
  NOT_FOUND: "This draft is no longer available. Reload the latest version.",
  ALREADY_ARCHIVED: "This Journey is archived. Social drafts are read-only. Your local text is preserved for copying.",
  INVALID_MEDIA: "The selected image is not an allowed image for this Journey. Choose another image or clear the selection while in Draft.",
  INVALID_TRANSITION: "The draft status changed. Reload the latest version before changing its status.",
  EDITORIAL_INCOMPLETE: "Save a caption and, for Instagram, a selected image. The Journey must be Approved or Published before marking Ready.",
  READY_LOCKED: "This draft is Ready. Reload the latest version, then Revert to Draft before editing.",
  CONFLICT: "This draft changed since you opened it. Reload the latest version before saving again.",
  OPERATION_FAILED: "The operation could not be confirmed. Your edits are preserved. Reload the latest version before trying again.",
  UNAUTHORIZED: "Your session is unavailable. Sign in again, then reload the latest version. Your local edits are preserved.",
  FORBIDDEN: "You do not have permission for this operation. Reload after your access has been checked.",
  TRANSPORT: "Completion could not be confirmed because the connection or page version changed. Your edits are preserved. Reload the latest version before trying again.",
};

export type SocialDraftCardState = {
  saved: SerializedSocialDraft | null;
  caption: string;
  mediaId: string | null;
  editingUpdatedAt: string | null;
  pending: Mutation | "reload" | null;
  request: number;
  error: CardError | null;
  success: string;
  seenRenderId: string;
  deletedId: string | null;
};
export function initialSocialDraftCardState(
  saved: SerializedSocialDraft | null,
  renderId: string,
): SocialDraftCardState {
  return {
    saved, caption: saved?.caption ?? "", mediaId: saved?.mediaId ?? null,
    editingUpdatedAt: saved?.updatedAt ?? null, pending: null, request: 0,
    error: null, success: "", seenRenderId: renderId, deletedId: null,
  };
}
export function isSocialDraftCardDirty(state: SocialDraftCardState): boolean {
  return state.caption !== (state.saved?.caption ?? "") || state.mediaId !== (state.saved?.mediaId ?? null);
}
function requiresReload(error: CardError | null): boolean {
  return error !== null && !["VALIDATION_ERROR", "INVALID_MEDIA", "EDITORIAL_INCOMPLETE"].includes(error.code);
}
type CardEvent =
  | { type: "caption"; value: string }
  | { type: "media"; value: string | null }
  | { type: "begin"; operation: Mutation; request: number }
  | { type: "accepted"; saved: SerializedSocialDraft | null; request: number; message: string }
  | { type: "failed"; error: CardError; request: number }
  | { type: "reload" }
  | { type: "server"; saved: SerializedSocialDraft | null; renderId: string; refreshing: boolean };

// Kept next to the UI so the receipt/reconciliation invariants can be unit-tested
// without confusing those tests with real browser/Server Action acceptance.
export function socialDraftCardReducer(state: SocialDraftCardState, event: CardEvent): SocialDraftCardState {
  switch (event.type) {
    case "caption": return { ...state, caption: event.value, success: "" };
    case "media": return { ...state, mediaId: event.value, success: "" };
    case "begin": return { ...state, pending: event.operation, request: event.request, error: null, success: "" };
    case "accepted": {
      if (event.request !== state.request || state.pending === null || state.pending === "reload") return state;
      if (state.saved && event.saved?.id === state.saved.id && event.saved.updatedAt < state.saved.updatedAt) return { ...state, pending: null };
      return {
        ...initialSocialDraftCardState(event.saved, state.seenRenderId),
        request: state.request, success: event.message,
        deletedId: event.saved === null ? state.saved?.id ?? null : state.deletedId,
      };
    }
    case "failed":
      return event.request === state.request && state.pending !== null && state.pending !== "reload"
        ? { ...state, pending: null, error: event.error, success: "" } : state;
    case "reload": return { ...state, pending: "reload", success: "" };
    case "server": {
      if (event.renderId === state.seenRenderId) return state;
      if (state.pending === "reload") {
        if (event.refreshing) return state;
        return { ...initialSocialDraftCardState(event.saved, event.renderId), request: state.request, success: "Latest saved version loaded." };
      }
      const observed = { ...state, seenRenderId: event.renderId };
      // In particular, never attach a refreshed timestamp to dirty local values.
      if (state.pending || isSocialDraftCardDirty(state) || requiresReload(state.error)) return observed;
      if (event.saved && event.saved.id === state.deletedId) return observed;
      if (state.saved && event.saved?.id === state.saved.id && event.saved.updatedAt < state.saved.updatedAt) return observed;
      return {
        ...initialSocialDraftCardState(event.saved, event.renderId),
        request: state.request, success: state.success, deletedId: state.deletedId,
      };
    }
  }
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function SocialDraftCard(props: SocialDraftCardProps) {
  const { platform, entry, renderId, journeyStatus, media, defaultPreview, capabilities } = props;
  const label = platform === "FACEBOOK" ? "Facebook" : "Instagram";
  const prefix = `social-${platform.toLowerCase()}`;
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // A per-card display preference survives the no-draft → created transition.
  const [previewOpen, setPreviewOpen] = useState(true);
  const [state, dispatch] = useReducer(socialDraftCardReducer, undefined, () => initialSocialDraftCardState(entry?.draft ?? null, renderId));
  const inFlight = useRef(false);
  const sequence = useRef(0);

  useEffect(() => {
    dispatch({ type: "server", saved: entry?.draft ?? null, renderId, refreshing });
  }, [entry, renderId, refreshing]);
  useEffect(() => {
    // Release only after the receipt/error has committed, including synchronous
    // actions whose begin and completion are batched into one render.
    if (state.pending === null) inFlight.current = false;
  }, [state.pending, state.request]);
  useEffect(() => () => { sequence.current += 1; }, []);

  const dirty = isSocialDraftCardDirty(state);
  const archived = journeyStatus === "ARCHIVED" || state.error?.code === "ALREADY_ARCHIVED";
  const locked = archived || requiresReload(state.error);
  const busy = state.pending !== null;
  const ready = state.saved?.status === "READY";
  const editable = Boolean(state.saved) && !ready && !locked && !busy && capabilities.update;
  const localMedia = media.find((item) => item.id === state.mediaId);
  const persistedPreview = entry?.preview.source === "SELECTED" && entry.preview.mediaId === state.mediaId
    ? entry.preview : null;
  const selectionChanged = state.mediaId !== (state.saved?.mediaId ?? null);
  const preview: SocialStudioPreview = localMedia && (selectionChanged || state.saved?.mediaId === localMedia.id)
    ? { mediaId: localMedia.id, url: localMedia.url, altText: localMedia.altText || localMedia.fileName, source: "SELECTED" }
    : state.mediaId && persistedPreview ? persistedPreview : defaultPreview;
  const savedMediaTrusted = state.saved?.mediaId !== null && state.saved?.mediaId !== undefined && (
    media.some((item) => item.id === state.saved?.mediaId) ||
    (entry?.preview.source === "SELECTED" && entry.preview.mediaId === state.saved.mediaId)
  );
  const canReady = Boolean(state.saved?.caption.trim()) &&
    (platform !== "INSTAGRAM" || savedMediaTrusted) &&
    (!state.saved?.mediaId || savedMediaTrusted);
  const eligibilityCurrent = state.saved !== null && entry?.draft.id === state.saved.id &&
    entry.draft.updatedAt === state.saved.updatedAt && entry.draft.mediaId === state.saved.mediaId &&
    entry.draft.caption === state.saved.caption && entry.draft.status === state.saved.status;
  const captionErrors = state.error?.fieldErrors?.caption ?? [];
  const mediaErrors = state.error?.fieldErrors?.mediaId ?? [];

  async function mutate(operation: Mutation) {
    // One synchronous gate covers every mutation, including clicks before React
    // paints disabled controls. Receipts also carry a monotonically increasing ID.
    if (inFlight.current || busy || locked) return;
    if (operation === "create" && (state.saved || !capabilities.create)) return;
    if (operation !== "create" && !state.saved) return;
    if (operation === "update" && (!editable || !dirty)) return;
    if ((operation === "ready" || operation === "revert") && (!capabilities.ready || dirty)) return;
    if (operation === "ready" && (ready || !canReady)) return;
    if (operation === "revert" && !ready) return;
    if (operation === "delete" && (!capabilities.delete || !window.confirm(`Delete this ${label} draft? This card's unsaved edits will also be discarded.`))) return;

    inFlight.current = true;
    const request = ++sequence.current;
    dispatch({ type: "begin", operation, request });
    const form = new FormData();
    try {
      let result: SocialDraftActionResult<SerializedSocialDraft | null>;
      let message: string;
      if (operation === "create") {
        form.set("platform", platform);
        const created = await props.createAction(form);
        result = created.success ? { success: true, data: created.data.draft } : created;
        message = created.success && !created.data.created ? "Existing draft loaded." : "Draft created.";
      } else if (state.saved && state.editingUpdatedAt) {
        form.set("draftId", state.saved.id);
        if (operation === "delete") {
          result = await props.deleteAction(form);
          message = "Draft deleted.";
        } else {
          form.set("updatedAt", state.editingUpdatedAt);
          if (operation === "update") {
            if (state.caption !== state.saved.caption) form.set("caption", state.caption);
            if (state.mediaId !== state.saved.mediaId) form.set("mediaId", state.mediaId ?? "");
            result = await props.updateAction(form);
            message = "Draft saved.";
          } else {
            form.set("targetStatus", operation === "ready" ? "READY" : "DRAFT");
            result = await props.transitionAction(form);
            message = operation === "ready" ? "Marked Ready. This does not publish the draft." : "Reverted to Draft.";
          }
        }
      } else {
        dispatch({ type: "failed", request, error: { code: "NOT_FOUND" } });
        return;
      }
      if (request !== sequence.current) return;
      if (!result.success) {
        dispatch({ type: "failed", request, error: { code: result.code, fieldErrors: result.fieldErrors } });
        return;
      }
      dispatch({ type: "accepted", saved: result.data, request, message });
      startRefresh(() => router.refresh());
    } catch {
      if (request === sequence.current) dispatch({ type: "failed", request, error: { code: "TRANSPORT" } });
    }
  }

  function reloadLatest() {
    if (inFlight.current || busy) return;
    if (!window.confirm(`Reload latest ${label} draft? This card's unsaved edits will be discarded.`)) return;
    inFlight.current = true;
    dispatch({ type: "reload" });
    startRefresh(() => router.refresh());
  }

  return (
    <section aria-labelledby={`${prefix}-heading`} aria-busy={busy} className="min-w-0 space-y-4 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
      <header className="space-y-2">
        <h2 id={`${prefix}-heading`} className="text-xl font-semibold">{label}</h2>
        <p className="text-sm">Editorial status: <Badge variant={ready ? "approved" : "draft"}>{state.saved?.status ?? "No draft"}</Badge></p>
        <p className="text-sm text-neutral-600">Marking Ready does not publish this draft.</p>
      </header>
      <p id={`${prefix}-help`} className="text-sm text-neutral-600">
        {platform === "FACEBOOK" ? "Media optional. Facebook drafts can be saved and marked Ready without an image." : "Image required before marking Ready. Select and save an image; preview images do not count."}
      </p>
      {archived && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm">This Journey is archived. Social drafts are read-only.</p>}
      {!state.saved ? (
        <div className="space-y-3">
          <p>No social draft yet.</p>
          <Button type="button" className={focus} disabled={busy || locked || !capabilities.create} onClick={() => { void mutate("create"); }}>
            {state.pending === "create" ? "Creating…" : `Create ${label} Draft`}
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void mutate("update"); }} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`${prefix}-caption`} className="block text-sm font-medium">{label} caption</label>
            <textarea
              id={`${prefix}-caption`}
              name="caption"
              value={state.caption}
              onChange={(event) => dispatch({ type: "caption", value: event.target.value })}
              readOnly={!editable}
              rows={6}
              maxLength={5000}
              aria-invalid={captionErrors.length > 0}
              aria-describedby={`${prefix}-count ${prefix}-help${captionErrors.length ? ` ${prefix}-caption-errors` : ""}`}
              className={`block w-full min-w-0 rounded-md border border-neutral-300 px-3 py-2 text-sm read-only:bg-neutral-50 ${focus}`}
            />
            <p id={`${prefix}-count`} className="text-xs text-neutral-600">{state.caption.length} / 5000 characters. Empty captions can be saved in Draft.</p>
            {captionErrors.length > 0 && <div id={`${prefix}-caption-errors`} className="text-sm text-red-700">{captionErrors.map((message, i) => <p key={i}>{message}</p>)}</div>}
          </div>
          <fieldset disabled={!editable} aria-describedby={`${prefix}-help`} className="min-w-0 space-y-3 disabled:opacity-70">
            <legend className="mb-2 text-sm font-medium">{label} image</legend>
            <p className="text-sm">
              {state.mediaId ? (localMedia?.fileName ?? (persistedPreview ? "Selected persisted image" : "Selected image is no longer available for this Journey.")) : "No image selected for this draft."}
            </p>
            <MediaPicker media={media} selectedId={state.mediaId} onSelect={(item) => dispatch({ type: "media", value: item?.id ?? null })} typeFilter="IMAGE" />
            <Button type="button" variant="secondary" className={focus} disabled={!editable || state.mediaId === null} onClick={() => dispatch({ type: "media", value: null })}>Clear image</Button>
            {mediaErrors.length > 0 && <div className="text-sm text-red-700">{mediaErrors.map((message, i) => <p key={i}>{message}</p>)}</div>}
          </fieldset>
          {ready && <p className="text-sm font-medium">Revert to Draft before editing the caption or image.</p>}
          {dirty && <p className="text-sm font-medium">Unsaved changes. Save first before marking Ready.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className={focus} disabled={!editable || !dirty}>{state.pending === "update" ? "Saving…" : "Save"}</Button>
            {ready ? (
              <Button type="button" variant="secondary" className={focus} disabled={busy || locked || !capabilities.ready || dirty} onClick={() => { void mutate("revert"); }}>Revert to Draft</Button>
            ) : (
              <Button type="button" variant="secondary" className={focus} disabled={busy || locked || !capabilities.ready || dirty || !canReady} onClick={() => { void mutate("ready"); }}>Mark Ready</Button>
            )}
            {capabilities.delete && <Button type="button" variant="danger" className={focus} disabled={busy || locked} onClick={() => { void mutate("delete"); }}>Delete draft</Button>}
          </div>
        </form>
      )}
      <button type="button" aria-expanded={previewOpen} aria-controls={`${prefix}-preview`} onClick={() => setPreviewOpen(!previewOpen)} className={`text-sm text-blue-700 underline ${focus}`}>
        {previewOpen ? "Hide preview" : "Show preview"}
      </button>
      <figure id={`${prefix}-preview`} hidden={!previewOpen} className="space-y-2">
        {/* URLs come only from the reader's trusted image DTOs and preview. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={preview.altText} className="aspect-video w-full rounded-md border object-cover" />
        <figcaption className="text-sm text-neutral-600">
          {selectionChanged && state.mediaId && preview.source === "SELECTED"
            ? "Selected image — unsaved"
            : preview.source === "SELECTED" ? "Saved selected image"
              : "Preview only — no image selected for this draft."}
          {selectionChanged && state.mediaId === null && <span> Image removal — unsaved.</span>}
          {preview.source !== "SELECTED" && state.mediaId && <span> The selected image is unavailable; this is a fallback.</span>}
        </figcaption>
      </figure>
      <div className="space-y-2 border-t pt-4" aria-labelledby={`${prefix}-eligibility`}>
        <h3 id={`${prefix}-eligibility`} className="font-semibold">Publish eligibility</h3>
        <p className="text-xs text-neutral-600">Eligibility describes saved content, not unsaved edits.</p>
        {eligibilityCurrent && entry ? (
          <>
            <p className="text-sm font-medium">{entry.eligibility.eligible ? "Eligible" : "Not eligible"}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{entry.eligibility.reasons.map((reason) => <li key={reason}>{reasonLabels[reason]}</li>)}</ul>
          </>
        ) : <p className="text-sm">{state.saved ? "Waiting for current saved eligibility. Reload latest if it does not update." : "Create a draft to see its saved eligibility."}</p>}
      </div>
      {state.error && <div role="alert" className="space-y-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
        <p>{errorLabels[state.error.code]}</p>
        {Object.entries(state.error.fieldErrors ?? {}).filter(([field]) => field !== "caption" && field !== "mediaId").map(([field, messages]) => <p key={field}>{messages.join(" ")}</p>)}
        {state.error.code === "UNAUTHORIZED" && <a href="/admin/login" className="underline">Sign in</a>}
      </div>}
      <p role="status" aria-live="polite" className="text-sm text-neutral-700">{busy ? state.pending === "reload" ? "Reloading latest saved version…" : "Operation in progress…" : state.success}</p>
      <Button type="button" variant="ghost" className={focus} disabled={busy} onClick={reloadLatest}>Reload latest</Button>
    </section>
  );
}
