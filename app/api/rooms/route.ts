import { NextResponse } from "next/server";
import { parseGrillRoom, MAX_ROOM_JSON_BYTES } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { allowCreate, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/rooms — publish a room.
 * Body: the raw grill-room.json emitted by the grill-host skill.
 * 201 → { key, hostToken, url } ; 400 → { errors: string[] }
 *
 * Validation is all-or-nothing: a malformed file is rejected with field
 * paths, never half-created (plan §6 exit criteria).
 */
export async function POST(request: Request) {
  if (!allowCreate(clientIp(request))) {
    return NextResponse.json(
      { errors: ["too many rooms created from this address; try later"] },
      { status: 429 },
    );
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_ROOM_JSON_BYTES) {
    return NextResponse.json(
      { errors: [`payload too large (limit ${MAX_ROOM_JSON_BYTES} bytes)`] },
      { status: 413 },
    );
  }

  const raw = await request.text();
  const parsed = parseGrillRoom(raw);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const { key, hostToken } = await getStore().create(parsed.room);
  return NextResponse.json(
    { key, hostToken, url: `/r/${key}` },
    { status: 201 },
  );
}
