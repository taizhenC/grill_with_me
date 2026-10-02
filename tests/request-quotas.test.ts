import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { POST as create } from "@/app/api/rooms/route";
import { GET as read } from "@/app/api/room/[key]/route";
import { POST as claim } from "@/app/api/room/[key]/claim/route";
import { POST as republish } from "@/app/api/room/[key]/republish/route";
import { GET as skills } from "@/app/api/skills/[bundle]/route";
import { proxy, config } from "@/proxy";
import { MemoryStore, setStore } from "@/lib/store";
import { MemoryRequestLimiter, QuotaUnavailableError, setRequestLimiter } from "@/lib/rate-limit";

const key = `r_${"0".repeat(32)}`;
const params = { params: Promise.resolve({ key }) };
const request = (path: string, method = "POST") => new Request(`https://test${path}`, { method, ...(method === "POST" ? { body: "{invalid-json" } : {}) });
const endpoints = () => [
  () => create(request("/api/rooms")),
  () => read(request(`/api/room/${key}`, "GET"), params),
  () => claim(request(`/api/room/${key}/claim`), params),
  () => republish(request(`/api/room/${key}/republish`), params),
  () => skills(request("/api/skills/host", "GET"), { params: Promise.resolve({ bundle: "host" }) }),
];
let store: MemoryStore;
beforeEach(() => { store = new MemoryStore(); setStore(store); });
afterEach(() => { setRequestLimiter(null); setStore(null); });

describe("route request quotas", () => {
  it("guards every API before expensive parsing, lookup, or mutation", async () => {
    const get = vi.spyOn(store, "get"); const publish = vi.spyOn(store, "create");
    const update = vi.spyOn(store, "republish"); const writeClaim = vi.spyOn(store, "claim");
    setRequestLimiter({ consume: async () => ({ allowed: false, retryAfter: 19 }) });
    for (const endpoint of endpoints()) {
      const response = await endpoint();
      expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("19");
    }
    expect(get).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled(); expect(writeClaim).not.toHaveBeenCalled();
  });
  it("rejects every API with503 when the shared backend fails", async () => {
    setRequestLimiter({ consume: async () => { throw new QuotaUnavailableError("private endpoint and key"); } });
    for (const endpoint of endpoints()) {
      const response = await endpoint();
      expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
    }
  });
  it("counts invalid creates, missing reads, malformed claims, and unauthorized republishes", async () => {
    const policies = { create: { client: 1, global: 10, seconds: 60 }, read: { client: 1, global: 10, seconds: 60 }, claim: { client: 1, global: 10, seconds: 60 }, republish: { client: 1, global: 10, seconds: 60 } };
    setRequestLimiter(new MemoryRequestLimiter(policies));
    const cases = endpoints().slice(0, 4);
    const statuses = [400, 404, 400, 401];
    for (const [i, endpoint] of cases.entries()) {
      expect((await endpoint()).status).toBe(statuses[i]);
      expect((await endpoint()).status).toBe(429);
    }
  });
});

describe("room page proxy", () => {
  it("matches join/host pages and does not duplicate API quota charging", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: `/r/${key}` })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: `/r/${key}/host` })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: `/api/room/${key}` })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/" })).toBe(false);
  });
  it("returns a real429 before page or metadata storage access", async () => {
    setRequestLimiter({ consume: async () => ({ allowed: false, retryAfter: 22 }) });
    const response = await proxy(new NextRequest(`https://test/r/${key}`));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("22");
  });
  it("allows a page request after one quota check, and rejects backend failure", async () => {
    const consume = vi.fn(async () => ({ allowed: true, retryAfter: 0 }));
    setRequestLimiter({ consume });
    const response = await proxy(new NextRequest(`https://test/r/${key}/host`));
    expect(response.headers.get("x-middleware-next")).toBe("1"); expect(consume).toHaveBeenCalledOnce();
    setRequestLimiter({ consume: async () => { throw new QuotaUnavailableError(); } });
    expect((await proxy(new NextRequest(`https://test/r/${key}`))).status).toBe(503);
  });
});
