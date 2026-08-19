/**
 * The exact commands this app tells people to run.
 *
 * Pure and shared: every surface that prints a command — the join page, the
 * host view, the publish result — has to agree with the others and with
 * cli/grill.mjs, including on a fork or a dev server where `--base` is not
 * optional. A command that is wrong when pasted is worse than none.
 */
export const CLI_DEFAULT_BASE = "https://grill-with-me.vercel.app";

/** `--base` is noise on the canonical deployment and essential everywhere else. */
export function baseFlag(origin: string): string {
  return origin === CLI_DEFAULT_BASE ? "" : ` --base ${origin}`;
}

export function joinCommand(
  key: string,
  origin: string,
  roleSlug?: string,
): string {
  const role = roleSlug ? ` --role ${roleSlug}` : "";
  return `npx grill-with-me join ${key}${role}${baseFlag(origin)}`;
}

export function republishCommand(origin: string): string {
  return `npx grill-with-me republish grill-room.json${baseFlag(origin)}`;
}

export function hostInstallCommand(origin: string): string {
  return `npx grill-with-me host${baseFlag(origin)}`;
}

export function publishCommand(origin: string): string {
  return `npx grill-with-me publish grill-room.json${baseFlag(origin)}`;
}

export function statusCommand(key: string, origin: string): string {
  return `npx grill-with-me status ${key}${baseFlag(origin)}`;
}
