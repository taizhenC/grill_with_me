import { NextResponse } from "next/server";
import { skillFiles } from "@/lib/pack";

/**
 * GET /api/skills/[bundle] — the skill files, as { path, content }[].
 *
 * Exists for `npx grill-with-me host` (decision 22). Before this, a host's
 * first instruction was "copy skills/grill-host/ into your agent's skills",
 * which quietly required cloning this repo — the single largest piece of
 * setup friction in the product, and on the person who does all the setup.
 *
 * Still no LLM, still no auth: this hands out the same public markdown that
 * lives in the repo, from the same machine that hands out packs.
 */
const BUNDLES: Record<string, readonly string[]> = {
  host: ["grill-host", "merge-contract"],
  member: ["check-contract", "amend-contract"],
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bundle: string }> },
) {
  const { bundle } = await params;
  const names = BUNDLES[bundle];
  if (!names) {
    return NextResponse.json(
      {
        error: `no skill bundle "${bundle}" — try ${Object.keys(BUNDLES)
          .map((b) => `"${b}"`)
          .join(" or ")}`,
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ bundle, files: skillFiles(names) });
}
