import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";
import { MAX_ROOM_JSON_BYTES, ROOM_SCHEMA_VERSION, type GrillRoom } from "@/lib/schema";
import { MAX_CLAIM_JSON_BYTES } from "@/lib/request-body";
import { POST as create } from "@/app/api/rooms/route";
import { POST as claim } from "@/app/api/room/[key]/claim/route";
import { POST as republish } from "@/app/api/room/[key]/republish/route";

const room: GrillRoom = {
  schemaVersion: ROOM_SCHEMA_VERSION,
  project: { name: "Body bounds", idea: "Bound every mutation.", mode: "hackathon" as const,
    hoursLeft: 12, knownStack: "TypeScript", demoTarget: "", outOfScope: [], mustWork: [] },
  roles: [{ slug: "backend", name: "Backend", description: "API", owns: [], mustCover: [] }],
};
let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
  setStore(store);
  resetRateLimit();
});

function chunked(
  path: string, text: string, headers: Record<string, string> = {},
): Request {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 1024) {
        controller.enqueue(bytes.slice(offset, offset + 1024));
      }
      controller.close();
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", body, headers, duplex: "half",
  };
  return new Request(`http://test${path}`, init);
}
const params = (key: string) => ({ params: Promise.resolve({ key }) });
const oversizedRoom = JSON.stringify(room) + " ".repeat(MAX_ROOM_JSON_BYTES);
const creationHeaders: Record<string, string>[] = [{}, { "content-length": "10" }];

describe("mutation endpoint body limits", () => {
  it("rejects creation with a missing or false content-length", async () => {
    for (const headers of creationHeaders) {
      const response = await create(chunked("/api/rooms", oversizedRoom, headers));
      expect(response.status).toBe(413);
      expect((await response.json()).errors[0]).toContain("bytes");
    }
  });

  it("rejects oversized republish without acknowledging or changing content", async () => {
    const { key, hostToken } = await store.create(room);
    const response = await republish(
      chunked(`/api/room/${key}/republish`, oversizedRoom,
        { authorization: `Bearer ${hostToken}`, "content-length": "10" }),
      params(key),
    );
    expect(response.status).toBe(413);
    const stored = await store.get(key);
    expect(stored?.version).toBe(1);
    expect(stored?.room.project.name).toBe(room.project.name);
  });

  it("bounds claim JSON independently and preserves existing claims", async () => {
    const { key } = await store.create(room);
    await store.claim(key, "backend", "Original");
    const raw = JSON.stringify({ role: "backend", displayName: "Replacement" })
      + " ".repeat(MAX_CLAIM_JSON_BYTES);
    const response = await claim(chunked(`/api/room/${key}/claim`, raw), params(key));
    expect(response.status).toBe(413);
    expect((await store.get(key))?.claims.backend).toBe("Original");
  });

  it("accepts valid chunked creation, claim, and republish bodies", async () => {
    const created = await create(chunked("/api/rooms", JSON.stringify(room)));
    expect(created.status).toBe(201);
    const { key, hostToken } = await created.json();
    const claimed = await claim(chunked(`/api/room/${key}/claim`,
      JSON.stringify({ role: "backend", displayName: "Mira 🌲" })), params(key));
    expect(claimed.status).toBe(200);
    const replacement = { ...room, project: { ...room.project, name: "Revised 🌲" } };
    const updated = await republish(chunked(`/api/room/${key}/republish`,
      JSON.stringify(replacement), { authorization: `Bearer ${hostToken}` }), params(key));
    expect(updated.status).toBe(200);
    expect((await updated.json()).version).toBe(2);
    expect((await store.get(key))?.claims.backend).toBe("Mira 🌲");
  });

  it("keeps malformed small JSON as a validation error", async () => {
    const { key } = await store.create(room);
    const response = await claim(chunked(`/api/room/${key}/claim`, "{"), params(key));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("body must be JSON");
  });
});
