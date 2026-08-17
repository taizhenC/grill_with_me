import { describe, it, expect } from "vitest";
import {
  parseGrillRoom,
  grillRoomSchema,
  ROOM_SCHEMA_VERSION,
  MAX_ROOM_JSON_BYTES,
} from "@/lib/schema";

function validRoom() {
  return {
    schemaVersion: ROOM_SCHEMA_VERSION,
    project: {
      name: "Trailhead",
      idea: "A trail-finder that ranks hikes by how much shade they get.",
      mode: "hackathon",
      hoursLeft: 18,
      knownStack: "Next.js, Supabase, TypeScript",
      demoTarget: "Search a city, see three ranked trails with shade scores.",
      outOfScope: ["accounts", "payments"],
      mustWork: ["the ranking call returns in under 2s"],
    },
    roles: [
      {
        slug: "frontend",
        name: "Frontend",
        description: "Search UI and the results page.",
        owns: ["app/page.tsx", "the results list"],
        mustCover: ["what the empty state shows"],
      },
      {
        slug: "backend",
        name: "Backend",
        description: "Ranking API and data model.",
        owns: ["app/api/rank/route.ts"],
        mustCover: ["response shape"],
      },
    ],
  };
}

describe("parseGrillRoom", () => {
  it("accepts a well-formed room", () => {
    const result = parseGrillRoom(JSON.stringify(validRoom()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.project.name).toBe("Trailhead");
    expect(result.room.roles).toHaveLength(2);
  });

  it("applies defaults for omitted optional fields", () => {
    const room = validRoom();
    // @ts-expect-error - deliberately dropping optional fields
    delete room.project.outOfScope;
    // @ts-expect-error - deliberately dropping optional fields
    delete room.roles[0].owns;

    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.project.outOfScope).toEqual([]);
    expect(result.room.roles[0].owns).toEqual([]);
  });

  it("rejects invalid JSON with a readable error, without throwing", () => {
    const result = parseGrillRoom("{ not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("not valid JSON");
  });

  it("rejects a schema version it does not understand", () => {
    const room = { ...validRoom(), schemaVersion: 99 };
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
  });

  it("rejects a room with no roles", () => {
    const room = { ...validRoom(), roles: [] };
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join()).toContain("roles");
  });

  it("rejects duplicate role slugs", () => {
    const room = validRoom();
    room.roles[1].slug = "frontend";
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join()).toContain("duplicate role slug");
  });

  it("rejects a non-kebab-case slug", () => {
    const room = validRoom();
    room.roles[0].slug = "UI/UX";
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join()).toContain("kebab-case");
  });

  it("rejects an unknown mode", () => {
    const room = validRoom();
    room.project.mode = "weekend"; // not a valid mode
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
  });

  it("reports the path of the offending field", () => {
    const room = validRoom();
    room.roles[1].name = "";
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join()).toContain("roles[1].name");
  });

  it("rejects payloads over the size cap before parsing", () => {
    const oversized = "x".repeat(MAX_ROOM_JSON_BYTES + 1);
    const result = parseGrillRoom(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("limit is");
  });

  it("collects every error rather than stopping at the first", () => {
    const room = validRoom();
    room.roles[0].slug = "Bad Slug";
    room.roles[1].name = "";
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("allows hoursLeft to be null for non-deadline projects", () => {
    const room = validRoom();
    room.project.mode = "side_project";
    room.project.hoursLeft = null as unknown as number;
    const result = parseGrillRoom(JSON.stringify(room));
    expect(result.ok).toBe(true);
  });

  it("exposes a schema usable directly for host-side validation", () => {
    expect(grillRoomSchema.safeParse(validRoom()).success).toBe(true);
  });
});
