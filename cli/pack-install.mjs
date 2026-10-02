import { createHash } from "node:crypto";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isRoomKey } from "./room-key.mjs";
import { packPaths, preflightTargets, readPackFile } from "./pack-files.mjs";

const START = "<!-- grill-with-me:start -->";
const END = "<!-- grill-with-me:end -->";
const RECEIPTS = { member: "grill/.room", host: ".grill-with-me-host.json" };
const digest = (content) => createHash("sha256").update(content, "utf8").digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const roleSlug = (value) => typeof value === "string" && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
const version = (value) => Number.isSafeInteger(value) && value >= 1;
const payloadPaths = (kind) => packPaths(kind).filter((path) => path !== RECEIPTS.member);

export function normalizePackOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("pack base must be an HTTP(S) origin"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("pack base must be an HTTP(S) origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`invalid ${label}: expected JSON`); }
}

function memberIdentity(value) {
  return object(value) && isRoomKey(value.roomKey) && roleSlug(value.role) && version(value.packVersion);
}

function exactKeys(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** Old stamps identify a room, but cannot prove local ownership or an origin. */
export async function readInstallReceipt(root, kind) {
  const path = RECEIPTS[kind];
  await preflightTargets(root, [path]);
  const raw = await readPackFile(join(root, path));
  if (raw === null) return null;
  const value = parseJson(raw, `${path} install receipt`);
  if (kind === "member" && exactKeys(value, ["roomKey", "role", "packVersion"]) && memberIdentity(value)) {
    return { legacy: true };
  }
  const keys = ["receiptVersion", "kind", "origin", "files", ...(kind === "member" ? ["roomKey", "role", "packVersion"] : [])];
  let validOrigin = false;
  try { validOrigin = typeof value?.origin === "string" && normalizePackOrigin(value.origin) === value.origin; } catch { /* invalid */ }
  const paths = payloadPaths(kind);
  if (!exactKeys(value, keys) || value.receiptVersion !== 1 || value.kind !== kind || !validOrigin ||
      (kind === "member" && !memberIdentity(value)) || !exactKeys(value.files, paths) ||
      !paths.every((path) => typeof value.files[path] === "string" && /^[a-f0-9]{64}$/.test(value.files[path]))) {
    throw new Error(`invalid ${path} install receipt; inspect or move it aside before retrying`);
  }
  return value;
}

export const receiptMatches = (receipt, origin, roomKey) =>
  Boolean(receipt && !receipt.legacy && receipt.origin === origin &&
    (receipt.kind === "host" || receipt.roomKey === roomKey));

export function validateMemberIdentity(pack, files, roomKey, role) {
  const stamp = parseJson(files.find((file) => file.path === RECEIPTS.member).content, "downloaded room stamp");
  if (pack.key !== roomKey || pack.role !== role || !roleSlug(role) || !version(pack.version) ||
      !exactKeys(stamp, ["roomKey", "role", "packVersion"]) || !memberIdentity(stamp) ||
      stamp.roomKey !== roomKey || stamp.role !== role || stamp.packVersion !== pack.version) {
    throw new Error("invalid member pack: room, role, or version does not match the requested pack");
  }
}

/** Reject ambiguous fences rather than guessing which text belongs to us. */
function agentsBlock(content, incoming = false) {
  if (content === null) return null;
  const starts = content.split(START).length - 1;
  const ends = content.split(END).length - 1;
  if (!incoming && starts === 0 && ends === 0) return null;
  const start = content.indexOf(START);
  const end = content.indexOf(END) + END.length;
  if (starts !== 1 || ends !== 1 || end <= start + START.length ||
      (incoming && (content.slice(0, start).trim() || content.slice(end).trim()))) {
    throw new Error(`invalid ${incoming ? "downloaded" : "local"} AGENTS.md: expected one complete grill-with-me fence`);
  }
  return { start, end, content: content.slice(start, end) };
}

const temporaryPath = (path) => `${path}.grill-tmp`;

async function requireMissingTemporary(root, path) {
  try { await lstat(join(root, temporaryPath(path))); } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  throw new Error(`unfinished install temporary file ${temporaryPath(path)}; inspect and remove it before retrying`);
}

/** All ownership decisions and structural checks happen before any mutation. */
export async function planInstall(root, files, identity, previous, force = false) {
  const { kind, origin, roomKey } = identity;
  const receiptPath = RECEIPTS[kind];
  const paths = [...payloadPaths(kind), receiptPath, ".gitignore"];
  await preflightTargets(root, [...paths, ...paths.map(temporaryPath)]);
  for (const path of paths) await requireMissingTemporary(root, path);
  const owned = receiptMatches(previous, origin, roomKey) ? previous.files : {};
  const hashes = {};
  const plan = [];
  for (const path of payloadPaths(kind)) {
    const file = files.find((entry) => entry.path === path);
    const current = await readPackFile(join(root, path));
    let content = file.content;
    let oldOwnedContent = current;
    let incomingOwnedContent = file.content;
    if (path === "AGENTS.md") {
      const old = agentsBlock(current);
      const incoming = agentsBlock(file.content, true);
      oldOwnedContent = old?.content ?? null;
      incomingOwnedContent = incoming.content;
      if (old) content = current.slice(0, old.start) + incoming.content + current.slice(old.end);
      else if (current !== null) content = current + (current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n") + file.content;
    }
    hashes[path] = digest(incomingOwnedContent);
    // Matching incoming content is safe to adopt, including files that were
    // replaced before a previous attempt failed to commit its receipt.
    const unchanged = current === content;
    const verified = oldOwnedContent !== null && digest(oldOwnedContent) === owned[path];
    const fresh = oldOwnedContent === null && !owned[path];
    const allowed = unchanged || verified || fresh || force;
    plan.push({ path, content, status: !allowed ? "blocked" : unchanged ? "unchanged" : current === null ? "created" : "updated" });
  }

  // Ignore local state even in a plain folder, without requiring Git to exist.
  // Already tracked files and lower-level ignore overrides need user migration.
  const currentIgnore = await readPackFile(join(root, ".gitignore"));
  let ignore = currentIgnore ?? "";
  for (const pattern of [`/${receiptPath}`, "*.grill-tmp"]) {
    if (!ignore.split(/\r?\n/).includes(pattern)) ignore += `${ignore && !ignore.endsWith("\n") ? "\n" : ""}${pattern}\n`;
  }
  plan.unshift({ path: ".gitignore", content: ignore, status: currentIgnore === ignore ? "unchanged" : currentIgnore === null ? "created" : "updated" });
  const receipt = { receiptVersion: 1, ...identity, files: hashes };
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  const current = await readPackFile(join(root, receiptPath));
  // This is the commit point: never put the receipt before the payload files.
  plan.push({ path: receiptPath, content, status: current === content ? "unchanged" : current === null ? "created" : "updated" });
  return plan;
}

/** Same-directory rename keeps each old file intact until its replacement exists. */
async function atomicWrite(root, file) {
  const temporary = temporaryPath(file.path);
  const paths = [file.path, temporary];
  await preflightTargets(root, paths);
  await requireMissingTemporary(root, file.path);
  const target = join(root, file.path);
  const tempTarget = join(root, temporary);
  await mkdir(dirname(target), { recursive: true });
  await preflightTargets(root, paths);
  let mode = 0o644;
  try { mode = (await lstat(target)).mode & 0o777; } catch (err) { if (err.code !== "ENOENT") throw err; }
  let handle;
  let created = false;
  try {
    handle = await open(tempTarget, "wx", mode);
    created = true;
    await handle.writeFile(file.content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await preflightTargets(root, paths);
    await rename(tempTarget, target);
  } finally {
    if (handle) await handle.close();
    if (created) await unlink(tempTarget).catch((err) => { if (err.code !== "ENOENT") throw err; });
  }
}

export async function executeInstall(root, plan) {
  if (plan.some((file) => file.status === "blocked")) {
    throw new Error(`pack files have local edits or unverified ownership:\n  ${plan.filter((file) => file.status === "blocked").map((file) => file.path).join("\n  ")}\nInspect or back up these files; --force replaces pack content. Specs and CONTRACT files are never touched.`);
  }
  for (const file of plan) {
    if (file.status !== "unchanged") await atomicWrite(root, file);
  }
}
