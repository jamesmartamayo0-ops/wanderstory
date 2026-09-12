import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test, { before, beforeEach, mock } from "node:test";
import { createElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { SocialDraftCardProps, SocialDraftCardState } from "../components/admin/SocialDraftCard";
import type { SerializedSocialDraft, SocialStudioData, SocialStudioResult } from "../types/social-draft";

// SSR, reducer, and source-boundary tests only. These do not claim to prove
// browser remount behavior, native confirmation, or Next's refresh scheduling.
const t1 = "2026-09-10T00:00:00.000Z";
const t2 = "2026-09-10T00:00:01.000Z";
function draft(overrides: Partial<SerializedSocialDraft> = {}): SerializedSocialDraft {
  return { id: "draft-facebook", journeyId: "journey-test", platform: "FACEBOOK", caption: "Saved caption", mediaId: null, status: "DRAFT", createdById: "admin-test", createdAt: t1, updatedAt: t1, ...overrides };
}
const image = { id: "image-test", fileName: "Journey beach.jpg", type: "IMAGE" as const, mimeType: "image/jpeg", url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", thumbnailUrl: null, altText: "Journey beach", order: 0 };
const fallback = { mediaId: null, url: "/hero/placeholder-hero.jpg", altText: "WanderStory", source: "PLACEHOLDER" as const };
function entry(value = draft()): SocialStudioData["drafts"][number] {
  return { draft: value, eligibility: { eligible: false, reasons: ["EDITORIAL_NOT_READY"] }, preview: fallback };
}
function studio(): SocialStudioData {
  return { journey: { id: "journey-test", title: "Isolated Journey", slug: "isolated-journey", status: "PUBLISHED", visibility: "PUBLIC", publicationConsentGiven: true }, drafts: [], media: [image], defaultPreview: fallback, siteOriginResolved: true, publicJourneyUrl: "http://localhost:3000/journeys/isolated-journey" };
}
let actor: { role: string } | null;
let readerResult: SocialStudioResult;
let reads: string[];
let calls: Array<{ operation: string; journeyId: string; form: FormData }>;
type MockModule = (specifier: string, options: { exports: Record<string, unknown> }) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
mockModule("next/navigation", { exports: {
  useRouter: () => ({ refresh: () => {} }),
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
} });
mockModule("../lib/auth", { exports: { auth: async () => actor ? { user: actor } : null } });
mockModule("../services/social-studio.service", { exports: { getSocialStudioData: async (id: string) => { reads.push(id); return readerResult; } } });
mockModule("../actions/social-draft.actions", { exports: Object.fromEntries([
  "createSocialDraft", "updateSocialDraft", "transitionSocialDraftStatus", "deleteSocialDraft",
].map(operation => [operation, async (journeyId: string, form: FormData) => {
  calls.push({ operation, journeyId, form });
  return { success: false, code: "OPERATION_FAILED", error: "Fixture only" };
}])) });

let ui!: typeof import("../components/admin/SocialDraftCard");
let page!: typeof import("../app/admin/journeys/[id]/social/page");
let picker!: typeof import("../components/admin/MediaPicker");
let mediaSelect!: typeof import("../components/admin/MediaSelectField");
before(async () => {
  ui = await import("../components/admin/SocialDraftCard");
  page = await import("../app/admin/journeys/[id]/social/page");
  picker = await import("../components/admin/MediaPicker");
  mediaSelect = await import("../components/admin/MediaSelectField");
});
beforeEach(() => { actor = { role: "SUPER_ADMIN" }; readerResult = { success: true, data: studio() }; reads = []; calls = []; });
function props(overrides: Partial<SocialDraftCardProps> = {}): SocialDraftCardProps {
  const failure = async () => ({ success: false as const, code: "OPERATION_FAILED" as const, error: "Fixture only" });
  return { platform: "FACEBOOK", entry: entry(), renderId: "render-1", journeyStatus: "PUBLISHED", media: [image], defaultPreview: fallback, capabilities: { create: true, update: true, ready: true, delete: true }, createAction: failure, updateAction: failure, transitionAction: failure, deleteAction: failure, ...overrides };
}
function html(overrides: Partial<SocialDraftCardProps> = {}) { return renderToStaticMarkup(createElement(ui.default, props(overrides))); }
function textarea(markup: string) { const result = markup.match(/<textarea\b[^>]*>/); assert.ok(result); return result[0]; }
function button(markup: string, label: string) {
  const result = [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => match[2] === label);
  assert.ok(result, `Button ${label} exists`); return result[1];
}
function cards(node: ReactNode): Array<ReactElement<SocialDraftCardProps>> {
  if (Array.isArray(node)) return node.flatMap(cards);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (node.type === ui.default && isValidElement<SocialDraftCardProps>(node)) return [node];
  return cards(node.props.children);
}
async function route() { return page.default({ params: Promise.resolve({ id: "journey-test" }) }); }

for (const platform of ["FACEBOOK", "INSTAGRAM"] as const) {
  test(`${platform} no-draft SSR presents explicit creation without calling an action`, () => {
    const output = html({ platform, entry: null });
    assert.match(output, /No social draft yet\./);
    assert.doesNotMatch(button(output, `Create ${platform === "FACEBOOK" ? "Facebook" : "Instagram"} Draft`), /\sdisabled=""/);
    assert.equal(calls.length, 0);
  });
}
test("DRAFT caption is controlled, editable, labelled, counted, and not HTML-required", () => {
  const output = html();
  assert.doesNotMatch(textarea(output), /readonly|required/i);
  assert.match(output, /for="social-facebook-caption"/);
  assert.match(textarea(output), /aria-describedby="social-facebook-count social-facebook-help"/);
  assert.match(output, /Saved caption<\/textarea>/);
  assert.match(button(output, "Save"), /\sdisabled=""/);
  assert.doesNotMatch(button(output, "Mark Ready"), /\sdisabled=""/);
});
test("READY locks caption, image fieldset, Save, and offers Revert with separate editorial text", () => {
  const output = html({ entry: entry(draft({ status: "READY" })) });
  assert.match(textarea(output), /readonly/i);
  assert.match(output, /<fieldset[^>]*disabled/);
  assert.match(button(output, "Save"), /\sdisabled=""/);
  assert.match(button(output, "Clear image"), /\sdisabled=""/);
  assert.doesNotMatch(button(output, "Revert to Draft"), /\sdisabled=""/);
  assert.match(output, /Editorial status:/);
  assert.match(output, /Publish eligibility/);
  assert.match(output, /Marking Ready does not publish this draft\./);
});
test("Facebook Media is explicitly optional, including Ready", () => {
  assert.match(html(), /Media optional\. Facebook drafts can be saved and marked Ready without an image\./);
});
test("Instagram cannot mark Ready with only a fallback preview and no saved image", () => {
  const output = html({ platform: "INSTAGRAM", entry: entry(draft({ platform: "INSTAGRAM" })) });
  assert.match(button(output, "Mark Ready"), /\sdisabled=""/);
  assert.match(output, /Image required before marking Ready/);
  assert.match(output, /Preview only — no image selected for this draft\./);
});
test("Instagram with a saved trusted image and caption can request Ready", () => {
  assert.doesNotMatch(button(html({ platform: "INSTAGRAM", entry: entry(draft({ platform: "INSTAGRAM", mediaId: image.id })) }), "Mark Ready"), /\sdisabled=""/);
});
test("caption IDs are unique per platform", () => {
  assert.match(textarea(html()), /id="social-facebook-caption"/);
  assert.match(textarea(html({ platform: "INSTAGRAM" })), /id="social-instagram-caption"/);
});
const reasons = [
  ["EDITORIAL_NOT_READY", "Mark this draft Ready after completing it."],
  ["JOURNEY_NOT_PUBLISHED", "Publish the Journey before sharing this draft publicly."],
  ["JOURNEY_NOT_PUBLIC", "The Journey must have Public visibility."],
  ["PUBLICATION_CONSENT_MISSING", "Publication consent has not been given."],
  ["CAPTION_REQUIRED", "Add and save a caption."],
  ["INSTAGRAM_MEDIA_REQUIRED", "Select and save an image for Instagram. Preview images do not count."],
  ["MEDIA_UNTRUSTED", "The selected image is no longer an allowed image for this Journey. Replace or remove it after reverting to Draft if necessary."],
  ["SITE_ORIGIN_UNAVAILABLE", "The public site address is unavailable. Ask a site administrator to check its configuration."],
] as const;
for (const [reason, message] of reasons) {
  test(`friendly saved eligibility reason ${reason}`, () => {
    const value = entry(); value.eligibility.reasons = [reason];
    const output = html({ entry: value });
    assert.ok(output.includes(message)); assert.ok(!output.includes(reason));
  });
}
test("all eligibility reasons retain the helper-provided order", () => {
  const value = entry(); value.eligibility.reasons = reasons.map(([reason]) => reason);
  const output = html({ entry: value });
  const positions = reasons.map(([, message]) => output.indexOf(`<li>${message}</li>`));
  assert.ok(positions.every((position, i) => position >= 0 && (i === 0 || position > positions[i - 1])));
});
for (const saved of [null, draft(), draft({ status: "READY" })]) {
  test(`archived SSR is inspectable and every mutation is disabled (${saved?.status ?? "absent"})`, () => {
    const output = html({ journeyStatus: "ARCHIVED", entry: saved ? entry(saved) : null });
    assert.match(output, /This Journey is archived\. Social drafts are read-only\./);
    for (const match of output.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      if (["Hide preview", "Reload latest"].includes(match[2])) continue;
      // MediaPicker's buttons are disabled through their fieldset, not a new API.
      if (/aria-pressed/.test(match[1])) { assert.match(output, /<fieldset[^>]*disabled/); continue; }
      assert.match(match[1], /\sdisabled=""/, match[2]);
    }
    if (saved) assert.match(textarea(output), /readonly/i);
  });
}
test("SUPER_ADMIN delete control exists; EDITOR delete control is absent", () => {
  assert.doesNotMatch(button(html(), "Delete draft"), /\sdisabled=""/);
  assert.doesNotMatch(html({ capabilities: { create: true, update: true, ready: true, delete: false } }), /Delete draft/);
});
test("trusted selected preview uses the primary URL and meaningful alt", () => {
  const output = html({ entry: entry(draft({ mediaId: image.id })) });
  assert.ok(output.includes(`src="${image.url}"`)); assert.match(output, /alt="Journey beach"/);
  assert.match(output, /Saved selected image/);
});
for (const source of ["OG_IMAGE", "COVER", "JOURNEY_MEDIA", "PLACEHOLDER"] as const) {
  test(`reader ${source} fallback stays preview-only`, () => {
    const output = html({ defaultPreview: { ...fallback, source } });
    assert.match(output, /Preview only — no image selected for this draft\./);
  });
}
test("READY Instagram Media loss remains READY, read-only, and shows the saved requirement", () => {
  const value = entry(draft({ platform: "INSTAGRAM", status: "READY" }));
  value.eligibility.reasons = ["INSTAGRAM_MEDIA_REQUIRED"];
  const output = html({ platform: "INSTAGRAM", entry: value });
  assert.match(output, />READY<\/span>/); assert.match(textarea(output), /readonly/i);
  assert.match(output, /Select and save an image for Instagram\. Preview images do not count\./);
  assert.match(output, /No image selected for this draft\./);
});
test("untrusted saved ID is retained but not rendered as a URL; Revert is available", () => {
  const value = entry(draft({ platform: "INSTAGRAM", status: "READY", mediaId: "untrusted-id" }));
  value.eligibility.reasons = ["MEDIA_UNTRUSTED"];
  const output = html({ platform: "INSTAGRAM", entry: value });
  assert.match(output, /The selected image is no longer an allowed image/);
  assert.doesNotMatch(output, /src="untrusted-id"/);
  assert.doesNotMatch(button(output, "Revert to Draft"), /\sdisabled=""/);
});
test("MediaPicker search label, selected state, accessible toggle name, focus, and null-thumbnail URL", () => {
  const output = renderToStaticMarkup(createElement(picker.default, { media: [image], selectedId: image.id, onSelect: () => {} }));
  assert.match(output, /<label[^>]*for="[^"]+"[^>]*>Search media<\/label>/);
  assert.match(output, /aria-pressed="true"/); assert.match(output, /aria-label="Deselect Journey beach.jpg"/);
  assert.match(output, /focus-visible:outline/); assert.ok(output.includes(`src="${image.url}"`));
});
test("existing MediaSelectField consumer still renders its selected ID and primary image", () => {
  const output = renderToStaticMarkup(createElement(mediaSelect.default, { media: [image], selectedId: image.id, inputName: "coverMediaId", label: "Cover Image" }));
  assert.match(output, /name="coverMediaId" value="image-test"/); assert.ok(output.includes(`src="${image.url}"`));
});

test("unauthenticated route redirects before reading data", async () => {
  actor = null; await assert.rejects(route, /REDIRECT:\/admin\/login/); assert.deepEqual(reads, []);
});
test("unrecognized role cannot read the Studio", async () => {
  actor = { role: "OTHER" }; assert.match(renderToStaticMarkup(await route()), /do not have access/); assert.deepEqual(reads, []);
});
test("missing Journey invokes notFound", async () => {
  readerResult = { success: false, code: "NOT_FOUND", error: "Journey not found" };
  await assert.rejects(route, /NOT_FOUND/);
});
test("reader failure is an explicit page error, never a no-draft state", async () => {
  readerResult = { success: false, code: "MEDIA_LOAD_FAILED", error: "Failed to load Journey media" };
  const output = renderToStaticMarkup(await route()); assert.match(output, /role="alert"/); assert.doesNotMatch(output, /Create Facebook Draft/);
});
test("route shows narrow summary, safe supplied public URL, and never creates during render", async () => {
  const output = renderToStaticMarkup(await route());
  for (const text of ["Isolated Journey", "PUBLISHED", "PUBLIC", "Given", "Back to Journey", "View public Journey"]) assert.ok(output.includes(text));
  assert.deepEqual(reads, ["journey-test"]); assert.deepEqual(calls, []);
});
test("origin unavailable keeps the editor available and omits public link", async () => {
  const data = studio(); data.siteOriginResolved = false; data.publicJourneyUrl = null;
  const value = entry(); value.eligibility.reasons = ["SITE_ORIGIN_UNAVAILABLE"]; data.drafts = [value]; readerResult = { success: true, data };
  const output = renderToStaticMarkup(await route()); assert.doesNotMatch(output, /View public Journey/); assert.doesNotMatch(textarea(output), /readonly/i);
  assert.match(output, /The public site address is unavailable/);
});
test("all four actions are Journey-bound on the server and capabilities follow the role", async () => {
  actor = { role: "EDITOR" };
  const [card] = cards(await route()); assert.ok(card);
  assert.deepEqual(card.props.capabilities, { create: true, update: true, ready: true, delete: false });
  const form = new FormData();
  await card.props.createAction(form); await card.props.updateAction(form); await card.props.transitionAction(form); await card.props.deleteAction(form);
  assert.equal(calls.length, 4); assert.ok(calls.every(call => call.journeyId === "journey-test" && call.form === form));
});
test("pre-creation platform-keyed card → created draft retains identical React key/type (structural identity acceptance)", async () => {
  const beforeCards = cards(await route());
  const data = studio(); data.drafts = [entry()]; readerResult = { success: true, data };
  const afterCards = cards(await route());
  assert.deepEqual(beforeCards.map(card => card.key), ["FACEBOOK", "INSTAGRAM"]);
  assert.deepEqual(afterCards.map(card => card.key), ["FACEBOOK", "INSTAGRAM"]);
  assert.equal(beforeCards[0].type, afterCards[0].type);
  assert.equal(beforeCards[0].props.entry, null); assert.equal(afterCards[0].props.entry?.draft.id, "draft-facebook");
  assert.notEqual(beforeCards[0].props.renderId, afterCards[0].props.renderId);
});

function state(value: SerializedSocialDraft | null = draft()) { return ui.initialSocialDraftCardState(value, "render-1"); }
function dirty(value = state()): SocialDraftCardState { return ui.socialDraftCardReducer(ui.socialDraftCardReducer(value, { type: "caption", value: "Unsaved caption" }), { type: "media", value: image.id }); }
test("accepted Save receipt adopts normalization and timestamp together, clearing dirty state", () => {
  const pending = ui.socialDraftCardReducer(dirty(), { type: "begin", operation: "update", request: 1 });
  const saved = draft({ caption: "Normalized\ncaption", mediaId: image.id, updatedAt: t2 });
  const accepted = ui.socialDraftCardReducer(pending, { type: "accepted", saved, request: 1, message: "Saved" });
  assert.deepEqual(accepted.saved, saved); assert.equal(accepted.caption, saved.caption); assert.equal(accepted.mediaId, saved.mediaId); assert.equal(accepted.editingUpdatedAt, t2); assert.equal(ui.isSocialDraftCardDirty(accepted), false);
});
test("dirty prop refresh preserves local caption, Media, and the original timestamp as one editing snapshot", () => {
  const local = dirty(); const refreshed = ui.socialDraftCardReducer(local, { type: "server", saved: draft({ caption: "Other editor", updatedAt: t2 }), renderId: "render-2", refreshing: false });
  assert.equal(refreshed.caption, local.caption); assert.equal(refreshed.mediaId, local.mediaId); assert.equal(refreshed.editingUpdatedAt, t1); assert.deepEqual(refreshed.saved, local.saved);
});
test("clean props replace saved values and timestamp together", () => {
  const saved = draft({ caption: "New saved", updatedAt: t2 });
  const refreshed = ui.socialDraftCardReducer(state(), { type: "server", saved, renderId: "render-2", refreshing: false });
  assert.equal(refreshed.caption, saved.caption); assert.equal(refreshed.editingUpdatedAt, t2);
});
test("prop refresh during a pending mutation cannot overwrite the local request snapshot", () => {
  const pending = ui.socialDraftCardReducer(dirty(), { type: "begin", operation: "update", request: 1 });
  const refreshed = ui.socialDraftCardReducer(pending, { type: "server", saved: draft({ updatedAt: t2 }), renderId: "render-2", refreshing: false });
  assert.equal(refreshed.caption, pending.caption); assert.equal(refreshed.editingUpdatedAt, t1); assert.equal(refreshed.pending, "update");
});
for (const code of ["CONFLICT", "ALREADY_ARCHIVED", "READY_LOCKED", "INVALID_MEDIA", "EDITORIAL_INCOMPLETE", "TRANSPORT"] as const) {
  test(`${code} response preserves unsaved values and original token`, () => {
    const local = dirty(); const pending = ui.socialDraftCardReducer(local, { type: "begin", operation: "update", request: 1 });
    const failed = ui.socialDraftCardReducer(pending, { type: "failed", request: 1, error: { code } });
    assert.equal(failed.caption, local.caption); assert.equal(failed.mediaId, local.mediaId); assert.equal(failed.editingUpdatedAt, t1); assert.equal(failed.error?.code, code); assert.equal(failed.pending, null);
  });
}
test("conflict ignores automatic refresh; confirmed reload waits for a new completed read receipt", () => {
  let local = ui.socialDraftCardReducer(dirty(), { type: "begin", operation: "update", request: 1 });
  local = ui.socialDraftCardReducer(local, { type: "failed", request: 1, error: { code: "CONFLICT" } });
  local = ui.socialDraftCardReducer(local, { type: "server", saved: draft({ caption: "Accepted A", updatedAt: t2 }), renderId: "render-2", refreshing: false });
  assert.equal(local.caption, "Unsaved caption"); assert.equal(local.editingUpdatedAt, t1);
  const confirmed = ui.socialDraftCardReducer(local, { type: "reload" });
  assert.equal(ui.socialDraftCardReducer(confirmed, { type: "server", saved: draft(), renderId: "render-2", refreshing: false }), confirmed);
  assert.equal(ui.socialDraftCardReducer(confirmed, { type: "server", saved: draft(), renderId: "render-3", refreshing: true }), confirmed);
  const reloaded = ui.socialDraftCardReducer(confirmed, { type: "server", saved: draft({ caption: "Accepted A", updatedAt: t2 }), renderId: "render-3", refreshing: false });
  assert.equal(reloaded.caption, "Accepted A"); assert.equal(reloaded.editingUpdatedAt, t2); assert.equal(reloaded.error, null); assert.equal(reloaded.pending, null);
});
test("dirty Instagram sibling survives Facebook save and parent revalidation (reducer acceptance)", () => {
  const instagram = dirty(state(draft({ id: "instagram", platform: "INSTAGRAM" })));
  const facebookPending = ui.socialDraftCardReducer(dirty(), { type: "begin", operation: "update", request: 1 });
  const facebook = ui.socialDraftCardReducer(facebookPending, { type: "accepted", saved: draft({ updatedAt: t2 }), request: 1, message: "Saved" });
  const refreshedInstagram = ui.socialDraftCardReducer(instagram, { type: "server", saved: draft({ id: "instagram", platform: "INSTAGRAM" }), renderId: "render-2", refreshing: false });
  assert.equal(facebook.editingUpdatedAt, t2); assert.equal(refreshedInstagram.caption, instagram.caption); assert.equal(refreshedInstagram.mediaId, instagram.mediaId); assert.equal(refreshedInstagram.editingUpdatedAt, t1);
});
test("create receipt adopts an existing/new draft and retains success feedback through props", () => {
  const pending = ui.socialDraftCardReducer(state(null), { type: "begin", operation: "create", request: 1 });
  const accepted = ui.socialDraftCardReducer(pending, { type: "accepted", saved: draft(), request: 1, message: "Existing draft loaded." });
  const refreshed = ui.socialDraftCardReducer(accepted, { type: "server", saved: draft(), renderId: "render-2", refreshing: false });
  assert.equal(refreshed.saved?.id, "draft-facebook"); assert.equal(refreshed.editingUpdatedAt, t1); assert.equal(refreshed.success, "Existing draft loaded.");
});
test("late response cannot replace a newer accepted request", () => {
  const pending = ui.socialDraftCardReducer(state(), { type: "begin", operation: "update", request: 2 });
  const accepted = ui.socialDraftCardReducer(pending, { type: "accepted", saved: draft({ updatedAt: t2 }), request: 2, message: "Saved" });
  assert.equal(ui.socialDraftCardReducer(accepted, { type: "accepted", saved: draft(), request: 1, message: "Old" }), accepted);
  assert.equal(ui.socialDraftCardReducer(accepted, { type: "failed", request: 1, error: { code: "CONFLICT" } }), accepted);
  const reloading = ui.socialDraftCardReducer(accepted, { type: "reload" });
  assert.equal(ui.socialDraftCardReducer(reloading, { type: "failed", request: 2, error: { code: "TRANSPORT" } }), reloading);
});
test("old server timestamp cannot roll back an accepted action receipt", () => {
  const pending = ui.socialDraftCardReducer(state(), { type: "begin", operation: "update", request: 1 });
  const accepted = ui.socialDraftCardReducer(pending, { type: "accepted", saved: draft({ updatedAt: t2 }), request: 1, message: "Saved" });
  const refreshed = ui.socialDraftCardReducer(accepted, { type: "server", saved: draft(), renderId: "old-render", refreshing: false });
  assert.equal(refreshed.editingUpdatedAt, t2);
});
test("delete clears the baseline and local fields; stale props cannot resurrect the deleted row", () => {
  const pending = ui.socialDraftCardReducer(dirty(), { type: "begin", operation: "delete", request: 1 });
  const deleted = ui.socialDraftCardReducer(pending, { type: "accepted", saved: null, request: 1, message: "Deleted" });
  const refreshed = ui.socialDraftCardReducer(deleted, { type: "server", saved: draft(), renderId: "stale-render", refreshing: false });
  assert.equal(refreshed.saved, null); assert.equal(refreshed.caption, ""); assert.equal(refreshed.mediaId, null); assert.equal(refreshed.editingUpdatedAt, null);
});

const cardSource = readFileSync("components/admin/SocialDraftCard.tsx", "utf8");
const routeSource = readFileSync("app/admin/journeys/[id]/social/page.tsx", "utf8");
test("rapid submissions have a synchronous per-card gate before the first await and a receipt generation guard", () => {
  const start = cardSource.indexOf("async function mutate(");
  const mutation = cardSource.slice(start, cardSource.indexOf("function reloadLatest", start));
  assert.ok(mutation.indexOf("if (inFlight.current || busy || locked) return") < mutation.indexOf("await props."));
  assert.ok(mutation.indexOf("inFlight.current = true") < mutation.indexOf("await props."));
  assert.match(mutation, /request !== sequence\.current/);
  assert.doesNotMatch(mutation, /inFlight\.current = false/);
  assert.match(cardSource, /\[state\.pending, state\.request\]/);
});
test("recreation retains the prior deletion barrier against a late old-row refresh", () => {
  const pendingDelete = ui.socialDraftCardReducer(state(), { type: "begin", operation: "delete", request: 1 });
  const deleted = ui.socialDraftCardReducer(pendingDelete, { type: "accepted", saved: null, request: 1, message: "Deleted" });
  const pendingCreate = ui.socialDraftCardReducer(deleted, { type: "begin", operation: "create", request: 2 });
  const created = ui.socialDraftCardReducer(pendingCreate, { type: "accepted", saved: draft({ id: "replacement", createdAt: t2, updatedAt: t2 }), request: 2, message: "Created" });
  const refreshed = ui.socialDraftCardReducer(created, { type: "server", saved: draft(), renderId: "late-deleted-row", refreshing: false });
  assert.equal(refreshed.saved?.id, "replacement"); assert.equal(refreshed.editingUpdatedAt, t2);
});
test("confirmation precedes reload dispatch; no automatic transport replay or conflict relabel", () => {
  const reload = cardSource.slice(cardSource.indexOf("function reloadLatest"), cardSource.indexOf("\n  return (", cardSource.indexOf("function reloadLatest")));
  assert.ok(reload.indexOf("window.confirm") < reload.indexOf('dispatch({ type: "reload"'));
  assert.match(cardSource, /error: \{ code: "TRANSPORT" \}/);
  assert.doesNotMatch(cardSource, /setTimeout|setInterval/);
});
test("all controlled action error codes have presentation mappings", () => {
  for (const code of ["VALIDATION_ERROR", "NOT_FOUND", "ALREADY_ARCHIVED", "INVALID_MEDIA", "INVALID_TRANSITION", "EDITORIAL_INCOMPLETE", "READY_LOCKED", "CONFLICT", "OPERATION_FAILED", "UNAUTHORIZED", "FORBIDDEN", "TRANSPORT"]) assert.ok(cardSource.includes(`  ${code}: "`), code);
});
test("UI has no arbitrary Media URL field, server imports in the card, or out-of-scope integrations", () => {
  for (const [path, text] of [["card.tsx", cardSource], ["page.tsx", routeSource]]) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isStringLiteralLike(node)) assert.doesNotMatch(node.text, /graph\.(facebook|instagram)\.com|api\.(openai|anthropic)\.com|\/admin\/social/);
      if (ts.isIdentifier(node)) assert.doesNotMatch(node.text, /^(privateToken|canonicalUrl|accessToken|refreshToken|oauth|OAuth|cron|queue|uploadMedia|publishSocialDraft|scheduleSocialDraft)$/);
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "name" && node.initializer && ts.isStringLiteral(node.initializer)) assert.doesNotMatch(node.initializer.text, /url|token|creator|actor|journeyId/i);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.doesNotMatch(cardSource, /from ["'][^"']*(?:services\/|lib\/prisma|actions\/)/);
  assert.equal(existsSync("app/admin/social/page.tsx"), false);
});
test("platform identity is not keyed by draft IDs or timestamps and preview preference is independent of the reducer", () => {
  assert.match(routeSource, /key=\{platform\}/); assert.doesNotMatch(routeSource, /key=\{[^}]*?(draft|updatedAt|renderId)/);
  assert.match(cardSource, /\[previewOpen, setPreviewOpen\] = useState\(true\)/);
});
test("layout changes are responsive classes and navigation stays outside Journey forms", () => {
  const layout = readFileSync("app/admin/layout.tsx", "utf8");
  assert.match(layout, /flex-col/); assert.match(layout, /md:flex-row/); assert.match(layout, /md:w-64/); assert.match(layout, /min-w-0/);
  const journey = readFileSync("app/admin/journeys/[id]/page.tsx", "utf8");
  assert.ok(journey.indexOf("Social Content") < journey.indexOf("<form"));
});
