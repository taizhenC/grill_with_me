// Shared by browser, server and dependency-free CLI. An immutable timestamp
// makes old capabilities unusable even after database tombstones are purged.
export const PUBLICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PUBLICATION_CLOCK_SKEW_MS = 5 * 60 * 1000;
export class PublicationError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}
export function readPublicationCapability(value, now = Date.now()) {
  const match = typeof value === "string" && /^v1\.(0|[1-9][0-9]{0,10})\.[a-f0-9]{64}$/.exec(value);
  if (!match) throw new PublicationError("publication_invalid", "invalid publication recovery capability", 400);
  const issuedAt = Number(match[1]) * 1000;
  const expiresAt = issuedAt + PUBLICATION_WINDOW_MS;
  if (issuedAt > now + PUBLICATION_CLOCK_SKEW_MS) throw new PublicationError("publication_invalid", "publication clock is ahead of the service; check the device clock", 400);
  if (expiresAt <= now) throw new PublicationError("publication_gone", "publication recovery window has expired; check the original outcome before creating another room", 410);
  return { issuedAt, expiresAt };
}
export function mintPublicationCapability(now = Date.now()) {
  const secret = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `v1.${Math.floor(now / 1000)}.${secret}`;
}
