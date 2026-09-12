import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach, mock } from "node:test";
import type { SocialDraftServiceErrorCode } from "../services/social-draft.service";
import type {
  CreateSocialDraftInput,
  UpdateSocialDraftInput,
  TransitionSocialDraftStatusInput,
  DeleteSocialDraftInput,
} from "../lib/validation/social-draft.schema";
import type { SerializedSocialDraft } from "../types/social-draft";

type Draft = Omit<SerializedSocialDraft, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};
type Operation = "create" | "update" | "transition" | "delete";
const journeyId = "journey-1";
const timestamp = "2026-09-03T12:00:00.000Z";
const updatedTimestamp = "2026-09-03T12:00:01.000Z";
const permissions = { create: "social:create", update: "social:update", transition: "social:ready", delete: "social:delete" };
let actor: { id: string; email: string; name: string; role: string } | null;
let authCalls: number;
let authFailure: boolean;
let auditFailure: boolean;
let serviceThrows: boolean;
let createKind: "insert" | "existing" | "race";
let serviceFailure: { success: false; code: SocialDraftServiceErrorCode; error: string } | null;
let serviceCalls: Array<{ operation: Operation; input: unknown; createdById?: string }>;
let auditRows: Array<Record<string, unknown>>;
let revalidated: string[];

function draft(): Draft {
  return {
    id: "draft-1", journeyId, platform: "FACEBOOK", caption: "Stored caption",
    mediaId: null, status: "DRAFT", createdById: "actor-1",
    createdAt: new Date(timestamp), updatedAt: new Date(updatedTimestamp),
  };
}
function record(operation: Operation, input: unknown, createdById?: string) {
  assert.ok(authCalls > 0, "authorization must precede service access");
  serviceCalls.push({ operation, input, ...(createdById && { createdById }) });
  if (serviceThrows) throw { code: "P2002", secret: "database-secret", stack: "private-stack" };
}
type MockModule = (specifier: string, options: { exports: Record<string, unknown> }) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
// Exercise the real requirePermission, permissions map, and best-effort audit helper.
mockModule("../lib/auth", {
  exports: { auth: async () => {
    authCalls++;
    if (authFailure) throw new Error("secret session backend");
    return actor ? { user: actor } : null;
  } },
});
mockModule("next/headers", { exports: { headers: async () => new Headers() } });
const prisma = { auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => {
  auditRows.push(data);
  if (auditFailure) throw new Error("audit database unavailable");
  return data;
} } };
mockModule("../lib/prisma", { exports: { prisma, default: prisma } });
mockModule("next/cache", { exports: { revalidatePath: (value: string) => { revalidated.push(value); } } });
mockModule("../services/social-draft.service", {
  exports: {
    createSocialDraftWithOutcome: async (input: CreateSocialDraftInput, createdById: string) => {
      record("create", input, createdById);
      return serviceFailure ?? {
        success: true,
        data: { draft: { ...draft(), ...input, mediaId: input.mediaId ?? null, createdById }, created: createKind === "insert" },
      };
    },
    updateSocialDraft: async (input: UpdateSocialDraftInput) => {
      record("update", input);
      return serviceFailure ?? { success: true, data: {
        ...draft(),
        ...(input.caption !== undefined && { caption: input.caption }),
        ...(input.mediaId !== undefined && { mediaId: input.mediaId }),
      } };
    },
    transitionSocialDraftStatus: async (input: TransitionSocialDraftStatusInput) => {
      record("transition", input);
      return serviceFailure ?? { success: true, data: { ...draft(), status: input.targetStatus } };
    },
    deleteSocialDraft: async (input: DeleteSocialDraftInput) => {
      record("delete", input);
      return serviceFailure ?? { success: true, data: null };
    },
  },
});
let actions!: typeof import("../actions/social-draft.actions");
before(async () => { actions = await import("../actions/social-draft.actions"); });
beforeEach(() => {
  actor = { id: "actor-1", email: "actor@example.com", name: "Editor", role: "SUPER_ADMIN" };
  authCalls = 0;
  authFailure = false;
  auditFailure = false;
  serviceThrows = false;
  createKind = "insert";
  serviceFailure = null;
  serviceCalls = [];
  auditRows = [];
  revalidated = [];
});
afterEach(() => {
  for (const value of revalidated) assert.equal(value, `/admin/journeys/${journeyId}/social`);
});

