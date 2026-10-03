import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { MemoryStore, SupabaseStore, setStore, NotFoundError, ForbiddenError } from "@/lib/store";
import { MemoryRequestLimiter, setRequestLimiter, resetRateLimit, REQUEST_LIMITS } from "@/lib/rate-limit";
import { maintenanceAuth, purgeExpiredData, PURGE_MAX_BATCHES } from "@/lib/maintenance";
import { GET as purge, POST as manualPurge } from "@/app/api/maintenance/purge/route";
import { DELETE as deleteRoom } from "@/app/api/room/[key]/route";
import type { GrillRoom } from "@/lib/schema";

const secret = "fixture-only-maintenance-secret-123456";
const room: GrillRoom = {
  schemaVersion: 1,
  project: { name: "Retention", idea: "Delete stored data.", mode: "production", hoursLeft: null, knownStack: "", demoTarget: "", mustWork: [], outOfScope: [] },
  roles: [{ slug: "frontend", name: "Frontend", description: "UI", owns: [], mustCover: [] }],
};
const request = (token = secret, method = "GET") => new Request("https://example.test/api/maintenance/purge", { method, headers: { authorization: `Bearer ${token}` } });
const params = (key: string) => ({ params: Promise.resolve({ key }) });
const deletion = (key: string, token?: string) => deleteRoom(new Request(`https://example.test/api/room/${key}`, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} }), params(key));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("GRILL_STORE", "memory"); vi.stubEnv("CRON_SECRET", secret);
  setStore(new MemoryStore()); resetRateLimit();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); setStore(null); setRequestLimiter(null); });

describe("room deletion", () => {
  it("physically removes claims/content and rejects later mutations", async () => {
    const store = new MemoryStore(); const { key, hostToken } = await store.create(room);
    await store.claim(key, "frontend", "Alice");
    await expect(store.delete(key, "wrong")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await store.get(key))!.claims).toEqual({ frontend: "Alice" });
    await store.delete(key, hostToken);
    expect(await store.get(key)).toBeNull();
    await expect(store.delete(key, hostToken)).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.claim(key, "frontend", "Alice")).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.republish(key, hostToken, room)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("permits the host to delete after expiry and distinguishes expiry from bounded physical removal", async () => {
    let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
    const store = new MemoryStore();
    const first = await store.create(room), second = await store.create(room), third = await store.create(room);
    now += 31 * 86400000;
    expect(await store.get(first.key)).toBeNull();
    await store.delete(first.key, first.hostToken);
    expect(store.purgeExpired(1)).toBe(1);
    expect(store.purgeExpired(1)).toBe(1);
    expect(store.purgeExpired(1)).toBe(0);
    await expect(store.delete(second.key, second.hostToken)).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.delete(third.key, third.hostToken)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps the atomic RPC result/errors without a pre-read or false acknowledgement", async () => {
    const calls: unknown[] = []; let body: unknown = true, status = 200;
    const db = createClient("https://fixture.supabase.co", "test-only-service-key", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
      const req = new Request(input, init); calls.push({ path: new URL(req.url).pathname, body: await req.json() });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    } } });
    const store = new SupabaseStore(db); await store.delete("key", "token");
    expect(calls).toEqual([{ path: "/rest/v1/rpc/delete_room", body: { p_key: "key", p_host_token: "token" } }]);
    body = false; await expect(store.delete("key", "token")).rejects.toThrow("unavailable");
    body = { code: "PT403" }; status = 403; await expect(store.delete("key", "token")).rejects.toBeInstanceOf(ForbiddenError);
    body = { code: "PT404" }; status = 404; await expect(store.delete("key", "token")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("enforces missing/wrong host authorization, malformed keys and shared mutation quotas", async () => {
    const store = new MemoryStore(); setStore(store); const { key, hostToken } = await store.create(room);
    expect((await deletion(key)).status).toBe(401);
    expect((await deletion(key, "wrong")).status).toBe(403);
    expect((await deletion("invalid", hostToken)).status).toBe(404);
    expect((await deletion(key, hostToken)).status).toBe(200);
    expect((await deletion(key, hostToken)).status).toBe(404);
    resetRateLimit();
    for (let i = 0; i < REQUEST_LIMITS.republish.client; i++) await deletion(key, "wrong");
    const limited = await deletion(key, "wrong"); expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("protected retention maintenance", () => {
  it("fails closed with missing/weak credentials and rejects incorrect credentials before backend access", async () => {
    vi.stubEnv("CRON_SECRET", ""); expect(maintenanceAuth(request())).toBe("unconfigured");
    expect((await purge(request())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "short"); expect((await purge(request())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", secret);
    setStore(null); vi.stubEnv("GRILL_STORE", "supabase"); vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    expect((await purge(request("wrong"))).status).toBe(401);
    expect((await purge(request())).status).toBe(503);
  });

  it("cleans idle memory hashes and expired rooms through GET/POST; repeated runs are harmless", async () => {
    let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
    const store = new MemoryStore(); setStore(store); await store.create(room);
    const limiter = new MemoryRequestLimiter(REQUEST_LIMITS, () => now); setRequestLimiter(limiter);
    await limiter.consume("read", "private-identity");
    now += 31 * 86400000;
    await store.create(room); // This room remains accessible.
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await purge(request()); expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({ roomsDeleted: 1, quotaBucketsDeleted: 1, batches: 1, needsAnotherRun: false });
    expect(await (await manualPurge(request(secret, "POST"))).json()).toEqual({ roomsDeleted: 0, quotaBucketsDeleted: 0, batches: 1, needsAnotherRun: false });
  });

  it("caps a backlog at 20 validated atomic RPC batches and reports further work", async () => {
    vi.stubEnv("GRILL_STORE", "supabase"); vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_KEY", "private-test-key");
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init); expect(new URL(req.url).pathname).toBe("/rest/v1/rpc/purge_expired_data");
      expect(await req.json()).toEqual({ p_room_limit: 1000, p_quota_limit: 2000 });
      return new Response(JSON.stringify({ roomsDeleted: 1000, quotaBucketsDeleted: 2000 }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetch);
    expect(await purgeExpiredData()).toEqual({ roomsDeleted: 20000, quotaBucketsDeleted: 40000, batches: 20, needsAnotherRun: true });
    expect(fetch).toHaveBeenCalledTimes(PURGE_MAX_BATCHES);
  });

  it("stops starting transactions when the overall deadline is reached", async () => {
    vi.stubEnv("GRILL_STORE", "supabase"); vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_KEY", "private-test-key");
    let ticks = 0;
    vi.spyOn(performance, "now").mockImplementation(() => ticks++ < 2 ? 0 : 20_001);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ roomsDeleted: 1000, quotaBucketsDeleted: 2000 }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await purgeExpiredData()).toEqual({ roomsDeleted: 1000, quotaBucketsDeleted: 2000, batches: 1, needsAnotherRun: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not expose backend details or secrets when an RPC fails or returns invalid counts", async () => {
    vi.stubEnv("GRILL_STORE", "supabase"); vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_KEY", "private-test-key");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ roomsDeleted: -1, quotaBucketsDeleted: "secret-database-detail" }), { headers: { "content-type": "application/json" } }));
    const response = await purge(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-database-detail|private-test-key|fixture-only/);
    expect(console.error).toHaveBeenCalledWith("retention purge failed; reconcile and retry");
  });
});
