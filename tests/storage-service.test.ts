import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SupabaseStore, setStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";
import { parseGrillRoom } from "@/lib/schema";
import { POST as publish } from "@/app/api/rooms/route";
import { GET as read, DELETE as remove } from "@/app/api/room/[key]/route";
import { POST as claim } from "@/app/api/room/[key]/claim/route";
import { POST as republish } from "@/app/api/room/[key]/republish/route";

const key = `r_${"1".repeat(32)}`;
const secret = "PRIVATE_TOKEN_BRIEF_DATABASE_DETAIL";
const raw = JSON.stringify({ schemaVersion: 1, project: { name: "Fixture", idea: secret, mode: "side_project" },
  roles: [{ slug: "backend", name: "Backend", description: "API" }] });
const parsed = parseGrillRoom(raw);
if (!parsed.ok) throw new Error("invalid fixture");
const room = parsed.room;
const params = { params: Promise.resolve({ key }) };
const post = (path: string, body: string) => new Request(`http://localhost${path}`, {
  method: "POST", body, headers: { authorization: `Bearer ${secret}` },
});

beforeEach(() => resetRateLimit());
afterEach(() => { setStore(null); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("safe service database failures", () => {
  it("maps real-client private database details to fixed503 responses and safe operation events", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = createClient("https://database.invalid", secret, { auth: { persistSession: false }, global: {
      fetch: async () => new Response(JSON.stringify({ code: "XX000", message: secret, details: secret, hint: secret }), {
        status: 500, headers: { "content-type": "application/json" },
      }),
    } });
    setStore(new SupabaseStore(db));
    const responses = [
      await publish(post("/api/rooms", raw)),
      await read(new Request(`http://localhost/api/room/${key}`), params),
      await claim(post(`/api/room/${key}/claim`, JSON.stringify({ role: "backend", displayName: secret })), params),
      await republish(post(`/api/room/${key}/republish`, raw), params),
      await remove(new Request(`http://localhost/api/room/${key}`, { method: "DELETE", headers: { authorization: `Bearer ${secret}` } }), params),
    ];
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("5");
      expect(await response.text()).not.toContain(secret);
    }
    expect(log.mock.calls.map(([event]) => JSON.parse(event))).toEqual(
      ["create", "read", "claim", "republish", "delete"].map((operation) => ({ event: "room_storage_unavailable", operation })),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it("times out a stalled real PostgREST JSON body even if a custom fetch ignores abort", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const db = createClient("https://database.invalid", secret, { auth: { persistSession: false }, global: {
      fetch: async (_input, init) => {
        signal = init?.signal;
        return new Response(new ReadableStream(), { status: 200, headers: { "content-type": "application/json" } });
      },
    } });
    const result = new SupabaseStore(db).republish(key, secret, room);
    const rejection = expect(result).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "republish" });
    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
    expect(signal?.aborted).toBe(true);
  });

  it("returns a committed version after the provider recovers from a503 drill", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let unavailable = true;
    const db = createClient("https://database.invalid", secret, { auth: { persistSession: false }, global: {
      fetch: async () => new Response(JSON.stringify(unavailable ? { code: "XX000", message: secret } : 8), {
        status: unavailable ? 500 : 200, headers: { "content-type": "application/json" },
      }),
    } });
    setStore(new SupabaseStore(db));
    expect((await republish(post(`/api/room/${key}/republish`, raw), params)).status).toBe(503);
    unavailable = false;
    const restored = await republish(post(`/api/room/${key}/republish`, raw), params);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ key, version: 8 });
  });
});
