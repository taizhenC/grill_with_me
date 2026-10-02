import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { clientIp, enforceRequestLimit, MemoryRequestLimiter, QuotaUnavailableError, REQUEST_LIMITS, setRequestLimiter, SupabaseRequestLimiter, type RequestAction } from "@/lib/rate-limit";

afterEach(() => { setRequestLimiter(null); vi.unstubAllEnvs(); });
const request = (headers: Record<string, string> = {}) => new Request("https://test/api/rooms", { headers });
const tiny = {
  create: { client: 2, global: 3, seconds: 60 }, read: { client: 2, global: 3, seconds: 60 },
  claim: { client: 2, global: 3, seconds: 60 }, republish: { client: 2, global: 3, seconds: 60 },
};

describe("trusted client identity", () => {
  it("does not trust caller-provided forwarding headers on arbitrary deployments", () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("GRILL_TRUST_PROXY", "");
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.1", "x-vercel-forwarded-for": "203.0.113.2", "x-real-ip": "203.0.113.3" }))).toBe("unknown");
  });
  it("uses Vercel's sanitized header only when running on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(request({ "x-vercel-forwarded-for": "203.0.113.2", "x-forwarded-for": "203.0.113.1" }))).toBe("203.0.113.2");
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.1" }))).toBe("203.0.113.1");
  });
  it("allows an explicitly trusted ingress and normalizes IPv6 spellings", () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("GRILL_TRUST_PROXY", "1");
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.1, 203.0.113.2" }))).toBe("203.0.113.1");
    expect(clientIp(request({ "x-forwarded-for": "2001:0db8:0:0:0:0:0:1" }))).toBe("[2001:db8::1]");
    expect(clientIp(request({ "x-forwarded-for": "2001:db8::1" }))).toBe("[2001:db8::1]");
  });
  it.each(["", "not-an-ip", "1.2.3.999", "host.example", "203.0.113.1:8080", "fe80::1%eth0"])("does not allocate arbitrary identity buckets for %s", (ip) => {
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(request({ "x-vercel-forwarded-for": ip }))).toBe("unknown");
  });
});

describe("memory quota parity", () => {
  it("checks global and client counters atomically without charging denied requests", async () => {
    const limiter = new MemoryRequestLimiter(tiny, () => 1000);
    expect((await limiter.consume("create", "a")).allowed).toBe(true);
    expect((await limiter.consume("create", "a")).allowed).toBe(true);
    expect(await limiter.consume("create", "a")).toEqual({ allowed: false, retryAfter: 59 });
    expect((await limiter.consume("create", "b")).allowed).toBe(true);
    expect((await limiter.consume("create", "c")).allowed).toBe(false);
    expect((await limiter.consume("read", "a")).allowed).toBe(true);
  });
  it("starts a new budget at the fixed window boundary", async () => {
    let now = 59000;
    const limiter = new MemoryRequestLimiter(tiny, () => now);
    await limiter.consume("claim", "a"); await limiter.consume("claim", "a");
    expect(await limiter.consume("claim", "a")).toEqual({ allowed: false, retryAfter: 1 });
    now = 60000;
    expect(await limiter.consume("claim", "a")).toEqual({ allowed: true, retryAfter: 0 });
  });
  it("admits only the limit when calls arrive together", async () => {
    const limiter = new MemoryRequestLimiter(tiny, () => 1000);
    const results = await Promise.all(Array.from({ length: 30 }, () => limiter.consume("republish", "a")));
    expect(results.filter((r) => r.allowed)).toHaveLength(2);
  });
});

function transport(body: unknown, status = 200) {
  const requests: { path: string; body: unknown }[] = [];
  const db = createClient("https://test.supabase.co", "private-service-key", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const req = new Request(input, init);
      requests.push({ path: new URL(req.url).pathname, body: await req.json() });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    } },
  });
  return { limiter: new SupabaseRequestLimiter(db), requests };
}

describe("durable quota transport", () => {
  it("checks both budgets in one actual client RPC call", async () => {
    const { limiter, requests } = transport({ allowed: false, retryAfter: 25 });
    const bucket = "a".repeat(64);
    expect(await limiter.consume("claim", bucket)).toEqual({ allowed: false, retryAfter: 25 });
    expect(requests).toEqual([{ path: "/rest/v1/rpc/consume_request_quota", body: {
      p_scope: "claim", p_bucket: bucket, p_client_limit: REQUEST_LIMITS.claim.client,
      p_global_limit: REQUEST_LIMITS.claim.global, p_window_seconds: 3600,
    } }]);
  });
  it.each([null, {}, { allowed: "true", retryAfter: 0 }, { allowed: true, retryAfter: 1 }, { allowed: false, retryAfter: 0 }, { allowed: false, retryAfter: 3601 }])("fails closed for an invalid backend acknowledgement %j", async (body) => {
    await expect(transport(body).limiter.consume("create", "a".repeat(64))).rejects.toBeInstanceOf(QuotaUnavailableError);
  });
  it("fails closed when the backend reports a database failure", async () => {
    await expect(transport({ message: "private DB details" }, 500).limiter.consume("read", "a".repeat(64))).rejects.toBeInstanceOf(QuotaUnavailableError);
  });
});

describe("request enforcement", () => {
  it("sends only a stable HMAC client identity to the limiter", async () => {
    vi.stubEnv("VERCEL", "1");
    const consume = vi.fn(async (_action: RequestAction, _bucket: string) => ({ allowed: true, retryAfter: 0 }));
    setRequestLimiter({ consume });
    await enforceRequestLimit(request({ "x-vercel-forwarded-for": "203.0.113.1" }), "read");
    await enforceRequestLimit(request({ "x-vercel-forwarded-for": "203.0.113.1" }), "read");
    await enforceRequestLimit(request({ "x-vercel-forwarded-for": "203.0.113.2" }), "read");
    const buckets = consume.mock.calls.map((call) => call[1]);
    expect(buckets[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(buckets[0]).toBe(buckets[1]); expect(buckets[0]).not.toBe(buckets[2]);
    expect(JSON.stringify(consume.mock.calls)).not.toContain("203.0.113");
  });
  it("returns a no-store429 with Retry-After on exhaustion", async () => {
    setRequestLimiter({ consume: async () => ({ allowed: false, retryAfter: 37 }) });
    const response = await enforceRequestLimit(request(), "create");
    expect(response?.status).toBe(429); expect(response?.headers.get("retry-after")).toBe("37");
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });
  it("does not let forged forwarding headers multiply the unknown-ingress budget", async () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("GRILL_TRUST_PROXY", "");
    setRequestLimiter(new MemoryRequestLimiter(tiny, () => 1000));
    expect(await enforceRequestLimit(request({ "x-forwarded-for": "203.0.113.1" }), "create")).toBeNull();
    expect(await enforceRequestLimit(request({ "x-forwarded-for": "203.0.113.2" }), "create")).toBeNull();
    expect((await enforceRequestLimit(request({ "x-forwarded-for": "203.0.113.3" }), "create"))?.status).toBe(429);
  });
  it("returns a secret-free503 when shared quotas are unavailable", async () => {
    setRequestLimiter({ consume: async () => { throw new QuotaUnavailableError("private database details"); } });
    const response = await enforceRequestLimit(request(), "read");
    expect(response?.status).toBe(503); expect(response?.headers.get("retry-after")).toBe("5");
    expect(await response?.text()).not.toContain("private");
  });
  it("cannot fall back to a local quota map in unconfigured production", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("GRILL_STORE", "memory");
    expect((await enforceRequestLimit(request(), "create"))?.status).toBe(503);
  });
});
