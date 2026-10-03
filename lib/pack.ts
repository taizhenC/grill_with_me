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

/**
 * The slash command shipped in every pack. Deliberately NOT `grill-me`: a
 * member who already has the stock `grill-me` skill installed must not have
 * it shadowed by ours, and the printed first instruction has to work either
 * way (decision 20).
 */
export const GRILL_COMMAND = "grill-my-role";

/**
 * AGENTS.md is the one pack file a member's repo may already own, so our
 * section is fenced. The CLI replaces what is between these markers and
 * leaves everything else alone (decision 21) — joining, or re-joining after
 * a republish, can never eat a team's own agent instructions.
 */
export const AGENTS_BLOCK_START = "<!-- grill-with-me:start -->";
export const AGENTS_BLOCK_END = "<!-- grill-with-me:end -->";

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

> **Human reading this:** run \`/${GRILL_COMMAND}\` in your AI editor, or paste
> to your agent: _"Read .grill-with-me/MY-ROLE.md and follow it."_ Then just answer the
> questions — about ten minutes. Everything below is addressed to the agent.

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
Give the recommendation as a statement, then request one decision. Do not
append a second question about setup, the next topic, or whether to ask another
question; defer those choices to a later turn.

If a fact can be found in the repo, look it up rather than asking me. The
decisions are mine.

Prefer questions that reference something real: code that already exists in
this repo, or something a teammate wrote in their spec. If my answer
contradicts a teammate's committed spec, point at the exact line and ask
which of us should change.
Only call it a contradiction when the two statements are incompatible.
A teammate omitting a detail (such as a column default) does not reject it.

Make sure we cover:
${bullets(role.mustCover, "whatever the project brief makes essential for this layer")}

Keep a short running summary of what you have understood so far, and show it
to me every few questions so I can correct drift early.

Keep observed repo behavior, teammate commitments, my explicit answers, and
your recommendations distinct. A recommendation becomes my decision only when
I explicitly accept it. Saying "I'm done" ends the interview; it does not
accept an unanswered recommendation or authorize you to choose its details.
Who supplies a test, assertion, or other input does not settle its file
location or exclude it from another role's owned file. Keep that placement
unresolved unless it was explicitly agreed; do not add the exclusion as a
decision merely from the supplying role.

## When I say I'm done

Write \`${specPath(role.slug)}\` containing EXACTLY these five headings once
each, in this order, outside code fences. Individual sections may be empty;
a spec empty under every heading is invalid:

${SPEC_HEADINGS.join("\n")}

Under each heading, be concrete: name endpoints as METHOD /path with request
and response shapes, name tables and columns with types, name files by path.
"An endpoint that returns items" is useless; \`POST /api/rank\` returning
\`{ trails: { id: string; shadeScore: number }[] }\` is what the contract
needs. Do not invent agreements I did not make — anything not yet agreed
belongs under "Still unclear".

Describe existing code as observed behavior, not as a decision to preserve or
replace it. Record only explicitly chosen changes under "Decisions made".
Do not choose new function return shapes, status handling, retry behavior,
rendering, or refresh mechanisms just to make the spec concrete. If my answer
does not specify one, keep that detail under "Still unclear". For example,
"reload" alone does not agree a full page reload or a particular fetch/result
shape. Approving error messages and keeping an item visible does not agree
inline, banner, or toast placement, or a retry action. Split a multi-part
recommendation into separately supported claims: an answer accepting some
clauses leaves every unanswered clause under "Still unclear".
State dependencies under "What I need from other roles" as requests
until the relevant role has agreed; also list their pending agreement under
"Still unclear". Do not claim a teammate approved or implemented a request.

Before writing, check concrete claims in EVERY section, including "Scope"
and "What I own". An endpoint's ownership does not settle its HTTP status,
request body, or pagination. Conventional defaults such as GET returning 200
or POST having no body are not agreements. A call site omitting a body or a
stub accepting no pagination arguments is only observed behavior; label it
with its file path. Each transport rule needs my explicit answer or an
existing teammate agreement. Otherwise leave that rule under "Still unclear",
even when the response shape and endpoint path are already agreed.

Run \`npx grill-with-me check-spec ${specPath(role.slug)}\` after writing it.
If validation fails, correct the structure or report the missing decisions
before telling me to commit. Surface thin-section warnings; never invent
agreements just to make a section longer.
`;
}

