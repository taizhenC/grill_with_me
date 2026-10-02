import { NextResponse, type NextRequest } from "next/server";
import { enforceRequestLimit } from "@/lib/rate-limit";

/** Page requests consume once, before metadata and page rendering read the DB. */
export async function proxy(request: NextRequest) {
  return await enforceRequestLimit(request, "read") ?? NextResponse.next();
}

export const config = { matcher: "/r/:path*" };
