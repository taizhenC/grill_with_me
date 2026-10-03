import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { storeConfig } from "./store-config";
import { getStore } from "./store";
import { purgeMemoryRequestQuotas } from "./rate-limit";

export const PURGE_ROOM_BATCH = 1000;
export const PURGE_QUOTA_BATCH = 2000;
export const PURGE_MAX_BATCHES = 20;
export const PURGE_MAX_RUNTIME_MS = 20_000;
export type PurgeCounts = { roomsDeleted: number; quotaBucketsDeleted: number; publicationRequestsDeleted: number };

/** Validate configuration before comparing credentials. Never include secrets in errors. */
export function maintenanceAuth(request: Request): "ok" | "unauthorized" | "unconfigured" {
  const secret = process.env.CRON_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return "unconfigured";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected) ? "ok" : "unauthorized";
}

export async function purgeBatch(): Promise<PurgeCounts> {
  const config = storeConfig(process.env);
  if (config.mode === "memory") {
    const store = getStore();
    if (!("purgeExpired" in store) || typeof store.purgeExpired !== "function" || !("purgePublications" in store) || typeof store.purgePublications !== "function") {
      throw new Error("memory room maintenance unavailable");
    }
    return {
      roomsDeleted: store.purgeExpired(PURGE_ROOM_BATCH),
      quotaBucketsDeleted: purgeMemoryRequestQuotas(PURGE_QUOTA_BATCH),
      publicationRequestsDeleted: store.purgePublications(PURGE_ROOM_BATCH),
    };
  }
  const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("purge_expired_data", {
    p_room_limit: PURGE_ROOM_BATCH, p_quota_limit: PURGE_QUOTA_BATCH,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error || !data || !Number.isSafeInteger(data.roomsDeleted) || data.roomsDeleted < 0 || data.roomsDeleted > PURGE_ROOM_BATCH ||
      !Number.isSafeInteger(data.quotaBucketsDeleted) || data.quotaBucketsDeleted < 0 || data.quotaBucketsDeleted > PURGE_QUOTA_BATCH ||
      !Number.isSafeInteger(data.publicationRequestsDeleted) || data.publicationRequestsDeleted < 0 || data.publicationRequestsDeleted > PURGE_ROOM_BATCH) {
    throw new Error("maintenance backend unavailable");
  }
  return { roomsDeleted: data.roomsDeleted, quotaBucketsDeleted: data.quotaBucketsDeleted, publicationRequestsDeleted: data.publicationRequestsDeleted };
}

export async function purgeExpiredData() {
  const total = { roomsDeleted: 0, quotaBucketsDeleted: 0, publicationRequestsDeleted: 0, batches: 0, needsAnotherRun: false };
  const deadline = performance.now() + PURGE_MAX_RUNTIME_MS;
  for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
    if (performance.now() >= deadline) { total.needsAnotherRun = true; break; }
    const batch = await purgeBatch();
    total.roomsDeleted += batch.roomsDeleted;
    total.quotaBucketsDeleted += batch.quotaBucketsDeleted;
    total.publicationRequestsDeleted += batch.publicationRequestsDeleted;
    total.batches++;
    total.needsAnotherRun = batch.roomsDeleted === PURGE_ROOM_BATCH || batch.quotaBucketsDeleted === PURGE_QUOTA_BATCH || batch.publicationRequestsDeleted === PURGE_ROOM_BATCH;
    if (!total.needsAnotherRun) break;
  }
  // Locked rows can be skipped even when needsAnotherRun is false. Operators
  // reconcile database expiry counts; this is a backlog hint, not a certificate.
  return total;
}
