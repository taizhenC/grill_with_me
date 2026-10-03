import { NextResponse } from "next/server";
import { maintenanceAuth, purgeExpiredData } from "@/lib/maintenance";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Vercel cron uses GET; POST supports an operator's authenticated recovery. */
export async function GET(request: Request) {
  const auth = maintenanceAuth(request);
  if (auth !== "ok") {
    if (auth === "unconfigured") console.error("retention purge configuration unavailable");
    return NextResponse.json({ error: auth === "unconfigured" ? "maintenance is not configured" : "unauthorized" }, {
      status: auth === "unconfigured" ? 503 : 401, headers: { "cache-control": "no-store" },
    });
  }
  try {
    const result = await purgeExpiredData();
    // Only aggregate counts: no room keys, claims, client identities or secrets.
    console.info("retention purge completed", result);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    // Earlier batches may already have committed. Retrying is safe.
    console.error("retention purge failed; reconcile and retry");
    return NextResponse.json({ error: "maintenance is unavailable; retry and reconcile the backlog" }, {
      status: 503, headers: { "cache-control": "no-store", "retry-after": "5" },
    });
  }
}

export const POST = GET;