function form(operation: Operation): FormData {
  const data = new FormData();
  if (operation === "create") data.set("platform", "FACEBOOK");
  else data.set("draftId", "draft-1");
  if (operation === "update" || operation === "transition") data.set("updatedAt", timestamp);
  if (operation === "update") data.set("caption", "  New\r\ncaption  ");
  if (operation === "transition") data.set("targetStatus", "READY");
  return data;
}
function invoke(operation: Operation, data = form(operation)) {
  const action = {
    create: actions.createSocialDraft,
    update: actions.updateSocialDraft,
    transition: actions.transitionSocialDraftStatus,
    delete: actions.deleteSocialDraft,
  }[operation];
  return action(journeyId, data);
}
const operations: Operation[] = ["create", "update", "transition", "delete"];
for (const operation of operations) {
  test(`anonymous ${operation} stops before validation, service, and audits`, async () => {
    actor = null;
    const result = await invoke(operation, new FormData());
    assert.deepEqual(result, { success: false, code: "UNAUTHORIZED", error: "Unauthorized" });
    assert.equal(authCalls, 1);
    assert.deepEqual(serviceCalls, []);
    assert.deepEqual(auditRows, []);
    assert.deepEqual(revalidated, []);
  });

  test(`denied ${operation} uses the exact permission and produces only the authz-owned denial audit`, async () => {
    assert.ok(actor);
    actor.role = "UNKNOWN";
    const result = await invoke(operation);
    assert.deepEqual(result, { success: false, code: "FORBIDDEN", error: "Forbidden" });
    assert.deepEqual(serviceCalls, []);
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].eventType, "AUTHORIZATION_DENIED");
    assert.deepEqual(auditRows[0].metadata, { permission: permissions[operation] });
    assert.deepEqual(revalidated, []);
  });

  test(`SUPER_ADMIN ${operation} succeeds and revalidates only the concrete Studio once`, async () => {
    const result = await invoke(operation);
    assert.ok(result.success);
    assert.equal(authCalls, 1);
    assert.equal(serviceCalls.length, 1);
    assert.deepEqual(revalidated, [`/admin/journeys/${journeyId}/social`]);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });

  test(`EDITOR ${operation} follows existing permissions`, async () => {
    assert.ok(actor);
    actor.role = "EDITOR";
    const result = await invoke(operation);
    if (operation === "delete") {
      assert.ok(!result.success);
      assert.equal(result.code, "FORBIDDEN");
      assert.equal(serviceCalls.length, 0);
    } else {
      assert.ok(result.success);
      assert.equal(serviceCalls.length, 1);
    }
  });

  test(`${operation} passes the bound Journey scope and rejects submitted scope overrides`, async () => {
    const result = await invoke(operation);
    assert.ok(result.success);
    assert.ok(serviceCalls[0].input && typeof serviceCalls[0].input === "object");
    assert.equal(Reflect.get(serviceCalls[0].input, "journeyId"), journeyId);
    const forged = form(operation);
    forged.set("journeyId", "journey-2");
    const rejected = await invoke(operation, forged);
    assert.ok(!rejected.success);
    assert.equal(rejected.code, "VALIDATION_ERROR");
    assert.equal(serviceCalls.length, 1);
  });

  test(`${operation} rejects duplicate business fields and File values`, async () => {
    const key = operation === "create" ? "platform" : "draftId";
    for (const kind of ["duplicate", "file"]) {
      const malformed = form(operation);
      if (kind === "duplicate") malformed.append(key, "duplicate-value");
      else malformed.set(key, new Blob(["not text input"]), "field.txt");
      const result = await invoke(operation, malformed);
      assert.ok(!result.success);
      assert.equal(result.code, "VALIDATION_ERROR");
    }
    assert.deepEqual(serviceCalls, []);
    assert.deepEqual(auditRows, []);
  });

  test(`${operation} tolerates React transport metadata without passing it to the service`, async () => {
    const data = form(operation);
    data.append("$ACTION_REF_0", "");
    data.append("$ACTION_0:0", "transport");
    const result = await invoke(operation, data);
    assert.ok(result.success);
    assert.equal(JSON.stringify(serviceCalls).includes("$ACTION_"), false);
  });

  test(`${operation} service failures produce no success audit or revalidation`, async () => {
    serviceFailure = { success: false, code: "NOT_FOUND", error: "Social draft not found" };
    assert.deepEqual(await invoke(operation), serviceFailure);
    assert.deepEqual(auditRows, []);
    assert.deepEqual(revalidated, []);
  });

  test(`${operation} contains unexpected service errors`, async () => {
    serviceThrows = true;
    assert.deepEqual(await invoke(operation), {
      success: false, code: "OPERATION_FAILED", error: "Social draft operation failed",
    });
    assert.deepEqual(auditRows, []);
    assert.deepEqual(revalidated, []);
  });

  test(`${operation} still reports success when the real audit helper's database write fails`, async () => {
    auditFailure = true;
    const log = mock.method(console, "error", () => undefined);
    try {
      assert.ok((await invoke(operation)).success);
      assert.equal(auditRows.length, 1);
      assert.equal(log.mock.callCount(), 1);
      assert.equal(revalidated.length, 1);
    } finally { log.mock.restore(); }
  });
}

