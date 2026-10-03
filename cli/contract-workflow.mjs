import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { preflightMerge } from "./merge-preflight.mjs";
import { preflightTargets, readPackFile } from "./pack-files.mjs";
import { agreementHashes, agreementId, hashText, recordId, parseProposal } from "./contract-record.mjs";
import { CONTRACT_PATHS, readPending, completeRevision, publishRevision } from "./contract-files.mjs";

const PROSE = "grill/CONTRACT.md";
const TYPES = "grill/contract.ts";
const HISTORY = "grill/CONTRACT-HISTORY.jsonl";
const CHANGES = "grill/CONTRACT-CHANGES.md";
const STATE = "grill/CONTRACT-STATE.json";
const paths = CONTRACT_PATHS;
const read = (root, path) => readPackFile(join(root, path));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fingerprints = (raw) => Object.fromEntries(Object.entries(raw).map(([path, value]) => [path, value === null ? null : hashText(value)]));

function pendingAgreements(history) {
  const pending = new Map();
  for (const record of history) {
    for (const id of record.resolvesPending ?? []) pending.delete(id);
    if (record.approval === "pending") pending.set(record.id, { revision: record.id, roles: record.pendingRoles });
  }
  return [...pending.values()];
}

async function sourceSnapshot(root, roomFile = "grill-room.json") {
  const gate = await preflightMerge(root, roomFile);
  if (!gate.ok) throw new Error(gate.errors.join("; "));
  const specs = await Promise.all(gate.specs.map(async (spec) => ({ ...spec, hash: hashText(await read(root, spec.file)) })));
  specs.sort((a, b) => a.file < b.file ? -1 : 1);
  return { roomFile, roomHash: hashText(JSON.stringify(gate.manifest)), specs };
}

async function currentRevision(root) {
  await preflightTargets(root, paths);
  const stateRaw = await read(root, STATE);
  const historyRaw = await read(root, HISTORY);
  if (stateRaw === null) {
    if (historyRaw !== null) throw new Error("revision history has no current state; retry or reconcile an interrupted finalization");
    const raw = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await read(root, path)])));
    raw[STATE] = stateRaw;
    raw[HISTORY] = historyRaw;
    return { revision: null, history: [], historyRaw: "", raw, before: fingerprints(raw) };
  }
  const state = JSON.parse(stateRaw);
  if (state.schemaVersion !== 1 || !historyRaw) throw new Error("invalid contract revision state/history");
  const history = historyRaw.trimEnd().split(/\r?\n/).map((line) => JSON.parse(line));
  let parent = null;
  for (const [index, entry] of history.entries()) {
    const { id, ...record } = entry;
    if (record.schemaVersion !== 1 || record.number !== index + 1 || record.parent !== parent || recordId(record) !== id) {
      throw new Error("contract revision history conflicts; reconcile it before continuing");
    }
    parent = id;
  }
  const revision = history.at(-1);
  if (revision.id !== state.revision) throw new Error("revision state does not match history; retry or reconcile interrupted finalization");
  const prose = await read(root, PROSE);
  const types = await read(root, TYPES);
  const changes = await read(root, CHANGES);
  if (prose === null || changes === null || hashText(prose) !== revision.proseHash ||
      (types === null ? null : hashText(types)) !== revision.typesHash || hashText(changes) !== revision.historyHash) {
    throw new Error("contract prose/types/history are out of sync; retry or reconcile interrupted finalization");
  }
  const raw = { [PROSE]: prose, [TYPES]: types, [CHANGES]: changes, [HISTORY]: historyRaw, [STATE]: stateRaw };
  return { revision, history, historyRaw, raw, before: fingerprints(raw) };
}

