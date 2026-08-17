import { z } from "zod";

/**
 * The wire contract between the `grill-host` skill and the web app.
 *
 * These two ship separately — the skill runs on a host's machine, the app runs
 * on ours — so this schema is the only thing keeping them honest. Bump
 * ROOM_SCHEMA_VERSION on any breaking change and keep accepting the old shape
 * until hosts have re-run the skill.
 *
 * Deliberately semantic, not file-level: the host emits *what the project is*,
 * and the app renders the pack files from templates (see lib/pack.ts). An LLM
 * producing a short structured object fails far less often than one producing
 * a dozen markdown files, and it lets template fixes ship without every host
 * re-running the grill.
 */
export const ROOM_SCHEMA_VERSION = 1;

/** Upload ceiling. Rooms are a few KB of prose; anything larger is abuse. */
export const MAX_ROOM_JSON_BYTES = 256 * 1024;

const slug = z
  .string()
  .min(1)
  .max(40)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "must be lowercase kebab-case (e.g. 'frontend', 'ui-ux')",
  );

export const roleSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  /** One or two sentences, shown on the pick-a-role screen. */
  description: z.string().min(1).max(2000),
  /** Concrete surfaces this role owns. Rendered into MY-ROLE.md. */
  owns: z.array(z.string().min(1).max(500)).max(30).default([]),
  /** Things the grill should be sure to cover for this role. */
  mustCover: z.array(z.string().min(1).max(500)).max(30).default([]),
});

export const projectSchema = z.object({
  name: z.string().min(1).max(120),
  idea: z.string().min(1).max(8000),
  mode: z.enum(["hackathon", "side_project", "production"]),
  /** Hours until the demo. Drives how hard the grill argues for cutting scope. */
  hoursLeft: z.number().int().positive().max(2000).nullable().default(null),
  /** Free text: what the team already knows. Decides whether contract.ts is emitted. */
  knownStack: z.string().max(2000).default(""),
  /** What the demo shows at the end. */
  demoTarget: z.string().max(2000).default(""),
  outOfScope: z.array(z.string().min(1).max(500)).max(30).default([]),
  mustWork: z.array(z.string().min(1).max(500)).max(30).default([]),
});

export const grillRoomSchema = z
  .object({
    schemaVersion: z.literal(ROOM_SCHEMA_VERSION),
    project: projectSchema,
    roles: z.array(roleSchema).min(1).max(12),
  })
  .superRefine((room, ctx) => {
    const seen = new Set<string>();
    room.roles.forEach((role, i) => {
      if (seen.has(role.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles", i, "slug"],
          message: `duplicate role slug "${role.slug}"`,
        });
      }
      seen.add(role.slug);
    });
  });

export type Role = z.infer<typeof roleSchema>;
export type Project = z.infer<typeof projectSchema>;
export type GrillRoom = z.infer<typeof grillRoomSchema>;

export type ParseResult =
  | { ok: true; room: GrillRoom }
  | { ok: false; errors: string[] };

/** Format a Zod issue as `roles[0].slug: message` so the host can find it. */
function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path
    .map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`))
    .join("")
    .replace(/^\./, "");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Parse raw JSON text into a room. Never throws — the upload path needs a
 * readable error, not a stack trace, and a half-created room is worse than
 * a rejected one.
 */
export function parseGrillRoom(raw: string): ParseResult {
  if (raw.length > MAX_ROOM_JSON_BYTES) {
    return {
      ok: false,
      errors: [
        `file is ${raw.length} bytes; the limit is ${MAX_ROOM_JSON_BYTES}`,
      ],
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      errors: [`not valid JSON: ${(err as Error).message}`],
    };
  }

  const result = grillRoomSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(formatIssue) };
  }
  return { ok: true, room: result.data };
}
