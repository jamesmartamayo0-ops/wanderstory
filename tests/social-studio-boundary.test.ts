import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const implementationPaths = [
  "actions/social-draft.actions.ts",
  "services/social-studio.service.ts",
  "types/social-draft.ts",
];
function parse(relative: string) {
  return ts.createSourceFile(relative, readFileSync(join(root, relative), "utf8"), ts.ScriptTarget.Latest, true);
}
function nodes(source: ts.Node): ts.Node[] {
  const result: ts.Node[] = [];
  function visit(node: ts.Node) { result.push(node); ts.forEachChild(node, visit); }
  visit(source);
  return result;
}
function imports(source: ts.SourceFile) {
  return source.statements.filter(ts.isImportDeclaration).map(node => {
    assert.ok(ts.isStringLiteral(node.moduleSpecifier));
    return node.moduleSpecifier.text;
  });
}
function callNames(source: ts.SourceFile) {
  return nodes(source).filter(ts.isCallExpression).map(node => node.expression.getText(source));
}
const reader = parse("services/social-studio.service.ts");
const actions = parse("actions/social-draft.actions.ts");
const sharedTypes = parse("types/social-draft.ts");

test("Pass 1 production imports contain only approved local composition and validation dependencies", () => {
  const allowed = new Set([
    "next/cache", "zod", "@/lib/authz", "@/lib/audit", "@/lib/validation/social-draft.schema",
    "@/services/social-draft.service", "@/types/social-draft", "../lib/prisma",
    "../lib/journey-media-trust", "../lib/social-draft-eligibility", "../lib/site-url",
    "./social-draft.service", "../app/generated/prisma/client", "../types/social-draft",
    "../app/generated/prisma/enums",
  ]);
  for (const relative of implementationPaths) {
    for (const specifier of imports(parse(relative))) assert.ok(allowed.has(specifier), specifier);
  }
});

test("Pass 1 code has no external API, OAuth, upload, scheduler, queue, worker, or AI entry points", () => {
  const forbiddenCalls = /^(fetch|require|setTimeout|setInterval|setImmediate|Worker|WebSocket|XMLHttpRequest)$/;
  const forbiddenSymbols = /^(accessToken|refreshToken|access_token|refresh_token|oauth|OAuth|cron|queue|worker|openai|anthropic|rag|vectorDb|uploadMedia|signMediaUpload|publishSocialDraft|scheduleSocialDraft)$/i;
  for (const relative of implementationPaths) {
    const source = parse(relative);
    for (const node of nodes(source)) {
      if (ts.isIdentifier(node)) assert.equal(forbiddenSymbols.test(node.text), false, node.text);
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        assert.equal(forbiddenCalls.test(node.expression.getText(source)), false, node.getText(source));
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword);
      }
      if (ts.isStringLiteralLike(node)) {
        assert.doesNotMatch(node.text, /graph\.(facebook|instagram)\.com|api\.(openai|anthropic)\.com/i);
      }
    }
  }
});

test("Studio reader performs only narrow Prisma reads and cannot create drafts during loading", () => {
  const calls = callNames(reader);
  const prismaCalls = calls.filter(name => name.startsWith("prisma."));
  assert.ok(prismaCalls.length > 0);
  for (const call of prismaCalls) assert.match(call, /^prisma\.(journey\.findUnique|media\.findMany)$/);
  assert.ok(calls.includes("getSocialDraftsByJourney"));
  assert.equal(calls.some(name => /\.(create|upsert|update|updateMany|delete|deleteMany|executeRaw)\b/.test(name)), false);
  const draftImport = reader.statements.filter(ts.isImportDeclaration).find(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./social-draft.service",
  );
  const bindings = draftImport?.importClause?.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  assert.deepEqual(bindings.elements.map(e => e.name.text).sort(), [
    "getSocialDraftsByJourney", "isSocialMediaAssociatedWithJourney",
  ]);
  for (const node of nodes(reader)) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      assert.doesNotMatch(node.left.getText(reader), /^draft\./);
    }
  }
});

