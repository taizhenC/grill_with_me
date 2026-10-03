import { execFile } from "node:child_process";
import { lstat, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { preflightTargets, readPackFile } from "./pack-files.mjs";

const exec = promisify(execFile);
export const CONFIG_FILE = ".grill-with-me.json";
export const PUBLICATION_FILE = ".grill-with-me-publish.json";
const TEMP_FILE = `${CONFIG_FILE}.tmp`;
const SECRET_FILES = [CONFIG_FILE, TEMP_FILE, PUBLICATION_FILE, `${PUBLICATION_FILE}.tmp`];
const IGNORE_BLOCK = `# grill-with-me host credentials — do not commit\n${SECRET_FILES.map((file) => `/${file}\n`).join("")}`;

/** Credential-bearing operations support origin URLs, not arbitrary API paths. */
export function normalizeHostOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("host destination must be a valid HTTP(S) origin");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("host destination must be an origin without credentials, a path, query, or fragment");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("host credentials require HTTPS; HTTP is allowed only for loopback development");
  }
  return url.origin;
}

export function validateHostRoomKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new Error("invalid room key for host operation");
  }
  return value;
}

export function validateHostToken(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(value)) {
    throw new Error("invalid host token; supply a nonempty URL-safe token");
  }
  return value;
}

/** Explicit credentials apply to this call; saved credentials have a binding. */
export function selectHostToken(config, base, roomKey, explicitToken) {
  if (explicitToken !== undefined) return validateHostToken(explicitToken);
  if (!config.hostToken) return null;
  let savedOrigin;
  try {
    savedOrigin = normalizeHostOrigin(config.base);
  } catch {
    throw new Error("saved host token has no valid origin binding; supply an explicit --token");
  }
  if (savedOrigin !== base || config.roomKey !== roomKey) {
    throw new Error("saved host token belongs to a different origin or room; supply an explicit --token for this destination");
  }
  return validateHostToken(config.hostToken);
}


async function git(root, args) {
  const env = { ...process.env, LC_ALL: "C" };
  // Inspect this checkout's real index, not an unrelated GIT_DIR/index override.
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key)) delete env[key];
  try {
    const { stdout, stderr } = await exec("git", args, { cwd: root, env, timeout: 10_000 });
    return { code: 0, stdout, stderr };
  } catch (err) {
    if (err.code === "ENOENT") throw new Error("Git is required to verify host credential storage");
    if (typeof err.code !== "number") throw new Error("could not verify Git state for host credentials");
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

async function assertUntracked(root) {
  const context = await git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (context.code !== 0 && context.stderr.includes("not a git repository")) return false;
  if (context.code !== 0 || context.stdout.trim() !== "true") {
    throw new Error("could not verify this checkout's Git state; host credentials were not used or saved");
  }
  const tracked = await git(root, [
    "ls-files", "--cached", "--stage", "--",
    ...SECRET_FILES.map((file) => `:(icase,literal)${file}`),
  ]);
  if (tracked.code !== 0) throw new Error("could not verify whether host credential files are tracked");
  if (tracked.stdout) {
    throw new Error("host credential file is already tracked by Git; remove it from tracking and rotate any exposed token before retrying");
  }
  return true;
}

export async function readHostConfig(root) {
  await preflightTargets(root, [CONFIG_FILE]);
  const raw = await readPackFile(join(root, CONFIG_FILE));
  if (raw === null) return {};
  await assertUntracked(root);
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`invalid ${CONFIG_FILE}; repair or move the file before retrying`);
  }
  if (!config || Array.isArray(config) || typeof config !== "object" ||
      ["base", "roomKey", "hostToken"].some((key) => config[key] !== undefined && typeof config[key] !== "string")) {
    throw new Error(`invalid ${CONFIG_FILE}; expected string credential fields`);
  }
  return config;
}

export async function readPublicationFile(root) {
  await preflightTargets(root, SECRET_FILES);
  await assertUntracked(root);
  return readPackFile(join(root, PUBLICATION_FILE));
}

/** Establish ignore protection before asking a server to create a credential. */
export async function prepareHostStorage(root) {
  await preflightTargets(root, [...SECRET_FILES, ".gitignore"]);
  const inGit = await assertUntracked(root);
  for (const file of [TEMP_FILE, `${PUBLICATION_FILE}.tmp`]) {
    try {
      await lstat(join(root, file));
      throw new Error(`temporary credential file ${file} already exists; inspect it before retrying`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  const ignorePath = join(root, ".gitignore");
  const current = (await readPackFile(ignorePath)) ?? "";
  if (!current.endsWith(IGNORE_BLOCK)) {
    await writeFile(ignorePath, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${IGNORE_BLOCK}`, "utf8");
  }
  if (inGit) {
    for (const path of SECRET_FILES) {
      const ignored = await git(root, ["check-ignore", "--quiet", "--", path]);
      if (ignored.code !== 0) throw new Error(`Git does not ignore ${path}; host credentials were not saved`);
    }
  }
}

/** Exclusive temporary file plus compare-before-rename prevents two first
 * publishers that read an absent/old record from silently replacing each other. */
export async function savePublicationFile(root, contents, expectedContents) {
  await prepareHostStorage(root);
  const temporary = join(root, `${PUBLICATION_FILE}.tmp`);
  let created = false;
  try {
    await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
    created = true;
    await preflightTargets(root, SECRET_FILES);
    if (await readPackFile(join(root, PUBLICATION_FILE)) !== expectedContents) {
      throw new Error("publication state changed");
    }
    await rename(temporary, join(root, PUBLICATION_FILE));
  } catch (err) {
    if (created) await unlink(temporary).catch(() => {});
    throw new Error(`could not save publication recovery safely (${err.code ?? "state changed"}); no new publication was sent`);
  }
}

/** The temporary file is ignored too; rename preserves the old config on failure. */
export async function saveHostConfig(root, config) {
  const saved = {
    base: normalizeHostOrigin(config.base),
    roomKey: validateHostRoomKey(config.roomKey),
    hostToken: validateHostToken(config.hostToken),
  };
  await prepareHostStorage(root);
  const temporary = join(root, TEMP_FILE);
  let created = false;
  try {
    await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    created = true;
    await preflightTargets(root, [CONFIG_FILE, TEMP_FILE]);
    await rename(temporary, join(root, CONFIG_FILE));
  } catch (err) {
    if (created) await unlink(temporary).catch(() => {});
    throw new Error(`could not save host credentials safely (${err.code ?? "storage changed"}); the server may already have created the room`);
  }
  return { saved: join(root, CONFIG_FILE), gitignored: true };
}
