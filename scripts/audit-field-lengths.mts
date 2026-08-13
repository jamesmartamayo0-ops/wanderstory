// USAGE: Phase 4.3 R7 — read-only database field-length audit.
// Measures observed min/avg/max character lengths of long-form columns to
// derive Zod validation caps. Development-local only — read-only guarded.
// Output: scripts/field-lengths.json
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertReadOnlyScriptSafe } from "./b2-guard.mts";

assertReadOnlyScriptSafe("audit-field-lengths.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type FieldAudit = {
  table: string;
  column: string;
  rows: number;
  nonNull: number;
  min: number | null;
  max: number | null;
  avg: number | null;
};

const FIELDS = [
  { table: "Chapter", column: "content", label: "chapter.content" },
  { table: "Journey", column: "introduction", label: "journey.introduction" },
  { table: "Journey", column: "seoDescription", label: "journey.seoDescription" },
  { table: "TimelineEvent", column: "description", label: "timelineEvent.description" },
  { table: "Quote", column: "text", label: "quote.text" },
  { table: "Client", column: "notes", label: "client.notes" },
  { table: "PublicationConsent", column: "notes", label: "publicationConsent.notes" },
  { table: "Destination", column: "description", label: "destination.description" },
  { table: "Category", column: "description", label: "category.description" },
] as const;

const results: FieldAudit[] = [];
for (const f of FIELDS) {
  const rows = await prisma.$queryRawUnsafe<{ rows: number; nonNull: number; min: number | null; max: number | null; avg: number | null }[]>(
    `SELECT COUNT(*) AS "rows",
            COUNT("${f.column}") AS "nonNull",
            MIN(CHAR_LENGTH("${f.column}")) AS "min",
            MAX(CHAR_LENGTH("${f.column}")) AS "max",
            AVG(CHAR_LENGTH("${f.column}")) AS "avg"
     FROM "${f.table}"`
  );
  const r = rows[0];
  results.push({
    table: f.table,
    column: f.column,
    rows: r.rows,
    nonNull: r.nonNull,
    min: r.min,
    max: r.max,
    avg: r.avg === null ? null : Math.round(r.avg),
  });
  console.log(
    `${f.label.padEnd(32)} rows=${r.rows} nonNull=${r.nonNull} min=${r.min ?? "-"} max=${r.max ?? "-"} avg=${r.avg === null ? "-" : Math.round(r.avg)}`
  );
}

if (results.some((r) => r.max !== null && r.max > 0)) {
  console.log("\n--- longest rows (top 1 per field with data) ---");
  for (const f of FIELDS) {
    const top = await prisma.$queryRawUnsafe<{ id: string; len: number }[]>(
      `SELECT id, CHAR_LENGTH("${f.column}") AS len FROM "${f.table}" WHERE "${f.column}" IS NOT NULL ORDER BY CHAR_LENGTH("${f.column}") DESC LIMIT 1`
    );
    if (top.length > 0) {
      console.log(`${f.label.padEnd(32)} id=${top[0].id} len=${top[0].len}`);
    }
  }
}

writeFileSync(
  "scripts/field-lengths.json",
  JSON.stringify(
    { ranAt: new Date().toISOString(), fields: results },
    (_key, value) => (typeof value === "bigint" ? Number(value) : value),
    2
  )
);
console.log("\nWrote scripts/field-lengths.json");