test("existing ownership, Media trust, eligibility, and site URL helpers are reused", () => {
  const calls = callNames(reader);
  for (const helper of ["isSocialMediaAssociatedWithJourney", "isTrustedJourneyImageMedia", "getSocialDraftPublishEligibility", "resolveSiteOrigin", "buildPublicJourneyUrl"]) {
    assert.ok(calls.includes(helper), helper);
  }
  const ownershipSource = parse("services/social-draft.service.ts");
  assert.ok(ownershipSource.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === "isSocialMediaAssociatedWithJourney"));
  assert.equal(parse("lib/journey-media-trust.ts").statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === "isSocialMediaAssociatedWithJourney"), false);
});

test("actions export exactly four async mutations and no reader or upload entry point", () => {
  assert.equal(actions.statements[0].getText(actions), '"use server";');
  const exported = actions.statements.filter(ts.isFunctionDeclaration).filter(node =>
    node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword),
  );
  assert.deepEqual(exported.map(node => node.name?.text).sort(), [
    "createSocialDraft", "deleteSocialDraft", "transitionSocialDraftStatus", "updateSocialDraft",
  ]);
  for (const node of exported) {
    assert.ok(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
    const permissionCalls = nodes(node).filter(ts.isCallExpression).filter(call => call.expression.getText(actions) === "requirePermission");
    assert.equal(permissionCalls.length, 1);
  }
});

test("action request reads have an exact field allowlist with no raw FormData spread", () => {
  const allowed = new Set(["platform", "caption", "mediaId", "draftId", "updatedAt", "targetStatus"]);
  for (const node of nodes(actions).filter(ts.isCallExpression)) {
    const call = node.expression.getText(actions);
    assert.notEqual(call, "Object.fromEntries");
    if (call === "formData.get") {
      const field = node.arguments[0];
      assert.ok(field && ts.isStringLiteral(field));
      assert.ok(allowed.has(field.text), field.text);
    }
  }
  assert.equal(callNames(actions).some(name => name.startsWith("prisma.")), false);
});

test("shared DTO module contains types only and no runtime imports", () => {
  for (const statement of sharedTypes.statements) {
    if (ts.isImportDeclaration(statement)) assert.equal(statement.importClause?.isTypeOnly, true);
    else assert.ok(ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement));
  }
  const emitted = ts.transpileModule(sharedTypes.text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 },
  }).outputText.trim();
  assert.equal(emitted, "export {};");
});

test("new DTOs and reader have no private fields or header-derived share targets", () => {
  const forbidden = new Set(["privateToken", "canonicalUrl", "notes", "client", "actorEmail", "DATABASE_URL", "VERCEL_URL", "headers"]);
  for (const source of [reader, sharedTypes]) {
    for (const node of nodes(source)) {
      if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
        assert.equal(forbidden.has(node.text), false, node.text);
      }
    }
  }
});

test("Prisma schema and migrations remain identical to the approved MF.4A baseline", () => {
  const baseline = "78ff90169bac533c9fe5d923a8a39388c435e21d";
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", baseline, "prisma/schema.prisma", "prisma/migrations"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/);
  for (const relative of paths) {
    const approved = execFileSync("git", ["show", `${baseline}:${relative}`], { cwd: root, encoding: "utf8" });
    assert.equal(readFileSync(join(root, relative), "utf8").replace(/\r\n/g, "\n"), approved.replace(/\r\n/g, "\n"), relative);
  }
  const added = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "prisma"], { cwd: root, encoding: "utf8" });
  assert.equal(added.trim(), "");
});

test("Pass 1 server composition and DTOs do not depend on Pass 2 UI", () => {
  // Pass 2 is now authorized; the enduring boundary is dependency direction.
  for (const relative of implementationPaths) {
    for (const specifier of imports(parse(relative))) {
      assert.doesNotMatch(specifier, /components\/|social\/page|social-studio-ui\.test/);
    }
  }
});
