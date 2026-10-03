import { NextResponse } from "next/server";
import { getStore, toPublic, NotFoundError, ForbiddenError } from "@/lib/store";
import { storageUnavailable } from "@/lib/store-response";
import { renderPack } from "@/lib/pack";
import { isRoomKey } from "@/lib/keys";
import { enforceRequestLimit } from "@/lib/rate-limit";

/**
 * GET /api/room/[key] — the JSON the CLI reads (decision 14).
 *
 * Without ?role: room summary — project name, version, roles with claim
 * state. With ?role=<slug>: additionally that role's full pack as
 * { path, content }[] so the CLI can write files directly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const limited = await enforceRequestLimit(request, "read");
  if (limited) return limited;
  const { key } = await params;
  let stored;
  try {
    stored = isRoomKey(key) ? await getStore().get(key) : null;
  } catch (err) {
    const unavailable = storageUnavailable(err);
    if (unavailable) return unavailable;
    throw err;
  }
  if (!stored) {
    return NextResponse.json(
      { error: `no room "${key}" — it may have expired` },
      { status: 404 },
    );
  }

  const pub = toPublic(stored);
  const summary = {
    key: pub.key,
    version: pub.version,
    project: { name: pub.room.project.name, mode: pub.room.project.mode },
    roles: pub.room.roles.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      claimedBy: pub.claims[r.slug] ?? null,
    })),
  };

  const roleSlug = new URL(request.url).searchParams.get("role");
  if (!roleSlug) {
    return NextResponse.json(summary);
  }

  if (!stored.room.roles.some((r) => r.slug === roleSlug)) {
    return NextResponse.json(
      { error: `no role "${roleSlug}" in this room` },
      { status: 404 },
    );
  }
  const files = renderPack(stored.room, roleSlug, stored.key, stored.version);
  return NextResponse.json({ ...summary, role: roleSlug, files });
}

/** DELETE /api/room/[key] — remove the database row with the original host token. */
export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  // Deletion shares the host-mutation budget with republish.
  const limited = await enforceRequestLimit(request, "republish");
  if (limited) return limited;
  const { key } = await params;
  if (!isRoomKey(key)) return NextResponse.json({ error: "room not found" }, { status: 404 });
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "missing Authorization: Bearer <hostToken>" }, { status: 401 });
  try {
    await getStore().delete(key, token);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const unavailable = storageUnavailable(error);
    if (unavailable) return unavailable;
    if (error instanceof NotFoundError) return NextResponse.json({ error: "room not found" }, { status: 404 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "bad host token" }, { status: 403 });
    return NextResponse.json({ error: "room deletion is unavailable; check room status before retrying" }, {
      status: 503, headers: { "cache-control": "no-store", "retry-after": "5" },
    });
  }
}
