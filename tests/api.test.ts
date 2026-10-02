import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ROOM_KEY_PATTERN } from "@/lib/keys";
import { MemoryStore, setStore, getStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";
import { ROOM_SCHEMA_VERSION } from "@/lib/schema";
import { POST as createRoom } from "@/app/api/rooms/route";
import { GET as getRoom } from "@/app/api/room/[key]/route";
import { POST as claimRole } from "@/app/api/room/[key]/claim/route";
import { POST as republish } from "@/app/api/room/[key]/republish/route";
import { GET as getSkills } from "@/app/api/skills/[bundle]/route";

const roomJson = (name = "Trailhead") =>
  JSON.stringify({
    schemaVersion: ROOM_SCHEMA_VERSION,
    project: {
      name,
      idea: "Rank hikes by shade.",
      mode: "hackathon",
      hoursLeft: 18,
      knownStack: "TypeScript",
    },
    roles: [
      { slug: "frontend", name: "Frontend", description: "UI." },
      { slug: "backend", name: "Backend", description: "API." },
    ],
  });

const params = (key: string) => ({ params: Promise.resolve({ key }) });

function post(url: string, body: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", body, headers });
}

async function publish(): Promise<{ key: string; hostToken: string }> {
  const res = await createRoom(
    post("http://test/api/rooms", roomJson(), { "x-forwarded-for": "1.2.3.4" }),
  );
  expect(res.status).toBe(201);
  return res.json();
}

beforeEach(() => {
  setStore(new MemoryStore());
  resetRateLimit();
});

afterEach(() => vi.unstubAllEnvs());

describe("unconfigured production storage", () => {
  it("returns HTTP 503 for room APIs rather than creating temporary state", async () => {
    setStore(null);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GRILL_STORE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    const key = `r_${"0".repeat(32)}`;
    const responses = [
      await createRoom(post("http://test/api/rooms", roomJson())),
      await getRoom(new Request(`http://test/api/room/${key}`), params(key)),
      await claimRole(post(`http://test/api/room/${key}/claim`, JSON.stringify({ role: "frontend", displayName: "Alice" })), params(key)),
      await republish(post(`http://test/api/room/${key}/republish`, roomJson(), { authorization: "Bearer private-token" }), params(key)),
    ];
    for (const response of responses) {
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(body).toContain("room storage is unavailable");
      expect(body).not.toContain("supabase.co");
      expect(body).not.toContain("private-token");
    }
  });
});

describe("POST /api/rooms", () => {
  it("publishes a valid room and returns key + host token + url", async () => {
    const { key, hostToken } = await publish();
    expect(key).toMatch(ROOM_KEY_PATTERN);
    expect(hostToken.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects malformed JSON with readable errors and creates nothing", async () => {
    const res = await createRoom(post("http://test/api/rooms", "{ nope"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0]).toContain("not valid JSON");
  });

  it("rejects schema violations with field paths", async () => {
    const bad = JSON.parse(roomJson());
    bad.roles[0].slug = "Bad Slug";
    const res = await createRoom(
      post("http://test/api/rooms", JSON.stringify(bad)),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.join()).toContain("roles[0].slug");
  });

  it("rate limits repeated creates from one address (P1-1)", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await createRoom(
        post("http://test/api/rooms", roomJson(), {
          "x-forwarded-for": "9.9.9.9",
        }),
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("GET /api/room/[key]", () => {
  it("does not query storage for malformed capabilities on read or mutation routes", async () => {
    const store = getStore();
    const get = vi.spyOn(store, "get");
    const claim = vi.spyOn(store, "claim");
    const write = vi.spyOn(store, "republish");
    const key = "not-a-room-key";
    const read = await getRoom(new Request(`http://test/api/room/${key}`), params(key));
    const claimed = await claimRole(post(`http://test/api/room/${key}/claim`, "{}"), params(key));
    const replaced = await republish(post(`http://test/api/room/${key}/republish`, roomJson()), params(key));
    expect([read.status, claimed.status, replaced.status]).toEqual([404, 404, 404]);
    expect(get).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("does not reveal data for an incorrect but well-formed capability", async () => {
    await publish();
    const key = "r_00000000000000000000000000000000";
    const res = await getRoom(new Request(`http://test/api/room/${key}?role=backend`), params(key));
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Trailhead");
  });

  it("keeps existing legacy links accessible only under their original key and expiry", async () => {
    const store = getStore() as MemoryStore;
    const { key: originalKey, hostToken } = await publish();
    const stored = (await store.get(originalKey))!;
    const key = "pearl-summit-88";
    // Seed a pre-upgrade row; new creation must never issue this format.
    // @ts-expect-error - test seeds private in-memory rows
    store.rooms.delete(originalKey);
    // @ts-expect-error - test seeds private in-memory rows
    store.rooms.set(key, { ...stored, key });
    const res = await getRoom(new Request(`http://test/api/room/${key}?role=backend`), params(key));
    expect(res.status).toBe(200);
    expect((await res.json()).key).toBe(key);
    const claimed = await claimRole(post(`http://test/api/room/${key}/claim`, JSON.stringify({ role: "backend", displayName: "Alice" })), params(key));
    expect(claimed.status).toBe(200);
    const replaced = await republish(post(`http://test/api/room/${key}/republish`, roomJson("Updated legacy room"), { authorization: `Bearer ${hostToken}` }), params(key));
    expect(replaced.status).toBe(200);
    expect((await store.get(key))!.expiresAt).toBe(stored.expiresAt);
    // @ts-expect-error - test expires private in-memory row
    store.rooms.get(key).expiresAt = new Date(Date.now() - 1_000).toISOString();
    expect((await getRoom(new Request(`http://test/api/room/${key}`), params(key))).status).toBe(404);
    expect(await store.get(originalKey)).toBeNull();
  });

  it("returns the summary without pack files or host token", async () => {
    const { key } = await publish();
    const res = await getRoom(
      new Request(`http://test/api/room/${key}`),
      params(key),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.name).toBe("Trailhead");
    expect(body.roles).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain("hostToken");
    expect(body.files).toBeUndefined();
  });

  it("?role= returns the full pack for the CLI to write", async () => {
    const { key } = await publish();
    const res = await getRoom(
      new Request(`http://test/api/room/${key}?role=backend`),
      params(key),
    );
    const body = await res.json();
    const paths = body.files.map((f: { path: string }) => f.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain("grill/MY-ROLE.md");
    expect(paths).toContain(".claude/skills/check-contract/SKILL.md");
    const myRole = body.files.find(
      (f: { path: string }) => f.path === "grill/MY-ROLE.md",
    );
    expect(myRole.content).toContain("# Your role: Backend");
  });

  it("404s an unknown room with a hint about expiry", async () => {
    const res = await getRoom(
      new Request("http://test/api/room/gone-gone-11"),
      params("gone-gone-11"),
    );
    expect(res.status).toBe(404);
  });

  it("404s an unknown role in a real room", async () => {
    const { key } = await publish();
    const res = await getRoom(
      new Request(`http://test/api/room/${key}?role=designer`),
      params(key),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/skills/[bundle]", () => {
  const bundleParams = (bundle: string) => ({
    params: Promise.resolve({ bundle }),
  });

  it("serves the host skills so a host never has to clone this repo", async () => {
    const res = await getSkills(
      new Request("http://test/api/skills/host"),
      bundleParams("host"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const paths = body.files.map((f: { path: string }) => f.path);
    expect(paths).toEqual([
      ".claude/skills/grill-host/SKILL.md",
      ".claude/skills/merge-contract/SKILL.md",
    ]);
    expect(body.files[0].content).toContain("name: grill-host");
  });

  it("404s an unknown bundle and names the real ones", async () => {
    const res = await getSkills(
      new Request("http://test/api/skills/everything"),
      bundleParams("everything"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("host");
  });
});

describe("POST /api/room/[key]/claim", () => {
  it("records the claim and the summary shows it", async () => {
    const { key } = await publish();
    const res = await claimRole(
      post(
        `http://test/api/room/${key}/claim`,
        JSON.stringify({ role: "frontend", displayName: "Alice" }),
      ),
      params(key),
    );
    expect(res.status).toBe(200);

    const summary = await (
      await getRoom(new Request(`http://test/api/room/${key}`), params(key))
    ).json();
    const frontend = summary.roles.find(
      (r: { slug: string }) => r.slug === "frontend",
    );
    expect(frontend.claimedBy).toBe("Alice");
  });

  it("400s a body without role/displayName", async () => {
    const { key } = await publish();
    const res = await claimRole(
      post(`http://test/api/room/${key}/claim`, JSON.stringify({})),
      params(key),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/room/[key]/republish", () => {
  it("bumps the version with the right token, and packs pick it up", async () => {
    const { key, hostToken } = await publish();
    const res = await republish(
      post(`http://test/api/room/${key}/republish`, roomJson("Trailhead v2"), {
        authorization: `Bearer ${hostToken}`,
      }),
      params(key),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).version).toBe(2);

    const pack = await (
      await getRoom(
        new Request(`http://test/api/room/${key}?role=frontend`),
        params(key),
      )
    ).json();
    const stamp = pack.files.find(
      (f: { path: string }) => f.path === "grill/.room",
    );
    expect(JSON.parse(stamp.content).packVersion).toBe(2);
  });

  it("401s without a bearer token, 403s with the wrong one", async () => {
    const { key } = await publish();
    const noAuth = await republish(
      post(`http://test/api/room/${key}/republish`, roomJson()),
      params(key),
    );
    expect(noAuth.status).toBe(401);

    const badAuth = await republish(
      post(`http://test/api/room/${key}/republish`, roomJson(), {
        authorization: "Bearer wrong",
      }),
      params(key),
    );
    expect(badAuth.status).toBe(403);
  });

  it("rejects an invalid replacement without touching the room", async () => {
    const { key, hostToken } = await publish();
    const res = await republish(
      post(`http://test/api/room/${key}/republish`, "{ broken", {
        authorization: `Bearer ${hostToken}`,
      }),
      params(key),
    );
    expect(res.status).toBe(400);
    const stored = await getStore().get(key);
    expect(stored!.version).toBe(1);
  });
});