export function renderAgentsMd(): string {
  return `${AGENTS_BLOCK_START}
# Agent instructions

Before writing any code that crosses a role boundary, read
\`grill/CONTRACT.md\` and — if it exists — import types from
\`grill/contract.ts\`.

- Use the exact endpoint paths, field names, and data shapes they specify.
- NEVER invent a field name, endpoint, or response shape. If what you need
  is not in the contract, stop and tell the user it needs agreeing with the
  other role first — or run the \`amend-contract\` skill.
- \`.grill-with-me/MY-ROLE.md\` is your local scope. \`grill/PROJECT.md\` is the product
  context.
- If local role instructions are missing, ask the member to join with an
  explicit role. Never select their role from old \`grill/.room\`,
  \`grill/MY-ROLE.md\`, a teammate's spec, or a shared command description.
- The finalized \`grill/CONTRACT.md\` is the current agreement. Run
  \`npx grill-with-me contract-status\` before crossing a role boundary;
  freshness and pending approvals are separate. The two contract histories
  are audit trails, not competing prose to overlay. Stop on integrity
  conflicts or unfinished finalization; report unknown freshness honestly.

If \`grill/CONTRACT.md\` does not exist yet, the team is still in the
grilling phase: follow \`.grill-with-me/MY-ROLE.md\` — the user starts it by running
\`/${GRILL_COMMAND}\`.
${AGENTS_BLOCK_END}
`;
}

/**
 * The slash command that makes "run /grill-my-role" literally true. It is
 * four lines because it must not become a second grill prompt — MY-ROLE.md
 * is the grill (decision 19); this only guarantees the member's very first
 * instruction works without depending on which skills they happen to have.
 */
export function renderGrillCommand(): string {
  return `---
description: Grill me about my locally selected role and write my spec (grill-with-me).
---

Read \`.grill-with-me/MY-ROLE.md\` in this checkout and follow it exactly.
If it is missing, ask the member to join with an explicit role; do not infer
a role from shared files or legacy \`grill/MY-ROLE.md\`. First read
\`grill/PROJECT.md\` and any \`grill/*-spec.md\` teammates have already
committed, so your questions reference what exists. Then start the grill:
one question at a time, each with your recommended answer.
`;
}

/**
 * `.grill-with-me/member.json` — what this checkout joined. `check-contract` reads it for
 * staleness; the CLI reads it to know that a re-join updates the same room
 * (and which role to default to) rather than being a fresh, riskier write.
 */
export function renderRoomStamp(
  roomKey: string,
  roleSlug: string,
  version: number,
): string {
  const stamp = { roomKey, role: roleSlug, packVersion: version };
  return `${JSON.stringify(stamp, null, 2)}\n`;
}

/**
 * Skills bundled into every pack (decision 17: anyone can check or amend).
 * Read from the repo's skills/ directory at render time so the packs always
 * ship the current skill text; cached because packs render per download.
 */
const MEMBER_SKILLS = ["check-contract", "amend-contract"] as const;

const skillCache = new Map<string, PackFile>();

/**
 * Read skills off disk as pack files, cached (packs render per download).
 * Also used by /api/skills so a host can install the host-side skills with
 * one command instead of cloning this repo (decision 22).
 *
 * next.config.mjs traces skills/ into the serverless bundle — without that,
 * every download 500s in production and works fine locally.
 */
export function skillFiles(names: readonly string[]): PackFile[] {
  return names.map((name) => {
    const cached = skillCache.get(name);
    if (cached) return cached;
    const file: PackFile = {
      path: `.claude/skills/${name}/SKILL.md`,
      content: readFileSync(
        join(process.cwd(), "skills", name, "SKILL.md"),
        "utf8",
      ),
    };
    skillCache.set(name, file);
    return file;
  });
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
    { path: ".grill-with-me/MY-ROLE.md", content: renderMyRoleMd(room.project, role) },
    {
      path: ".grill-with-me/member.json",
      content: renderRoomStamp(roomKey, role.slug, version),
    },
    {
      path: `.claude/commands/${GRILL_COMMAND}.md`,
      content: renderGrillCommand(),
    },
    ...skillFiles(MEMBER_SKILLS),
  ];
}
