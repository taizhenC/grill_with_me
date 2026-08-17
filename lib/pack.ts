import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GrillRoom, Role, Project } from "./schema";
import { SPEC_HEADINGS, specPath } from "./spec-format";

/**
 * Renders a validated room into the file tree a member receives.
 *
 * Templates live here — versioned with the app, not embedded in the host
 * skill's output — so a template fix ships without every host re-running
 * their grill. See lib/schema.ts for the reasoning.
 *
 * Design constraint (decision 19): there is no member-grill skill. MY-ROLE.md
 * must carry the entire grill — scope, instructions, and the output contract —
 * strongly enough that a generic agent (or the stock grill-me skill) produces
 * a well-formed spec from it.
 */

export type PackFile = { path: string; content: string };

const bullets = (items: string[], empty: string): string =>
  items.length ? items.map((s) => `- ${s}`).join("\n") : `- ${empty}`;

function deadlineLine(project: Project): string {
  if (project.mode !== "hackathon" || project.hoursLeft == null) return "";
  return `\n**Deadline pressure: ~${project.hoursLeft} hours to the demo.** When a decision trades polish against shipping, argue for shipping. Never suggest work that only matters after the demo (scaling, monitoring, auth hardening) unless it is on the must-work list.\n`;
}

export function renderProjectMd(project: Project): string {
  return `# ${project.name}

## The idea
${project.idea}

## What the demo must show
${project.demoTarget || "_Not specified — ask the host._"}

## Must work
${bullets(project.mustWork, "nothing pinned yet")}

## Explicitly out of scope
${bullets(project.outOfScope, "nothing excluded yet")}

## Stack the team already knows
${project.knownStack || "_Not specified._"}
${deadlineLine(project)}`;
}

export function renderMyRoleMd(project: Project, role: Role): string {
  return `# Your role: ${role.name}

${role.description}

## What you own
${bullets(role.owns, "to be pinned down during the grill")}

## Before we start
Read \`grill/PROJECT.md\`, any \`grill/*-spec.md\` files your teammates have
already committed, and the repo you are standing in.

## The grill

Interview me relentlessly about MY LAYER ONLY — the "${role.name}" role —
until we reach a shared understanding of what I am building and what I need
from the other roles. Walk down each branch of the decision tree, resolving
dependencies between decisions one by one. For each question, provide your
recommended answer. Ask one question at a time — multiple questions at once
is bewildering.

If a fact can be found in the repo, look it up rather than asking me. The
decisions are mine.

Prefer questions that reference something real: code that already exists in
this repo, or something a teammate wrote in their spec. If my answer
contradicts a teammate's committed spec, point at the exact line and ask
which of us should change.

Make sure we cover:
${bullets(role.mustCover, "whatever the project brief makes essential for this layer")}

Keep a short running summary of what you have understood so far, and show it
to me every few questions so I can correct drift early.

## When I say I'm done

Write \`${specPath(role.slug)}\` containing EXACTLY these five headings, in
this order, even if a section is empty:

${SPEC_HEADINGS.join("\n")}

Under each heading, be concrete: name endpoints as METHOD /path with request
and response shapes, name tables and columns with types, name files by path.
"An endpoint that returns items" is useless; \`POST /api/rank\` returning
\`{ trails: { id: string; shadeScore: number }[] }\` is what the contract
needs. Do not invent agreements I did not make — anything not yet agreed
belongs under "Still unclear".
`;
}

export function renderAgentsMd(): string {
  return `# Agent instructions

Before writing any code that crosses a role boundary, read
\`grill/CONTRACT.md\` and — if it exists — import types from
\`grill/contract.ts\`.

- Use the exact endpoint paths, field names, and data shapes they specify.
- NEVER invent a field name, endpoint, or response shape. If what you need
  is not in the contract, stop and tell the user it needs agreeing with the
  other role first — or run the \`amend-contract\` skill.
- \`grill/MY-ROLE.md\` is your scope. \`grill/PROJECT.md\` is the product
  context.
- \`grill/CONTRACT-CHANGES.md\` overrides \`CONTRACT.md\` wherever they
  disagree.

If \`grill/CONTRACT.md\` does not exist yet, the team is still in the
grilling phase: follow \`grill/MY-ROLE.md\`.
`;
}

export function renderRoomStamp(roomKey: string, version: number): string {
  return `${JSON.stringify({ roomKey, packVersion: version }, null, 2)}\n`;
}

/**
 * Skills bundled into every pack (decision 17: anyone can check or amend).
 * Read from the repo's skills/ directory at render time so the packs always
 * ship the current skill text; cached because packs render per download.
 */
const BUNDLED_SKILLS = ["check-contract", "amend-contract"] as const;

let bundledSkillsCache: PackFile[] | null = null;

function bundledSkillFiles(): PackFile[] {
  if (!bundledSkillsCache) {
    const skillsDir = join(process.cwd(), "skills");
    bundledSkillsCache = BUNDLED_SKILLS.map((name) => ({
      path: `.claude/skills/${name}/SKILL.md`,
      content: readFileSync(join(skillsDir, name, "SKILL.md"), "utf8"),
    }));
  }
  return bundledSkillsCache;
}

/**
 * The full file tree for one role's pack, as path -> content.
 * Paths are relative to the member's repo root.
 */
export function renderPack(
  room: GrillRoom,
  roleSlug: string,
  roomKey: string,
  version: number,
): PackFile[] {
  const role = room.roles.find((r) => r.slug === roleSlug);
  if (!role) {
    throw new Error(`no role "${roleSlug}" in this room`);
  }
  return [
    { path: "AGENTS.md", content: renderAgentsMd() },
    { path: "grill/PROJECT.md", content: renderProjectMd(room.project) },
    { path: "grill/MY-ROLE.md", content: renderMyRoleMd(room.project, role) },
    { path: "grill/.room", content: renderRoomStamp(roomKey, version) },
    ...bundledSkillFiles(),
  ];
}
