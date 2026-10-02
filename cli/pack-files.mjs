import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Downloaded packs can replace only these versioned product files. */
const PACK_PATHS = {
  member: [
    "AGENTS.md",
    "grill/PROJECT.md",
    "grill/MY-ROLE.md",
    "grill/.room",
    ".claude/commands/grill-my-role.md",
    ".claude/skills/check-contract/SKILL.md",
    ".claude/skills/amend-contract/SKILL.md",
  ],
  host: [
    ".claude/skills/grill-host/SKILL.md",
    ".claude/skills/merge-contract/SKILL.md",
  ],
};

const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACK_BYTES = 1024 * 1024;

export const packPaths = (kind) => [...PACK_PATHS[kind]];

/** Validate the complete manifest before the caller reads or writes targets. */
export function validatePack(pack, kind) {
  const expected = PACK_PATHS[kind];
  if (!expected) throw new Error("unknown pack kind");
  if (!pack || !Array.isArray(pack.files) || pack.files.length !== expected.length) {
    throw new Error(`invalid ${kind} pack: expected exactly ${expected.length} files`);
  }

  const seen = new Set();
  let totalBytes = 0;
  const files = pack.files.map((file) => {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error(`invalid ${kind} pack: each file needs a string path and content`);
    }
    const folded = file.path.toLowerCase();
    if (seen.has(folded)) {
      throw new Error(`invalid ${kind} pack: duplicate path ${JSON.stringify(file.path)}`);
    }
    seen.add(folded);
    // Exact portable names also reject traversal, absolute paths, backslashes,
    // Windows alternate streams, trailing dots/spaces, and case aliases.
    if (!expected.includes(file.path)) {
      throw new Error(`invalid ${kind} pack: path is not allowed: ${JSON.stringify(file.path)}`);
    }
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes === 0 || bytes > MAX_FILE_BYTES) {
      throw new Error(`invalid ${kind} pack: ${file.path} must contain 1–${MAX_FILE_BYTES} UTF-8 bytes`);
    }
    totalBytes += bytes;
    if (totalBytes > MAX_PACK_BYTES) {
      throw new Error(`invalid ${kind} pack: total content exceeds ${MAX_PACK_BYTES} UTF-8 bytes`);
    }
    return { path: file.path, content: file.content };
  });
  // Exact count, unique paths, and membership together guarantee completeness.
  return files;
}

/**
 * root is the caller's canonical cwd; paths are already allowlisted (or the
 * fixed local room stamp). Never follow links inside that root, even when
 * they point back into it. Check every target before any installation writes.
 * This is a preflight, not protection against another process replacing paths
 * concurrently or a guarantee of rollback after an I/O failure.
 */
export async function preflightTargets(root, paths) {
  for (const path of paths) {
    const parts = path.split("/");
    let target = root;
    for (const [i, part] of parts.entries()) {
      target = join(target, part);
      let stat;
      try {
        stat = await lstat(target);
      } catch (err) {
        if (err.code === "ENOENT") break;
        throw err;
      }
      if (stat.isSymbolicLink()) {
        throw new Error(`unsafe pack target ${path}: symbolic links and junctions are not allowed`);
      }
      const leaf = i === parts.length - 1;
      if (leaf ? !stat.isFile() : !stat.isDirectory()) {
        throw new Error(`unsafe pack target ${path}: expected ${leaf ? "a regular file" : "directory ancestors"}`);
      }
      if (leaf && stat.nlink > 1) {
        throw new Error(`unsafe pack target ${path}: hard-linked files are not allowed`);
      }
    }
  }
}

/** Only absent pack files are new; unreadable files must abort the whole plan. */
export async function readPackFile(path) {
  try {
    const bytes = await readFile(path);
    const content = bytes.toString("utf8");
    if (!Buffer.from(content, "utf8").equals(bytes)) {
      throw new Error(`invalid UTF-8 in local pack file ${path}; inspect its encoding before retrying`);
    }
    return content;
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
