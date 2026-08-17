import { NextResponse } from "next/server";
import { getStore, toPublic } from "@/lib/store";
import { renderPack } from "@/lib/pack";

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
  const { key } = await params;
  const stored = await getStore().get(key);
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
