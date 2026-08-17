import { NextResponse } from "next/server";
import { parseGrillRoom } from "@/lib/schema";
import { getStore, NotFoundError, ForbiddenError } from "@/lib/store";

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
  const { key } = await params;

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "missing Authorization: Bearer <hostToken>" },
      { status: 401 },
    );
  }

  const parsed = parseGrillRoom(await request.text());
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  try {
    const version = await getStore().republish(key, token, parsed.room);
    return NextResponse.json({ key, version });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "room not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "bad host token" }, { status: 403 });
    }
    throw err;
  }
}
