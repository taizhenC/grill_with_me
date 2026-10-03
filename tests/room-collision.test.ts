import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { MemoryStore, ROOM_CREATION_ATTEMPTS, SupabaseStore } from "@/lib/store";
import * as keys from "@/lib/keys";
import { parseGrillRoom } from "@/lib/schema";

const collisionKey = "r_00000000000000000000000000000000";
const freshKey = "r_11111111111111111111111111111111";

function room(name: string) {
  const result = parseGrillRoom(JSON.stringify({
    schemaVersion: 1,
    project: { name, idea: "Test room creation.", mode: "side_project" },
    roles: [{ slug: "backend", name: "Backend", description: "API." }],
  }));
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.room;
}

afterEach(() => vi.restoreAllMocks());

describe("MemoryStore collision handling", () => {
  it("retries without overwriting a room, its token, content, or claims", async () => {
    const generate = vi.spyOn(keys, "generateRoomKey").mockReturnValueOnce(collisionKey)
      .mockReturnValueOnce(collisionKey).mockReturnValueOnce(freshKey);
    const store = new MemoryStore();
    const original = await store.create(room("Original"));
    await store.claim(original.key, "backend", "Alice");
    const before = await store.get(original.key);
    const replacement = await store.create(room("New"));
    expect(replacement.key).toBe(freshKey);
    expect(await store.get(original.key)).toEqual(before);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("fails after a finite bound and preserves the original room", async () => {
    const generate = vi.spyOn(keys, "generateRoomKey").mockReturnValue(collisionKey);
    const store = new MemoryStore();
    await store.create(room("Original"));
    const before = await store.get(collisionKey);
    generate.mockClear();
    await expect(store.create(room("New"))).rejects.toThrow("unique key retries exhausted");
    expect(generate).toHaveBeenCalledTimes(ROOM_CREATION_ATTEMPTS);
    expect(await store.get(collisionKey)).toEqual(before);
  });

  it("does not reuse a still-stored expired room's key", async () => {
    vi.spyOn(keys, "generateRoomKey").mockReturnValueOnce(collisionKey)
      .mockReturnValueOnce(collisionKey).mockReturnValueOnce(freshKey);
    const store = new MemoryStore();
    await store.create(room("Expired"));
    // @ts-expect-error - test expires private in-memory row
    store.rooms.get(collisionKey).expiresAt = new Date(Date.now() - 1_000).toISOString();
    expect((await store.create(room("New"))).key).toBe(freshKey);
    expect(await store.get(collisionKey)).toBeNull();
  });
});

const collision = {
  code: "23505", message: 'duplicate key value violates unique constraint "rooms_key_key"',
  details: "Key already exists", hint: "",
};

// Exercise the real Supabase/PostgREST request builder against deterministic
// HTTP responses; no database credentials or loose casts of a fluent API.
function database(responses: Array<typeof collision | null>) {
  const attempts: Array<Record<string, unknown>> = [];
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    attempts.push(JSON.parse(String(init?.body)));
    const error = responses[Math.min(attempts.length - 1, responses.length - 1)];
    return new Response(error ? JSON.stringify(error) : null, {
      status: error ? 409 : 201,
      headers: { "content-type": "application/json" },
    });
  });
  const db = createClient("https://database.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  return { store: new SupabaseStore(db), attempts, fetch };
}

describe("SupabaseStore collision handling", () => {
  it("retries the rooms key constraint with a fresh key and reports only the committed one", async () => {
    vi.spyOn(keys, "generateRoomKey").mockReturnValueOnce(collisionKey).mockReturnValueOnce(freshKey);
    const { store, attempts } = database([collision, null]);
    const result = await store.create(room("New"));
    expect(result.key).toBe(freshKey);
    expect(attempts.map((row) => row.key)).toEqual([collisionKey, freshKey]);
    expect(attempts[1].host_token).toBe(result.hostToken);
    expect(attempts.every((row) => row.version === 1)).toBe(true);
  });

  it("bounds repeated key collisions", async () => {
    vi.spyOn(keys, "generateRoomKey").mockReturnValue(collisionKey);
    const { store, attempts } = database([collision]);
    await expect(store.create(room("New"))).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "create" });
    expect(attempts).toHaveLength(ROOM_CREATION_ATTEMPTS);
  });

  it.each([
    { ...collision, message: 'duplicate key value violates unique constraint "rooms_pkey"' },
    { ...collision, message: 'duplicate key value violates unique constraint "some_other_key"' },
    { ...collision, message: "unknown uniqueness failure" },
    { ...collision, code: "42501" },
    { ...collision, code: "08006", message: "database unavailable" },
  ])("does not retry another constraint or database error: $code $message", async (error) => {
    const { store, attempts } = database([error, null]);
    await expect(store.create(room("New"))).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "create" });
    expect(attempts).toHaveLength(1);
  });
});
