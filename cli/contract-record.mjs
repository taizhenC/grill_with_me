import { createHash } from "node:crypto";

export const hashText = (text) => createHash("sha256").update(text.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const recordId = (record) => hashText(JSON.stringify(canonical(record)));
export const agreementId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const revisionId = /^[a-f0-9]{64}$/;

export function parseProposal(raw) {
  if (Buffer.byteLength(raw, "utf8") > 64 * 1024) throw new Error("contract proposal exceeds 64 KiB");
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error("contract proposal is not valid JSON"); }
  const keys = ["schemaVersion", "kind", "parentRevision", "summary", "changedAgreementIds", "approval", "agreedBy", "pendingRoles", "types", "amendmentResolution", "legacyHistoryHash", "resolvesPending"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key)) ||
      value.schemaVersion !== 1 || !["merge", "amend", "adopt"].includes(value.kind) ||
      !(value.parentRevision === null || typeof value.parentRevision === "string" && revisionId.test(value.parentRevision))) {
    throw new Error("invalid contract proposal version, fields, kind, or parentRevision");
  }
  const text = (entry, limit) => typeof entry === "string" && entry.trim().length > 0 && entry.length <= limit && !/[\r\n\0]/.test(entry);
  const list = (entries, limit, item) => Array.isArray(entries) && entries.length <= limit && new Set(entries).size === entries.length && entries.every(item);
  if (!text(value.summary, 500)) throw new Error("proposal needs a bounded one-line summary");
  if (!list(value.changedAgreementIds, 100, (id) => text(id, 100) && agreementId.test(id))) throw new Error("invalid changedAgreementIds");
  if (!list(value.agreedBy, 12, (person) => text(person, 120)) || !value.agreedBy.length) throw new Error("agreedBy must name who requested/agreed the change");
  if (!list(value.pendingRoles, 12, (role) => text(role, 40) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role)) ||
      !["agreed", "pending"].includes(value.approval) || (value.approval === "pending") !== (value.pendingRoles.length > 0)) {
    throw new Error("approval and pendingRoles must consistently record pending agreement");
  }
  if (!["none", "preserve", "replace"].includes(value.types)) throw new Error("invalid staged types policy");
  if (!Array.isArray(value.amendmentResolution) || value.amendmentResolution.length > 1000 ||
      new Set(value.amendmentResolution.map((entry) => entry?.revision)).size !== value.amendmentResolution.length ||
      !value.amendmentResolution.every((entry) => entry && revisionId.test(entry.revision) && ["preserved", "reconciled"].includes(entry.decision) && text(entry.note, 2000))) {
    throw new Error("invalid amendmentResolution revision, decision, or note");
  }
  value.resolvesPending ??= [];
  if (!list(value.resolvesPending, 1000, (id) => typeof id === "string" && revisionId.test(id)) ||
      value.resolvesPending.length && value.approval !== "agreed") throw new Error("resolvesPending requires explicit agreed approval");
  if (value.legacyHistoryHash !== undefined && (typeof value.legacyHistoryHash !== "string" || !revisionId.test(value.legacyHistoryHash))) {
    throw new Error("invalid legacyHistoryHash");
  }
  return value;
}

/** Stable agreement blocks; literal examples cannot manufacture agreement IDs. */
export function agreementHashes(markdown) {
  const blocks = new Map();
  let current = null;
  let fence = null;
  let comment = false;
  for (const original of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.marker}{${fence.length},}[ \\t]*$`).test(original)) fence = null;
      if (current) blocks.get(current).push(original);
      continue;
    }
    const opening = !comment && original.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) {
      fence = { marker: opening[1][0], length: opening[1].length };
      if (current) blocks.get(current).push(original);
      continue;
    }
    let visible = "";
    let at = 0;
    while (at < original.length) {
      const boundary = original.indexOf(comment ? "-->" : "<!--", at);
      if (boundary < 0) { visible += comment ? " ".repeat(original.length - at) : original.slice(at); break; }
      visible += comment ? " ".repeat(boundary + 3 - at) : original.slice(at, boundary) + "    ";
      at = boundary + (comment ? 3 : 4);
      comment = !comment;
    }
    const heading = visible.trimEnd();
    const match = heading.match(/^### \[agreement:([a-z0-9.-]+)\]$/);
    if (match && original.trimEnd() === heading) {
      const id = match[1];
      if (!agreementId.test(id) || id.length > 100 || blocks.has(id)) throw new Error(`invalid or duplicate agreement ID: ${id}`);
      current = id;
      blocks.set(id, []);
    } else {
      if (/^#{1,3}(?:[ \t]|$)/.test(heading)) current = null;
      if (current) blocks.get(current).push(original);
    }
  }
  if (!blocks.size || blocks.size > 100) throw new Error("contract requires 1–100 stable ### [agreement:id] blocks");
  return Object.fromEntries([...blocks].sort(([a], [b]) => a < b ? -1 : 1).map(([id, lines]) => {
    const body = lines.join("\n").trim();
    if (!body) throw new Error(`agreement ${id} is empty`);
    return [id, hashText(body)];
  }));
}
