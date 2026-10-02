import { describe, it, expect } from "vitest";
import {
  MemoryStore,
  toPublic,
  NotFoundError,
  ForbiddenError,
} from "@/lib/store";
import { generateRoomKey, generateHostToken, ROOM_KEY_PATTERN } from "@/lib/keys";
import { parseGrillRoom, type GrillRoom } from "@/lib/schema";

function room(name = "Trailhead"): GrillRoom {
  const parsed = parseGrillRoom(
    JSON.stringify({
      schemaVersion: 1,
      project: {
        name,
        idea: "Rank hikes by shade.",
        mode: "hackathon",
        hoursLeft: 18,
      },
      roles: [
        { slug: "frontend", name: "Frontend", description: "UI." },
        { slug: "backend", name: "Backend", description: "API." },
      ],
    }),
  );
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  return parsed.room;
}

describe("keys", () => {
  it("room keys are speakable and match the documented pattern", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomKey()).toMatch(ROOM_KEY_PATTERN);
    }
  });

  it("host tokens are long and url-safe", () => {
    const token = generateHostToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("MemoryStore", () => {
  it("create → get round-trips at version 1", async () => {
    const store = new MemoryStore();
    const { key, hostToken } = await store.create(room());
    expect(key).toMatch(ROOM_KEY_PATTERN);

    const stored = await store.get(key);
    expect(stored).not.toBeNull();
    expect(stored!.version).toBe(1);
    expect(stored!.hostToken).toBe(hostToken);
    expect(stored!.room.project.name).toBe("Trailhead");
  });

  it("get on an unknown key returns null, not a throw", async () => {
    expect(await new MemoryStore().get("no-such-room-11")).toBeNull();
  });

  it("republish with the host token bumps the version and swaps content", async () => {
    const store = new MemoryStore();
    const { key, hostToken } = await store.create(room());
    const v2 = await store.republish(key, hostToken, room("Trailhead v2"));
    expect(v2).toBe(2);
    const stored = await store.get(key);
    expect(stored!.room.project.name).toBe("Trailhead v2");
  });

  it("republish with a wrong token is Forbidden — content untouched", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    await expect(
      store.republish(key, "wrong-token", room("evil")),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await store.get(key))!.room.project.name).toBe("Trailhead");
  });

  it("republish on an unknown room is NotFound", async () => {
    await expect(
      new MemoryStore().republish("nope-nope-11", "t", room()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("claim records a display name against a real role", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    await store.claim(key, "frontend", "Alice");
    expect((await store.get(key))!.claims).toEqual({ frontend: "Alice" });
  });

  it("claim on a role that does not exist is NotFound", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    await expect(store.claim(key, "designer", "Mal")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("preserves independent concurrent claims and returns distinct committed versions", async () => {
    const store = new MemoryStore();
    const { key, hostToken } = await store.create(room());
    await Promise.all([
      store.claim(key, "frontend", "Alice"),
      store.claim(key, "backend", "Bob"),
    ]);
    const versions = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      store.republish(key, hostToken, room(`revision ${i}`)),
    ));
    expect(versions).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect((await store.get(key))!.claims).toEqual({ frontend: "Alice", backend: "Bob" });
    expect((await store.get(key))!.version).toBe(9);
  });

  it("removes claims for deleted roles while retaining surviving roles", async () => {
    const store = new MemoryStore();
    const { key, hostToken } = await store.create(room());
    await store.claim(key, "frontend", "Alice");
    await store.claim(key, "backend", "Bob");
    const replacement = room();
    replacement.roles = replacement.roles.filter((role) => role.slug === "frontend");
    await store.republish(key, hostToken, replacement);
    expect((await store.get(key))!.claims).toEqual({ frontend: "Alice" });
    await expect(store.claim(key, "backend", "Bob")).rejects.toBeInstanceOf(NotFoundError);
    replacement.project.name = "caller mutation";
    expect((await store.get(key))!.room.project.name).toBe("Trailhead");
  });

  it("expired rooms read as gone", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    // Reach in and expire it.
    const stored = await store.get(key);
    expect(stored).not.toBeNull();
    // @ts-expect-error - test reaches into private state
    store.rooms.get(key)!.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(await store.get(key)).toBeNull();
    await expect(store.claim(key, "frontend", "Alice")).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.republish(key, "wrong", room())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("get returns a copy — mutating it does not corrupt the store", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    const first = await store.get(key);
    first!.room.project.name = "mutated";
    expect((await store.get(key))!.room.project.name).toBe("Trailhead");
  });
});

describe("toPublic", () => {
  it("never leaks the host token", async () => {
    const store = new MemoryStore();
    const { key } = await store.create(room());
    const pub = toPublic((await store.get(key))!);
    expect(JSON.stringify(pub)).not.toContain("hostToken");
    expect(pub.key).toBe(key);
    expect(pub.version).toBe(1);
  });
});
