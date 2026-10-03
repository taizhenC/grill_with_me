import { createHash } from "node:crypto";
import { normalizeHostOrigin, readPublicationFile, savePublicationFile } from "./host-credentials.mjs";
import { mintPublicationCapability, parsePublicationCapability, readPublicationCapability } from "./publication-capability.mjs";
import { ROOM_KEY_PATTERN } from "./room-key.mjs";

const hash = (body) => createHash("sha256").update(body).digest("hex");
const MAX_BODY_BYTES = 256 * 1024;
function validateBody(body) {
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("publication body exceeds the 256 KiB service limit");
  try { JSON.parse(body); } catch { throw new Error("publication body is not valid JSON"); }
}

export async function preparePublication(root, options) {
  if (options.recover && options.newPublication) throw new Error("--recover and --new-publication cannot be combined");
  const raw = await readPublicationFile(root);
  let saved;
  if (raw !== null) {
    try {
      saved = JSON.parse(raw);
      if (!saved || saved.version !== 1 || typeof saved.capability !== "string" ||
          saved.origin !== normalizeHostOrigin(saved.origin) || typeof saved.bodyHash !== "string") throw new Error();
      validateBody(saved.body);
      if (saved.bodyHash !== hash(saved.body)) throw new Error();
      // Expiry is checked when reusing, not when explicitly replacing an old
      // attempt. Malformed state still requires inspection instead of guessing.
      parsePublicationCapability(saved.capability);
    } catch { throw new Error("invalid saved publication recovery state; inspect or move the file before retrying"); }
  }
  if (options.recover && !saved) throw new Error("no saved publication to recover");
  const origin = normalizeHostOrigin(options.origin ?? (options.recover ? saved.origin : undefined));
  const body = options.recover ? saved.body : options.body;
  validateBody(body);
  let state;
  if (saved && !options.newPublication) {
    if (saved.origin !== origin) throw new Error("saved publication belongs to another origin; use --recover at its original destination or explicitly --new-publication");
    if (saved.bodyHash !== hash(body)) throw new Error("saved publication has a different payload; use --recover for the original request or explicitly --new-publication");
    readPublicationCapability(saved.capability);
    state = saved;
  } else {
    state = { version: 1, origin, body, bodyHash: hash(body), capability: mintPublicationCapability() };
    if (!options.dryRun) await savePublicationFile(root, `${JSON.stringify(state, null, 2)}\n`, raw);
  }
  return state;
}

export function validatePublicationAcknowledgement(result, capability) {
  if (typeof result.key !== "string" || !ROOM_KEY_PATTERN.test(result.key) ||
      typeof result.hostToken !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(result.hostToken)) {
    throw new Error("service returned invalid publication credentials; keep the recovery file and check the service before retrying");
  }
  // A valid committed response may arrive just after the window closes.
  const { expiresAt } = parsePublicationCapability(capability);
  if (result.recovery?.expiresAt !== new Date(expiresAt).toISOString() || typeof result.recovery?.replayed !== "boolean") {
    throw new Error("service did not acknowledge this recovery capability; room creation may have succeeded. Keep the recovery file and check the service version before retrying");
  }
}