test("create derives creator only from auth and supports the empty-card request", async () => {
  const result = await actions.createSocialDraft(journeyId, form("create"));
  assert.ok(result.success);
  assert.equal(result.data.draft.createdById, "actor-1");
  assert.equal(serviceCalls[0].createdById, "actor-1");
  assert.deepEqual(serviceCalls[0].input, { journeyId, platform: "FACEBOOK", caption: "", mediaId: undefined });
  assert.equal(result.data.draft.createdAt, timestamp);
  assert.equal(result.data.draft.updatedAt, updatedTimestamp);
});

for (const field of ["createdById", "createdBy", "actorId", "email", "role", "url", "mediaUrl", "status", "accessToken", "publish"]) {
  test(`create and generic update reject unexpected ${field}`, async () => {
    for (const operation of ["create", "update"] as const) {
      const data = form(operation);
      data.set(field, "forged");
      const result = await invoke(operation, data);
      assert.ok(!result.success);
      assert.equal(result.code, "VALIDATION_ERROR");
    }
    assert.deepEqual(serviceCalls, []);
  });
}

for (const kind of ["insert", "existing", "race"] as const) {
  test(`create ${kind} audits only an authoritative insertion`, async () => {
    createKind = kind;
    const result = await actions.createSocialDraft(journeyId, form("create"));
    assert.ok(result.success);
    assert.equal(result.data.created, kind === "insert");
    assert.equal(auditRows.length, kind === "insert" ? 1 : 0);
    if (kind === "insert") {
      assert.equal(auditRows[0].eventType, "SOCIAL_DRAFT_CREATED");
      assert.equal(auditRows[0].targetType, "SOCIAL_DRAFT");
      assert.equal(auditRows[0].targetId, "draft-1");
      assert.deepEqual(auditRows[0].metadata, { journeyId });
    }
    assert.equal(revalidated.length, 1);
  });
}

test("create retries returning existing rows do not duplicate CREATED audit", async () => {
  await invoke("create");
  createKind = "existing";
  await invoke("create");
  await invoke("create");
  assert.equal(auditRows.length, 1);
  assert.equal(revalidated.length, 3);
});

test("update normalizes caption, serializes the new timestamp, and audits field names only", async () => {
  const data = form("update");
  data.set("mediaId", "image-1");
  const result = await actions.updateSocialDraft(journeyId, data);
  assert.ok(result.success);
  assert.equal(result.data.caption, "New\ncaption");
  assert.equal(result.data.updatedAt, updatedTimestamp);
  assert.equal(auditRows[0].eventType, "SOCIAL_DRAFT_UPDATED");
  assert.deepEqual(auditRows[0].metadata, { journeyId, fields: ["caption", "mediaId"] });
  assert.equal(JSON.stringify(auditRows).includes("New"), false);
  assert.equal(JSON.stringify(auditRows).includes("image-1"), false);
});

