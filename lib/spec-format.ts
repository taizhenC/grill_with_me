/**
 * The fixed structure of a role spec (P0-2).
 *
 * This is the load-bearing agreement in the whole pipeline: MY-ROLE.md asks
 * the member's agent to write these headings, and merge-contract refuses to
 * parse anything that doesn't carry them. One list, imported by both sides,
 * so they can never drift.
 */
export const SPEC_HEADINGS = [
  "## Scope",
  "## What I own",
  "## What I need from other roles",
  "## Decisions made",
  "## Still unclear",
] as const;

export type SpecValidation =
  | { ok: true }
  | { ok: false; missing: string[] };

/**
 * Check that a spec file carries every required heading, in order.
 * Order matters: sections are parsed by slicing between headings.
 */
export function validateSpec(markdown: string): SpecValidation {
  const missing: string[] = [];
  let cursor = 0;
  for (const heading of SPEC_HEADINGS) {
    const at = markdown.indexOf(`\n${heading}`, cursor);
    const atStart = markdown.startsWith(heading) && cursor === 0;
    if (at === -1 && !atStart) {
      missing.push(heading);
    } else {
      cursor = atStart ? heading.length : at + heading.length + 1;
    }
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/** Path a role's spec is expected at, relative to the repo root. */
export function specPath(roleSlug: string): string {
  return `grill/${roleSlug}-spec.md`;
}
