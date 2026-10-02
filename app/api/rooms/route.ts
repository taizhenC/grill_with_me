import { NextResponse } from "next/server";
import { parseGrillRoom, MAX_ROOM_JSON_BYTES } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { storageUnavailable } from "@/lib/store-response";
import { enforceRequestLimit } from "@/lib/rate-limit";
import { readRequestText } from "@/lib/request-body";

/**
 * POST /api/rooms — publish a room.
 * Body: the raw grill-room.json emitted by the grill-host skill.
 * 201 → { key, hostToken, url } ; 400 → { errors: string[] }
 *
 * Validation is all-or-nothing: a malformed file is rejected with field
 * paths, never half-created (plan §6 exit criteria).
 */
export async function POST(request: Request) {
  const limited = await enforceRequestLimit(request, "create");
  if (limited) return limited;

  const body = await readRequestText(request, MAX_ROOM_JSON_BYTES);
  if (!body.ok) return body.response;
  const parsed = parseGrillRoom(body.text);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  try {
    const { key, hostToken } = await getStore().create(parsed.room);
    return NextResponse.json(
      { key, hostToken, url: `/r/${key}` },
      { status: 201 },
    );
  } catch (err) {
    const unavailable = storageUnavailable(err);
    if (unavailable) return unavailable;
    throw err;
  }
}