/** Fresh means local source/artifact hashes match; it makes no online claim. */
export async function contractStatus(root) {
  let current;
  try {
    const pending = await readPending(root);
    if (pending) return { ok: false, freshness: "unknown", revision: null,
      proposedRevision: pending.revision, reason: "unfinished contract finalization; retry the same proposal" };
    current = await currentRevision(root);
  }
  catch (error) { return { ok: false, freshness: "unknown", revision: null, integrity: "conflict", reason: error.message }; }
  if (!current.revision) {
    const prose = await read(root, PROSE);
    const types = await read(root, TYPES);
    const changes = await read(root, CHANGES);
    return { ok: true, freshness: "unknown", revision: null, reason: "no recorded contract revision",
      ...(prose !== null || types !== null || changes !== null ? { legacy: { historyHash: hashText(changes ?? "") } } : {}) };
  }
  const { revision } = current;
  const pending = pendingAgreements(current.history);
  if (!revision.source) return { ok: true, freshness: "unknown", revision, pending, reason: "no source snapshot recorded" };
  try {
    const source = await sourceSnapshot(root, revision.source.roomFile);
    return { ok: true, freshness: same(source, revision.source) ? "fresh" : "stale", revision, pending };
  } catch (error) { return { ok: true, freshness: "unknown", revision, pending, reason: `source freshness cannot be verified: ${error.message}` }; }
}

/** Finalize staged outputs rather than generate or interpret an AI agreement. */
export async function finalizeContract(root, proposalFile = "grill/CONTRACT-PROPOSAL.json") {
  await preflightTargets(root, ["grill/CONTRACT.next.md", "grill/contract.next.ts"]);
  const proposal = parseProposal(await readFile(join(root, proposalFile), "utf8"));
  const pending = await readPending(root);
  if (pending) {
    const draft = await read(root, "grill/CONTRACT.next.md");
    const typesDraft = pending.typesDraftHash ? await read(root, "grill/contract.next.ts") : null;
    if (recordId(proposal) !== pending.proposalHash || draft === null || hashText(draft) !== pending.draftHash) {
      throw new Error("interrupted finalization requires the same proposal and staged outputs; reconcile changed inputs manually");
    }
    if (pending.typesDraftHash && (typesDraft === null || hashText(typesDraft) !== pending.typesDraftHash)) throw new Error("interrupted finalization requires the same staged types");
    return completeRevision(root, pending);
  }
  const plan = await planContract(root, proposalFile);
  return publishRevision(root, plan.outputs, plan.metadata);
}

