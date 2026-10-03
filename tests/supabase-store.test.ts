import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SupabaseStore, NotFoundError, ForbiddenError } from "@/lib/store";
import type { GrillRoom } from "@/lib/schema";
import { publicationRequest } from "@/lib/publication";
import { mintPublicationCapability, PublicationError } from "@/cli/publication-capability.mjs";

const room: GrillRoom = {
  schemaVersion: 1,
  project: { name: "Trailhead", idea: "Rank hikes.", mode: "hackathon", hoursLeft: 18, knownStack: "", demoTarget: "", outOfScope: [], mustWork: [] },
  roles: [{ slug: "frontend", name: "Frontend", description: "UI.", owns: [], mustCover: [] }],
};

/** Exercises the real client's RPC transport; database concurrency is a separate check. */
function fixture(body: unknown, status = 200) {
  const requests: { url: string; body: unknown; method: string }[] = [];
  const db = createClient("https://test.supabase.co", "private-service-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push({ url: request.url, body: await request.json(), method: request.method });
        return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      },
    },
  });
  return { store: new SupabaseStore(db), requests };
}

describe("Supabase mutation transport", () => {
  it("recovers the committed publication through its service-only RPC without sending the raw capability", async () => {
    const capability = mintPublicationCapability();
    const publication = publicationRequest(new Request("https://grill.test/api/rooms", { headers: { "idempotency-key": capability } }), room)!;
    const committed = { key: "original-key", hostToken: "original-token", recovery: { expiresAt: publication.expiresAt, replayed: true } };
    const { store, requests } = fixture(committed);
    expect(await store.create(room, publication)).toEqual(committed);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toMatch(/\/rpc\/create_room_recoverable$/);
    expect(requests[0].body).toMatchObject({ p_capability_hash: publication.hash, p_payload_hash: publication.payloadHash, p_origin: "https://grill.test", p_issued_at: publication.issuedAt, p_room: room });
    expect(JSON.stringify(requests)).not.toContain(capability);
  });
  it.each([["PT400", 400], ["PT409", 409], ["PT410", 410]])("maps recovery error %s without echoing backend details", async (code, status) => {
    const publication = publicationRequest(new Request("https://grill.test/api/rooms", { headers: { "idempotency-key": mintPublicationCapability() } }), room)!;
    const error = await fixture({ code, message: "private backend detail" }, Number(status)).store.create(room, publication).catch((value) => value);
    expect(error).toBeInstanceOf(PublicationError);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain("private backend detail");
  });
  it("returns the database's committed version using one RPC and no pre-read", async () => {
    const { store, requests } = fixture(17);
    expect(await store.republish("key", "token", room)).toBe(17);
    expect(requests).toEqual([{
      url: "https://test.supabase.co/rest/v1/rpc/republish_room",
      method: "POST",
      body: { p_key: "key", p_host_token: "token", p_room: room },
    }]);
  });

  it("makes an atomic claim without reading or replacing the entire claims object", async () => {
    const { store, requests } = fixture(null);
    await store.claim("key", "frontend", "Alice");
    expect(requests).toEqual([{
      url: "https://test.supabase.co/rest/v1/rpc/claim_room",
      method: "POST",
      body: { p_key: "key", p_role_slug: "frontend", p_display_name: "Alice" },
    }]);
  });

  it.each([null, "2", 0, 1, 2.5, {}])("rejects a missing or invalid committed version %j", async (data) => {
    await expect(fixture(data).store.republish("key", "token", room)).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "republish" });
  });

  it("maps missing or expired rows/roles and invalid tokens to domain errors", async () => {
    const missing = fixture({ code: "PT404", message: "room not found" }, 404).store;
    await expect(missing.republish("key", "token", room)).rejects.toBeInstanceOf(NotFoundError);
    await expect(missing.claim("key", "frontend", "Alice")).rejects.toBeInstanceOf(NotFoundError);
    await expect(fixture({ code: "PT403", message: "bad host token" }, 403).store.republish("key", "token", room)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not acknowledge a failed database mutation", async () => {
    const failed = fixture({ code: "XX000", message: "database unavailable" }, 500).store;
    await expect(failed.republish("key", "token", room)).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "republish" });
    await expect(failed.claim("key", "frontend", "Alice")).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "claim" });
  });
});
