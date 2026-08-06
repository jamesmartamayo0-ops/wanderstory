import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runSecurityMaintenance } from "@/lib/maintenance";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || !safeEqual(secret, provided)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSecurityMaintenance();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error: unknown) {
    console.error("Security maintenance cron failed:", error);
    return NextResponse.json({ ok: false, error: "Maintenance failed" }, { status: 500 });
  }
}