/** Plan without writing; publication must verify this exact original snapshot under its journal lock. */
export async function planContract(root, proposalFile = "grill/CONTRACT-PROPOSAL.json") {
  await preflightTargets(root, ["grill/CONTRACT.next.md", "grill/contract.next.ts"]);
  const proposal = parseProposal(await readFile(join(root, proposalFile), "utf8"));
  const current = await currentRevision(root);
  if (!["merge", "amend", "adopt"].includes(proposal.kind) || proposal.parentRevision !== (current.revision?.id ?? null) ||
      (proposal.kind === "amend" && !current.revision) || (proposal.kind === "adopt" && current.revision)) throw new Error("invalid kind or parent revision");
  const previousChanges = current.raw[CHANGES] ?? "";
  const legacy = !current.revision && (current.raw[PROSE] !== null || current.raw[TYPES] !== null || previousChanges);
  if (legacy && proposal.kind !== "adopt") throw new Error("existing unrecorded contract/history must be explicitly adopted before a merge");
  if (proposal.kind === "adopt" && (!legacy || proposal.legacyHistoryHash !== hashText(previousChanges))) {
    throw new Error("adoption must acknowledge the current legacy history hash shown by contract-status");
  }
  if (typeof proposal.summary !== "string" || !proposal.summary.trim() || proposal.summary.length > 500) throw new Error("proposal needs a bounded summary");
  let types = null;
  if (proposal.types === "none" && current.raw[TYPES] !== null) throw new Error("existing contract types require explicit preserve or replace; none cannot discard them");
  if (proposal.types === "preserve") {
    types = current.raw[TYPES];
    if (types === null) throw new Error("no existing contract types to preserve");
  } else if (proposal.types === "replace") {
    types = await read(root, "grill/contract.next.ts");
    if (types === null || !types.trim() || Buffer.byteLength(types, "utf8") > 256 * 1024) throw new Error("missing, empty, or oversized staged contract types");
  }
  const prose = await read(root, "grill/CONTRACT.next.md");
  if (prose === null || Buffer.byteLength(prose, "utf8") > 1024 * 1024) throw new Error("missing or oversized staged contract");
  const agreements = agreementHashes(prose);
  const previous = current.revision?.agreements ?? {};
  const changedProse = [...new Set([...Object.keys(agreements), ...Object.keys(previous)])].filter((id) => agreements[id] !== previous[id]).sort();
  const ids = [...proposal.changedAgreementIds].sort();
  const typesHash = types === null ? null : hashText(types);
  const changedTypes = typesHash !== (current.revision?.typesHash ?? null);
  if (!ids.every((id) => agreementId.test(id) && (Object.hasOwn(agreements, id) || Object.hasOwn(previous, id))) ||
      !changedProse.every((id) => ids.includes(id)) || (!changedTypes && !same(ids, changedProse)) || (changedTypes && !ids.length)) {
    throw new Error("changedAgreementIds must name all changed prose agreements and identify the agreements affected by changed types");
  }
  const amendmentResolution = proposal.amendmentResolution;
  if (!Array.isArray(amendmentResolution)) throw new Error("proposal needs amendmentResolution");
  const amendments = current.history.filter((record) => record.kind === "amend");
  const unresolved = pendingAgreements(current.history).map((entry) => entry.revision);
  if (proposal.resolvesPending.some((id) => !unresolved.includes(id))) throw new Error("resolvesPending must identify currently pending revisions");
  if (proposal.kind === "merge" && (!same(amendmentResolution.map((entry) => entry.revision).sort(), amendments.map((entry) => entry.id).sort()) ||
      !amendmentResolution.every((entry) => ["preserved", "reconciled"].includes(entry.decision) && typeof entry.note === "string" && entry.note.trim()))) {
    throw new Error("re-merge must explicitly preserve or reconcile every amendment against the current parent revision");
  }
  for (const resolution of proposal.kind === "merge" ? amendmentResolution : []) {
    if (resolution.decision !== "preserved") continue;
    const amendment = amendments.find((entry) => entry.id === resolution.revision);
    if (amendment.typesHash !== null && typesHash !== current.revision.typesHash) throw new Error("preserved typed amendment requires unchanged current types; explicitly reconcile changed types instead");
    for (const id of amendment.changedAgreementIds) {
      if (agreements[id] !== previous[id]) throw new Error(`preserved amendment agreement ${id} changed; explicitly reconcile that amendment instead`);
    }
  }
  let source;
  if (proposal.kind === "amend") source = current.revision.source;
  else if (proposal.kind === "adopt") {
    try { source = await sourceSnapshot(root); } catch { source = null; }
  } else source = await sourceSnapshot(root);
  if (source && proposal.pendingRoles.some((role) => !source.specs.some((spec) => spec.role === role))) throw new Error("pendingRoles must name roles in the source roster");
  const number = current.history.length + 1;
  const changes = `${previousChanges}${previousChanges && !previousChanges.endsWith("\n") ? "\n" : ""}\n## Contract revision ${number} — ${proposal.summary}\n- Kind: ${proposal.kind}\n- Changed agreements: ${ids.join(", ")}\n- Approval: ${proposal.approval}\n- Agreed by: ${proposal.agreedBy.join(", ")}\n- Pending roles: ${proposal.pendingRoles.join(", ") || "none"}\n- Resolved pending revisions: ${proposal.resolvesPending.join(", ") || "none"}\n`;
  const record = { schemaVersion: 1, number, parent: current.revision?.id ?? null, kind: proposal.kind,
    summary: proposal.summary, changedAgreementIds: ids, approval: proposal.approval,
    agreedBy: proposal.agreedBy, pendingRoles: proposal.pendingRoles, resolvesPending: proposal.resolvesPending, amendmentResolution, agreements, source,
    proseHash: hashText(prose), typesHash, historyHash: hashText(changes) };
  const revision = { id: recordId(record), ...record };
  const history = `${current.historyRaw}${current.historyRaw && !current.historyRaw.endsWith("\n") ? "\n" : ""}${JSON.stringify(revision)}\n`;
  const outputs = { [PROSE]: prose, [CHANGES]: changes, [HISTORY]: history,
    [STATE]: `${JSON.stringify({ schemaVersion: 1, revision: revision.id }, null, 2)}\n` };
  if (types !== null) outputs[TYPES] = types;
  return { outputs, metadata: { revision, proposalHash: recordId(proposal), draftHash: hashText(prose),
    typesDraftHash: proposal.types === "replace" ? typesHash : null, expectedBefore: current.before } };
}