for (const choice of ["omitted", "empty", "value"] as const) {
  test(`update mediaId ${choice} retains its distinct semantics`, async () => {
    const data = form("update");
    if (choice !== "omitted") data.set("mediaId", choice === "empty" ? "" : "image-1");
    assert.ok((await invoke("update", data)).success);
    const input = serviceCalls[0].input;
    assert.ok(input && typeof input === "object");
    assert.equal(Object.hasOwn(input, "mediaId"), choice !== "omitted");
    assert.equal(Reflect.get(input, "mediaId"), choice === "empty" ? null : choice === "value" ? "image-1" : undefined);
    assert.deepEqual(auditRows[0].metadata, {
      journeyId, fields: choice === "omitted" ? ["caption"] : ["caption", "mediaId"],
    });
  });
}

test("media-only update does not submit caption", async () => {
  const data = form("update");
  data.delete("caption");
  data.set("mediaId", "");
  assert.ok((await invoke("update", data)).success);
  const input = serviceCalls[0].input;
  assert.ok(input && typeof input === "object");
  assert.equal(Object.hasOwn(input, "caption"), false);
  assert.deepEqual(auditRows[0].metadata, { journeyId, fields: ["mediaId"] });
});

for (const code of ["VALIDATION_ERROR", "NOT_FOUND", "ALREADY_ARCHIVED", "INVALID_MEDIA", "INVALID_TRANSITION", "EDITORIAL_INCOMPLETE", "READY_LOCKED", "CONFLICT", "OPERATION_FAILED"] as const) {
  test(`update preserves controlled ${code} without success effects`, async () => {
    serviceFailure = { success: false, code, error: "Controlled service message" };
    assert.deepEqual(await invoke("update"), serviceFailure);
    assert.deepEqual(auditRows, []);
    assert.deepEqual(revalidated, []);
  });
}

for (const targetStatus of ["READY", "DRAFT"] as const) {
  test(`transition to ${targetStatus} derives prior status for the success audit`, async () => {
    const data = form("transition");
    data.set("targetStatus", targetStatus);
    const result = await actions.transitionSocialDraftStatus(journeyId, data);
    assert.ok(result.success);
    assert.equal(result.data.status, targetStatus);
    assert.equal(result.data.updatedAt, updatedTimestamp);
    assert.equal(auditRows[0].eventType, "SOCIAL_DRAFT_STATUS_CHANGED");
    assert.deepEqual(auditRows[0].metadata, {
      journeyId, fromStatus: targetStatus === "READY" ? "DRAFT" : "READY", toStatus: targetStatus,
    });
  });
}

test("transition rejects browser-provided previous status", async () => {
  const data = form("transition");
  data.set("fromStatus", "DRAFT");
  const result = await invoke("transition", data);
  assert.ok(!result.success);
  assert.equal(result.code, "VALIDATION_ERROR");
  assert.deepEqual(serviceCalls, []);
});

test("delete requires no timestamp and audits only the scoped draft identity", async () => {
  assert.deepEqual(await actions.deleteSocialDraft(journeyId, form("delete")), { success: true, data: null });
  assert.deepEqual(serviceCalls[0].input, { journeyId, draftId: "draft-1" });
  assert.equal(auditRows[0].eventType, "SOCIAL_DRAFT_DELETED");
  assert.equal(auditRows[0].targetType, "SOCIAL_DRAFT");
  assert.equal(auditRows[0].targetId, "draft-1");
  assert.deepEqual(auditRows[0].metadata, { journeyId });
});

test("Zod rejects invalid dates, empty updates, forged platforms, and unsupported captions", async () => {
  const invalidDate = form("update");
  invalidDate.set("updatedAt", "not-a-date");
  const emptyUpdate = form("update");
  emptyUpdate.delete("caption");
  const platform = form("create");
  platform.set("platform", "LINKEDIN");
  const caption = form("create");
  caption.set("caption", "unsafe\u0000caption");
  for (const [operation, data] of [["update", invalidDate], ["update", emptyUpdate], ["create", platform], ["create", caption]] as const) {
    const result = await invoke(operation, data);
    assert.ok(!result.success);
    assert.equal(result.code, "VALIDATION_ERROR");
    assert.ok(result.fieldErrors);
  }
  assert.deepEqual(serviceCalls, []);
});

test("unexpected authorization errors return a safe failure", async () => {
  authFailure = true;
  assert.deepEqual(await invoke("create"), {
    success: false, code: "OPERATION_FAILED", error: "Social draft operation failed",
  });
  assert.deepEqual(serviceCalls, []);
});
