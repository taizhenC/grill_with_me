import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore, setStore, getStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";
import { ROOM_SCHEMA_VERSION } from "@/lib/schema";
import { POST as createRoom } from "@/app/api/rooms/route";
import { GET as getRoom } from "@/app/api/room/[key]/route";
import { POST as claimRole } from "@/app/api/room/[key]/claim/route";
import { POST as republish } from "@/app/api/room/[key]/republish/route";

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

describe("POST /api/rooms", () => {
  it("publishes a valid room and returns key + host token + url", async () => {
    const { key, hostToken } = await publish();
    expect(key).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
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
