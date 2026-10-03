import { mintPublicationCapability, readPublicationCapability } from "@/cli/publication-capability.mjs";
import { parseGrillRoom } from "./schema";

const STORAGE_KEY = "grill-with-me.publication.v1";
export type BrowserPublication = { version: 1; origin: string; body: string; capability: string };

/** A capability and brief stay in this tab's session storage, never in a URL. */
export function loadPublication(storage: Storage, origin: string): BrowserPublication | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  if (raw.length > 6 * 256 * 1024) throw new Error("Saved publication is invalid. Discard it before starting another publication.");
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error("Saved publication is invalid. Discard it before starting another publication."); }
  if (!value || value.version !== 1 || value.origin !== origin || typeof value.body !== "string" || !parseGrillRoom(value.body).ok) {
    throw new Error("Saved publication cannot be used at this service. Discard it before starting another publication.");
  }
  try { readPublicationCapability(value.capability); }
  catch (error) {
    // Keep an expired but otherwise valid attempt visible: silently forgetting it
    // would turn an uncertain write into a fresh publication on the next click.
    if (!(error instanceof Error) || !("code" in error) || error.code !== "publication_gone") {
      throw new Error("Saved publication is invalid. Discard it before starting another publication.");
    }
  }
  return { version: 1, origin, body: value.body, capability: value.capability };
}

export function savePublication(storage: Storage, origin: string, body: string): BrowserPublication {
  const value: BrowserPublication = { version: 1, origin, body, capability: mintPublicationCapability() };
  const raw = JSON.stringify(value);
  storage.setItem(STORAGE_KEY, raw);
  if (storage.getItem(STORAGE_KEY) !== raw) throw new Error("could not save publication recovery");
  return value;
}

export function discardPublication(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
  if (storage.getItem(STORAGE_KEY) !== null) throw new Error("could not discard publication recovery");
}

export function publicationExpiry(attempt: BrowserPublication): number {
  return readPublicationCapability(attempt.capability).expiresAt;
}
