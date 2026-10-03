import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { preflightTargets, readPackFile } from "./pack-files.mjs";
import { hashText, recordId } from "./contract-record.mjs";

export const CONTRACT_PATHS = ["grill/CONTRACT.md", "grill/contract.ts", "grill/CONTRACT-CHANGES.md", "grill/CONTRACT-HISTORY.jsonl", "grill/CONTRACT-STATE.json"];
const PENDING = "grill/CONTRACT-PENDING.json";
const LOCK = "grill/CONTRACT-FINALIZE.lock";
const temporary = (path) => `${path}.contract-tmp`;
const read = (root, path) => readPackFile(join(root, path));

async function requireMissing(root, path) {
  if (await read(root, path) !== null) throw new Error(`unfinished temporary file ${path}; inspect it before retrying`);
}

export async function readPending(root) {
  await preflightTargets(root, [...CONTRACT_PATHS, PENDING]);
  const raw = await read(root, PENDING);
  if (raw === null) return null;
  let pending;
  try { pending = JSON.parse(raw); } catch { throw new Error("invalid finalization journal; inspect it before retrying"); }
  const { id, ...record } = pending.revision ?? {};
  const keys = Object.keys(pending.outputs ?? {});
  if (pending.schemaVersion !== 1 || id !== recordId(record) || !/^[a-f0-9]{64}$/.test(pending.proposalHash) ||
      pending.draftHash !== record.proseHash || !(pending.typesDraftHash === null || pending.typesDraftHash === record.typesHash) ||
      !keys.length || keys.some((path) => !CONTRACT_PATHS.includes(path)) ||
      !CONTRACT_PATHS.filter((path) => path !== "grill/contract.ts").every((path) => keys.includes(path)) ||
      Object.keys(pending.before ?? {}).length !== CONTRACT_PATHS.length ||
      !CONTRACT_PATHS.every((path) =>
        (pending.before[path] === null || /^[a-f0-9]{64}$/.test(pending.before[path])))) {
    throw new Error("invalid finalization journal shape or revision; inspect it before retrying");
  }
  try {
    if (!keys.every((path) => typeof pending.outputs[path] === "string") ||
        hashText(pending.outputs[CONTRACT_PATHS[0]]) !== record.proseHash ||
        (Object.hasOwn(pending.outputs, CONTRACT_PATHS[1]) ? hashText(pending.outputs[CONTRACT_PATHS[1]]) : null) !== record.typesHash ||
        hashText(pending.outputs[CONTRACT_PATHS[2]]) !== record.historyHash) throw new Error();
    const state = JSON.parse(pending.outputs[CONTRACT_PATHS[4]]);
    const history = pending.outputs[CONTRACT_PATHS[3]].trimEnd().split(/\r?\n/).map((line) => JSON.parse(line));
    let parent = null;
    for (const [index, entry] of history.entries()) {
      const { id: entryId, ...entryRecord } = entry;
      if (entryRecord.schemaVersion !== 1 || entryRecord.number !== index + 1 || entryRecord.parent !== parent || recordId(entryRecord) !== entryId) throw new Error();
      parent = entryId;
    }
    if (state.schemaVersion !== 1 || state.revision !== id || parent !== id || recordId(history.at(-1)) !== recordId(pending.revision)) throw new Error();
  } catch { throw new Error("finalization journal outputs do not match their revision; inspect it before retrying"); }
  return pending;
}

async function exclusively(root, action) {
  await preflightTargets(root, [LOCK]);
  await mkdir(dirname(join(root, LOCK)), { recursive: true });
  await preflightTargets(root, [LOCK]);
  let handle;
  try { handle = await open(join(root, LOCK), "wx", 0o600); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("another finalizer holds CONTRACT-FINALIZE.lock; if its process stopped, inspect the journal before removing the stale lock");
    throw error;
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid })}\n`, "utf8");
    return await action();
  } finally { await handle.close(); await unlink(join(root, LOCK)); }
}

async function atomicWrite(root, path, content) {
  const temp = temporary(path);
  await preflightTargets(root, [path, temp]);
  let handle;
  let created = false;
  try {
    handle = await open(join(root, temp), "wx", 0o644);
    created = true;
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await preflightTargets(root, [path, temp]);
    await rename(join(root, temp), join(root, path));
  } finally {
    if (handle) await handle.close();
    if (created) await unlink(join(root, temp)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

/** Retry only if every target still equals its recorded old or intended new value. */
export async function completeRevision(root, pending) {
  return exclusively(root, async () => {
    const actual = await readPending(root);
    if (!actual || recordId(actual) !== recordId(pending)) throw new Error("finalization journal changed before retry; inspect it before continuing");
    return writeRevision(root, pending);
  });
}

async function writeRevision(root, pending) {
  const paths = CONTRACT_PATHS.filter((path) => Object.hasOwn(pending.outputs, path));
  await preflightTargets(root, [...paths, ...paths.map(temporary), PENDING]);
  for (const path of CONTRACT_PATHS) {
    if (paths.includes(path)) await requireMissing(root, temporary(path));
    const current = await read(root, path);
    const hash = current === null ? null : hashText(current);
    if (hash !== pending.before[path] && (!Object.hasOwn(pending.outputs, path) || hash !== hashText(pending.outputs[path]))) {
      throw new Error(`${path} changed after interrupted finalization; reconcile it manually before retrying`);
    }
  }
  for (const path of paths) await atomicWrite(root, path, pending.outputs[path]);
  await unlink(join(root, PENDING));
  return { ok: true, revision: pending.revision };
}

/** Exclusive journal acquisition prevents two finalizers from sharing a transaction. */
export async function publishRevision(root, outputs, metadata) {
  return exclusively(root, async () => {
  const paths = Object.keys(outputs);
  await preflightTargets(root, [...paths, ...paths.map(temporary), PENDING]);
  for (const path of paths) await requireMissing(root, temporary(path));
  await mkdir(dirname(join(root, PENDING)), { recursive: true });
  await preflightTargets(root, [...paths, PENDING]);
  const { expectedBefore: before, ...receipt } = metadata;
  const pending = { schemaVersion: 1, ...receipt, before, outputs };
  const handle = await open(join(root, PENDING), "wx", 0o600);
  let persisted = false;
  try {
    for (const path of CONTRACT_PATHS) {
      const raw = await read(root, path);
      if ((raw === null ? null : hashText(raw)) !== before[path]) throw new Error("stale contract plan; re-read the current parent and artifacts before finalizing");
    }
    await handle.writeFile(`${JSON.stringify(pending)}\n`, "utf8"); await handle.sync(); persisted = true;
  }
  catch (error) { if (!persisted) { await handle.close(); await unlink(join(root, PENDING)); } throw error; }
  finally { await handle.close(); }
  await readPending(root);
  return writeRevision(root, pending);
  });
}
