import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const MEMBER_DIRECTORY = ".grill-with-me";
export const MEMBER_RECEIPT = `${MEMBER_DIRECTORY}/member.json`;
export const MEMBER_ROLE = `${MEMBER_DIRECTORY}/MY-ROLE.md`;
const IGNORE_BLOCK = `# grill-with-me member state — local to this checkout\n/${MEMBER_DIRECTORY}/\n*.grill-tmp\n`;

async function hasGitMarker(root) {
  for (let path = root; ; path = dirname(path)) {
    try { await lstat(join(path, ".git")); return true; }
    catch (err) { if (err.code !== "ENOENT") throw err; }
    if (dirname(path) === path) return false;
  }
}

async function git(root, args) {
  const env = { ...process.env, LC_ALL: "C" };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  try {
    return { code: 0, ...await exec("git", args, { cwd: root, env, timeout: 10_000 }) };
  } catch (err) {
    if (err.code === "ENOENT" && !(await hasGitMarker(root))) return { unavailable: true };
    if (typeof err.code !== "number") throw new Error("Git is required to verify member-local state in this checkout");
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

/** A tracked selector is shared input, never a source of the current local role. */
export async function assertMemberLocalStorage(root, requireIgnored = false) {
  const context = await git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (context.unavailable || (context.code !== 0 && context.stderr.includes("not a git repository"))) return;
  if (context.code !== 0 || context.stdout.trim() !== "true") throw new Error("could not verify member-local Git storage");
  const tracked = await git(root, ["ls-files", "--cached", "--stage", "--", `:(icase,literal)${MEMBER_DIRECTORY}`]);
  if (tracked.code !== 0) throw new Error("could not verify whether member-local files are tracked");
  if (tracked.stdout) {
    throw new Error(`${MEMBER_DIRECTORY}/ is tracked by Git; back up its local files, remove the directory from tracking, and rejoin with an explicit --role after inspecting the contents. --force cannot select a shared role.`);
  }
  if (requireIgnored) {
    // Excluding the parent directory prevents nested negations from selecting
    // individual role/receipt files for Git, including newly created files.
    const ignored = await git(root, ["check-ignore", "--quiet", "--", `${MEMBER_DIRECTORY}/`]);
    if (ignored.code !== 0) throw new Error(`Git does not ignore ${MEMBER_DIRECTORY}/; member-local files were not written`);
  }
}

export function memberIgnoreContent(current) {
  if (current.replaceAll("\r\n", "\n").endsWith(IGNORE_BLOCK)) return current;
  return `${current}${current && !current.endsWith("\n") ? "\n" : ""}${IGNORE_BLOCK}`;
}
