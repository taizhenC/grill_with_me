import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { storeConfig } from "./store-config";
import { storageUnavailable } from "./store-response";

type Policy = { client: number; global: number; seconds: number };
export const REQUEST_LIMITS = {
  create: { client: 20, global: 500, seconds: 3600 },
  read: { client: 1000, global: 10000, seconds: 3600 },
  claim: { client: 120, global: 1000, seconds: 3600 },
  republish: { client: 60, global: 500, seconds: 3600 },
} satisfies Record<string, Policy>;
export type RequestAction = keyof typeof REQUEST_LIMITS;
type Policies = Record<RequestAction, Policy>;
export type QuotaDecision = { allowed: boolean; retryAfter: number };
export interface RequestLimiter {
  consume(action: RequestAction, bucket: string): Promise<QuotaDecision>;
}
export class QuotaUnavailableError extends Error {
  readonly code = "GRILL_QUOTA_UNAVAILABLE";
}

function isQuotaUnavailable(error: unknown): boolean {
  // The cached backend can originate in a different Next API/proxy bundle,
  // whose Error subclass constructor has a different identity.
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "GRILL_QUOTA_UNAVAILABLE";
}

/** Trust only sanitized deployment ingress, never arbitrary forwarded headers. */
export function clientIp(request: Request): string {
  let raw: string | null = null;
  if (process.env.VERCEL === "1") {
    raw = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  } else if (process.env.GRILL_TRUST_PROXY === "1") {
    raw = request.headers.get("x-forwarded-for");
  }
  const ip = raw?.split(",")[0].trim();
  if (!ip || ip.includes("%") || !isIP(ip)) return "unknown";
  return isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname : ip;
}

type Counter = { hits: number; expiresAt: number };
/** Volatile counterpart only for explicitly selected development/tests. */
export class MemoryRequestLimiter implements RequestLimiter {
  private counters = new Map<string, Counter>();
  constructor(private policies: Policies = REQUEST_LIMITS, private now = Date.now) {}

  purgeExpired(limit: number): number {
    let deleted = 0;
    for (const [key, counter] of this.counters) {
      if (deleted >= limit) break;
      if (!key.endsWith(":global") && counter.expiresAt <= this.now() - 3600000) {
        this.counters.delete(key); deleted++;
      }
    }
    return deleted;
  }

  async consume(action: RequestAction, bucket: string): Promise<QuotaDecision> {
    const now = this.now();
    const policy = this.policies[action];
    const window = policy.seconds * 1000;
    const expiresAt = (Math.floor(now / window) + 1) * window;
    const globalKey = `${action}:global`;
    let global = this.counters.get(globalKey);
    if (!global || global.expiresAt <= now) {
      global = { hits: 0, expiresAt };
      this.counters.set(globalKey, global);
    }
    for (const [key, counter] of this.counters) {
      if (key.startsWith(`${action}:`) && key !== globalKey && counter.expiresAt <= now - 3600000) this.counters.delete(key);
    }
    const reject = (counter: Counter): QuotaDecision => ({ allowed: false, retryAfter: Math.max(1, Math.ceil((counter.expiresAt - now) / 1000)) });
    if (global.hits >= policy.global) return reject(global);
    const clientKey = `${action}:${bucket}`;
    let client = this.counters.get(clientKey);
    if (!client || client.expiresAt <= now) {
      client = { hits: 0, expiresAt };
      this.counters.set(clientKey, client);
    }
    if (client.hits >= policy.client) return reject(client);
    global.hits++;
    client.hits++;
    return { allowed: true, retryAfter: 0 };
  }
}

export class SupabaseRequestLimiter implements RequestLimiter {
  constructor(private db: SupabaseClient) {}
  async consume(action: RequestAction, bucket: string): Promise<QuotaDecision> {
    const policy = REQUEST_LIMITS[action];
    try {
      const { data, error } = await this.db.rpc("consume_request_quota", {
        p_scope: action, p_bucket: bucket, p_client_limit: policy.client,
        p_global_limit: policy.global, p_window_seconds: policy.seconds,
      }).abortSignal(AbortSignal.timeout(5000));
      if (error || typeof data?.allowed !== "boolean" ||
        !Number.isSafeInteger(data.retryAfter) || data.retryAfter < 0 || data.retryAfter > policy.seconds ||
        (data.allowed && data.retryAfter !== 0) || (!data.allowed && data.retryAfter < 1)) {
        throw new QuotaUnavailableError();
      }
      return { allowed: data.allowed, retryAfter: data.retryAfter };
    } catch {
      throw new QuotaUnavailableError("request quota backend unavailable");
    }
  }
}

const GLOBAL_KEY = Symbol.for("grill-with-me.request-limiter");
type Backend = { limiter: RequestLimiter; secret: string };
type GlobalWithLimiter = { [GLOBAL_KEY]?: Backend };
function backend(): Backend {
  const global = globalThis as GlobalWithLimiter;
  if (global[GLOBAL_KEY]) return global[GLOBAL_KEY];
  const config = storeConfig(process.env);
  const selected = config.mode === "memory"
    ? { limiter: new MemoryRequestLimiter(), secret: randomBytes(32).toString("hex") }
    : { limiter: new SupabaseRequestLimiter(createClient(config.url, config.serviceKey, { auth: { persistSession: false } })), secret: config.serviceKey };
  global[GLOBAL_KEY] = selected;
  return selected;
}

/** One atomic database call checks both global and client budgets. */
export async function enforceRequestLimit(request: Request, action: RequestAction): Promise<NextResponse | null> {
  try {
    const { limiter, secret } = backend();
    const bucket = createHmac("sha256", secret).update(`grill-request-quota:v1:${clientIp(request)}`).digest("hex");
    const decision = await limiter.consume(action, bucket);
    if (decision.allowed) return null;
    return NextResponse.json({ error: "too many requests; try again later" }, {
      status: 429,
      headers: { "retry-after": String(decision.retryAfter), "cache-control": "no-store" },
    });
  } catch (error) {
    const configuration = storageUnavailable(error);
    if (configuration) return configuration;
    if (!isQuotaUnavailable(error)) throw error;
    return NextResponse.json({ error: "request protection is unavailable; try again later" }, {
      status: 503, headers: { "retry-after": "5", "cache-control": "no-store" },
    });
  }
}

/** Test hooks; not called by runtime routes. */
export function setRequestLimiter(limiter: RequestLimiter | null): void {
  const global = globalThis as GlobalWithLimiter;
  if (limiter === null) delete global[GLOBAL_KEY];
  else global[GLOBAL_KEY] = { limiter, secret: "test-only-request-identity" };
}
export function resetRateLimit(): void { setRequestLimiter(new MemoryRequestLimiter()); }

/** Maintenance hook for the explicitly selected volatile development backend. */
export function purgeMemoryRequestQuotas(limit: number): number {
  const limiter = backend().limiter;
  if (!("purgeExpired" in limiter) || typeof limiter.purgeExpired !== "function") {
    throw new Error("memory quota maintenance unavailable");
  }
  return limiter.purgeExpired(limit);
}
