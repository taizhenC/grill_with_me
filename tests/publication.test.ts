import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { POST } from "@/app/api/rooms/route";
import { getStore, MemoryStore, setStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";

const body = JSON.stringify({ schemaVersion: 1, project: { name: "Recovery", idea: "Recover a lost response.", mode: "production" }, roles: [{ slug: "builder", name: "Builder", description: "Build." }] });
const capability = (seconds = Math.floor(Date.now() / 1000)) => `v1.${seconds}.${randomBytes(32).toString("hex")}`;
const post = (key: string, payload = body, origin = "https://grill.test") => POST(new Request(`${origin}/api/rooms`, { method: "POST", headers: { "Idempotency-Key": key }, body: payload }));
beforeEach(() => { setStore(new MemoryStore()); resetRateLimit(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("recoverable publication", () => {
  it("replays a lost response with the original room and host token", async () => {
    const key = capability();
    const first = await post(key);
    expect(first.status).toBe(201);
    const created = await first.json();
    const retry = await post(key);
    expect(retry.status).toBe(200);
    const recovered = await retry.json();
    expect(recovered.key).toBe(created.key);
    expect(recovered.hostToken).toBe(created.hostToken);
    expect(recovered.recovery).toEqual({ expiresAt: created.recovery.expiresAt, replayed: true });
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(retry.headers.get("cache-control")).toBe("no-store");
  });
  it("binds the validated payload and trusted service origin without exposing credentials", async () => {
    const key = capability();
    const created = await (await post(key)).json();
    for (const response of [await post(key, body.replace("Recovery", "Changed")), await post(key, body, "https://other.test")]) {
      expect(response.status).toBe(409);
      const result = await response.text();
      expect(result).toContain("publication_conflict");
      expect(result).not.toContain(created.hostToken);
      expect(result).not.toContain(key);
    }
    const equivalent = JSON.parse(body);
    equivalent.ignoredField = "unknown fields are stripped";
    expect((await post(key, JSON.stringify({ roles: equivalent.roles, ...equivalent }, null, 2))).status).toBe(200);
    vi.stubEnv("GRILL_PUBLIC_ORIGIN", "https://grill.test");
    expect((await post(key, body, "https://proxy-internal.test")).status).toBe(200);
  });
  it("does not recreate a deleted room or recover its retired host token", async () => {
    const key = capability();
    const created = await (await post(key)).json();
    await getStore().delete(created.key, created.hostToken);
    const retry = await post(key);
    expect(retry.status).toBe(410);
    expect(await retry.json()).toMatchObject({ code: "publication_gone" });
    expect(await getStore().get(created.key)).toBeNull();
  });
  it("rejects malformed, future and expired capabilities even when never recorded", async () => {
    for (const key of ["", "guessable", capability().toUpperCase(), capability(Math.floor(Date.now() / 1000) + 301)]) {
      expect((await post(key)).status).toBe(400);
    }
    const key = capability(Math.floor(Date.now() / 1000) - 86400);
    expect((await post(key)).status).toBe(410);
  });
  it("expires retries after 24 hours while the original room remains available", async () => {
    const now = Date.now();
    const key = capability();
    const created = await (await post(key)).json();
    vi.spyOn(Date, "now").mockReturnValue(now + 86400_000);
    try {
      const response = await post(key);
      expect(response.status).toBe(410);
      expect(await getStore().get(created.key)).not.toBeNull();
    } finally { vi.restoreAllMocks(); }
  });
  it("keeps old clients nonrecoverable and gives a new capability no access to an existing token", async () => {
    const one = await (await post(capability())).json();
    const two = await (await post(capability())).json();
    expect(two.key).not.toBe(one.key);
    expect(two.hostToken).not.toBe(one.hostToken);
    const legacy = await POST(new Request("https://grill.test/api/rooms", { method: "POST", body }));
    expect(legacy.status).toBe(201);
    expect(await legacy.json()).not.toHaveProperty("recovery");
  });
});
