import { randomBytes, randomInt } from "node:crypto";

/**
 * Room keys are the only access control (accepted for MVP): memorable enough
 * to read aloud at a table, random enough not to be guessed. Three words plus
 * a number from a 40-word list ≈ 40^3 × 100 ≈ 6.4M combinations — fine for
 * unlisted rooms with a 30-day TTL, not for anything more.
 */
const WORDS = [
  "amber", "birch", "cedar", "coral", "delta", "ember", "fable", "flint",
  "gale", "grove", "harbor", "hazel", "indigo", "iris", "jade", "juniper",
  "kestrel", "lagoon", "linden", "maple", "meadow", "nectar", "nimbus",
  "ochre", "onyx", "pearl", "pine", "quartz", "raven", "reef", "sable",
  "sierra", "slate", "summit", "tiger", "topaz", "umber", "vale", "willow",
  "zephyr",
] as const;

export function generateRoomKey(): string {
  const pick = () => WORDS[randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${randomInt(10, 100)}`;
}

/** Bearer secret the host uses to re-publish. Never rendered into packs. */
export function generateHostToken(): string {
  return randomBytes(24).toString("base64url");
}

export const ROOM_KEY_PATTERN = /^[a-z]+-[a-z]+-\d{2}$/;
