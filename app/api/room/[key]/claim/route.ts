import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore, NotFoundError } from "@/lib/store";
import { readRequestText, MAX_CLAIM_JSON_BYTES } from "@/lib/request-body";
import { isRoomKey } from "@/lib/keys";
import { storageUnavailable } from "@/lib/store-response";

const claimBody = z.object({
  role: z.string().min(1).max(40),
  displayName: z.string().min(1).max(60),
});

/**
 * POST /api/room/[key]/claim — record who took a role.
 * Informational only (plan §7): last write wins, no auth. The claim exists
 * so the host can see who is where, not to gate downloads.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!isRoomKey(key)) return NextResponse.json({ error: "room not found" }, { status: 404 });

  const raw = await readRequestText(request, MAX_CLAIM_JSON_BYTES);
  if (!raw.ok) return raw.response;
  let body: unknown;
  try {
    body = JSON.parse(raw.text);
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = claimBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "expected { role, displayName }" },
      { status: 400 },
    );
  }

  try {
    await getStore().claim(key, parsed.data.role, parsed.data.displayName);
  } catch (err) {
    const unavailable = storageUnavailable(err);
    if (unavailable) return unavailable;
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { error: `room or role not found` },
        { status: 404 },
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
