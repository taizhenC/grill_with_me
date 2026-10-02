import { NextResponse } from "next/server";
import { parseGrillRoom, MAX_ROOM_JSON_BYTES } from "@/lib/schema";
import { getStore, NotFoundError, ForbiddenError } from "@/lib/store";
import { readRequestText } from "@/lib/request-body";
import { isRoomKey } from "@/lib/keys";
import { enforceRequestLimit } from "@/lib/rate-limit";
import { storageUnavailable } from "@/lib/store-response";

/**
 * POST /api/room/[key]/republish — host swaps the room content, version bumps.
 * Auth: `Authorization: Bearer <hostToken>` from the original publish.
 * Members find out via the .room stamp in freshly downloaded packs
 * (decision 18); telling them to re-download stays the host's job.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const limited = await enforceRequestLimit(request, "republish");
  if (limited) return limited;
  const { key } = await params;
  if (!isRoomKey(key)) return NextResponse.json({ error: "room not found" }, { status: 404 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "missing Authorization: Bearer <hostToken>" },
      { status: 401 },
    );
  }

  const body = await readRequestText(request, MAX_ROOM_JSON_BYTES);
  if (!body.ok) return body.response;
  const parsed = parseGrillRoom(body.text);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  try {
    const version = await getStore().republish(key, token, parsed.room);
    return NextResponse.json({ key, version });
  } catch (err) {
    const unavailable = storageUnavailable(err);
    if (unavailable) return unavailable;
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "room not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "bad host token" }, { status: 403 });
    }
    throw err;
  }
}
