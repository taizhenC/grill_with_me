import { createHash } from "node:crypto";
import type { GrillRoom } from "./schema";
import { publicOrigin } from "./public-origin";
import { readPublicationCapability } from "../cli/publication-capability.mjs";

export type PublicationRequest = { hash: string; payloadHash: string; origin: string; issuedAt: string; expiresAt: string };
export type PublicationResult = { key: string; hostToken: string; recovery?: { expiresAt: string; replayed: boolean } };

export function publicationRequest(request: Request, room: GrillRoom): PublicationRequest | undefined {
  const capability = request.headers.get("idempotency-key");
  if (capability === null) return undefined;
  const { issuedAt, expiresAt } = readPublicationCapability(capability);
  const headers = new Headers(request.headers);
  if (!headers.has("host")) headers.set("host", new URL(request.url).host);
  // Zod emits known fields in schema order and applies defaults. Whitespace,
  // unknown fields and object-key ordering do not change the validated payload.
  return {
    hash: createHash("sha256").update(capability).digest("hex"),
    payloadHash: createHash("sha256").update(JSON.stringify(room)).digest("hex"),
    origin: publicOrigin(headers, process.env),
    issuedAt: new Date(issuedAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(),
  };
}
