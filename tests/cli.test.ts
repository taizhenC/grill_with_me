import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseGrillRoom, type GrillRoom } from "@/lib/schema";
import { renderPack, skillFiles, AGENTS_BLOCK_START } from "@/lib/pack";
import { SPEC_HEADINGS } from "@/lib/spec-format";

const execFileAsync = promisify(execFile);
const CLI = join(__dirname, "..", "cli", "grill.mjs");

/**
 * The CLI is the member's entire experience and the host's fallback, and it
 * writes into repos people care about — so it is tested the way it is used:
 * the real binary, spawned against a stub of the real API, writing into a
 * real temp directory. The stub serves packs rendered by lib/pack, so a
 * template change that breaks the CLI's merge fails here.
 */

const ROOM_JSON = JSON.stringify({
  schemaVersion: 1,
  project: {
    name: "Trailhead",
    idea: "Rank hikes by shade.",
    mode: "hackathon",
    hoursLeft: 18,
    knownStack: "TypeScript",
  },
  roles: [
    { slug: "frontend", name: "Frontend", description: "Search UI." },
    { slug: "backend", name: "Backend", description: "Ranking API." },
  ],
});

const ROOM_KEY = "pearl-summit-88";

function parsed(): GrillRoom {
  const result = parseGrillRoom(ROOM_JSON);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.room;
}

let server: Server;
let base: string;
let claims: Record<string, string>;
let published: string[];
let republished: { token: string; body: string }[];
let packVersion: number;

function summary() {
  return {
    key: ROOM_KEY,
    version: packVersion,
    project: { name: "Trailhead", mode: "hackathon" },
    roles: parsed().roles.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      claimedBy: claims[r.slug] ?? null,
    })),
  };
}

async function readBody(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "POST" && url.pathname === "/api/rooms") {
      published.push(await readBody(req));
      return send(201, {
        key: ROOM_KEY,
        hostToken: "token-abc",
        url: `/r/${ROOM_KEY}`,
      });
    }
    if (req.method === "POST" && url.pathname.endsWith("/republish")) {
      const token = (req.headers.authorization ?? "").replace("Bearer ", "");
      const body = await readBody(req);
      if (token !== "token-abc") return send(403, { error: "bad host token" });
      republished.push({ token, body });
      return send(200, { key: ROOM_KEY, version: ++packVersion });
    }
    if (req.method === "POST" && url.pathname.endsWith("/claim")) {
      const body = JSON.parse(await readBody(req));
      claims[body.role] = body.displayName;
      return send(200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/skills/host") {
      return send(200, {
        bundle: "host",
        files: skillFiles(["grill-host", "merge-contract"]),
      });
    }
    if (req.method === "GET" && url.pathname === `/api/room/${ROOM_KEY}`) {
      const role = url.searchParams.get("role");
      if (!role) return send(200, summary());
      return send(200, {
        ...summary(),
        role,
        files: renderPack(parsed(), role, ROOM_KEY, packVersion),
      });
    }
    return send(404, { error: `no room "${url.pathname.split("/").pop()}"` });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  claims = {};
  published = [];
  republished = [];
  packVersion = 1;
});

async function repo(): Promise<string> {
  return mkdtemp(join(tmpdir(), "grill-cli-"));
}

async function run(args: string[], cwd: string) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI, ...args],
      { cwd, env: { ...process.env, NO_COLOR: "1" } },
    );
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

const read = (dir: string, path: string) => readFile(join(dir, path), "utf8");

describe("join", () => {
  it("writes the pack, records the claim, and says what to do next", async () => {
    const dir = await repo();
    const { code, stdout } = await run(
      ["join", ROOM_KEY, "--role", "backend", "--name", "Alice", "--base", base],
      dir,
    );

    expect(code).toBe(0);
    expect(await read(dir, "grill/MY-ROLE.md")).toContain("# Your role: Backend");
    expect(JSON.parse(await read(dir, "grill/.room"))).toEqual({
      roomKey: ROOM_KEY,
      role: "backend",
      packVersion: 1,
    });
    expect(await read(dir, ".claude/commands/grill-my-role.md")).toContain(
      "grill/MY-ROLE.md",
    );
    expect(claims).toEqual({ backend: "Alice" });
    expect(stdout).toContain("/grill-my-role");
    expect(stdout).toContain("grill/backend-spec.md");
  });

  it("takes the room link people actually paste, and finds the app from it", async () => {
    const dir = await repo();
    const { code } = await run(
      ["join", `${base}/r/${ROOM_KEY}`, "--role", "frontend", "--no-claim"],
      dir,
    );
    expect(code).toBe(0);
    expect(await read(dir, "grill/MY-ROLE.md")).toContain("# Your role: Frontend");
  });

  it("re-joining the same room updates in place, no --force needed", async () => {
    const dir = await repo();
    await run(["join", ROOM_KEY, "--role", "backend", "--base", base], dir);

    packVersion = 2; // host republished
    const { code, stdout } = await run(["join", ROOM_KEY, "--base", base], dir);

    expect(code).toBe(0);
    // Role comes from the stamp — no picker, no flag.
    expect(stdout).toContain("Backend");
    expect(JSON.parse(await read(dir, "grill/.room")).packVersion).toBe(2);
    expect(stdout).toContain("updated");
  });

  it("keeps a repo's own AGENTS.md and only replaces its own block", async () => {
    const dir = await repo();
    const ours = "# House rules\n\nRun the linter before committing.\n";
    await writeFile(join(dir, "AGENTS.md"), ours, "utf8");

    await run(["join", ROOM_KEY, "--role", "backend", "--base", base], dir);
    const merged = await read(dir, "AGENTS.md");
    expect(merged).toContain("House rules");
    expect(merged).toContain(AGENTS_BLOCK_START);
    expect(merged).toContain("NEVER invent a field name");

    await run(["join", ROOM_KEY, "--base", base], dir);
    const again = await read(dir, "AGENTS.md");
    expect(again).toContain("House rules");
    // One block, not two appended copies.
    expect(again.split(AGENTS_BLOCK_START)).toHaveLength(2);
  });

  it("refuses to overwrite a pack from a different room without --force", async () => {
    const dir = await repo();
    await mkdir(join(dir, "grill"), { recursive: true });
    await writeFile(join(dir, "grill", "PROJECT.md"), "someone else's", "utf8");

    const blocked = await run(
      ["join", ROOM_KEY, "--role", "backend", "--base", base],
      dir,
    );
    expect(blocked.code).toBe(1);
    expect(blocked.stderr).toContain("grill/PROJECT.md");
    expect(blocked.stderr).toContain("--force");
    expect(await read(dir, "grill/PROJECT.md")).toBe("someone else's");

    const forced = await run(
      ["join", ROOM_KEY, "--role", "backend", "--base", base, "--force"],
      dir,
    );
    expect(forced.code).toBe(0);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Trailhead");
  });

  it("--dry-run reports what would change and writes nothing", async () => {
    const dir = await repo();
    const { code, stdout } = await run(
      ["join", ROOM_KEY, "--role", "backend", "--base", base, "--dry-run"],
      dir,
    );
    expect(code).toBe(0);
    expect(stdout).toContain("created");
    expect(stdout).toContain("grill/MY-ROLE.md");
    await expect(read(dir, "grill/MY-ROLE.md")).rejects.toThrow();
  });

  it("names the roles when it cannot prompt for one", async () => {
    const dir = await repo();
    const { code, stderr } = await run(["join", ROOM_KEY, "--base", base], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("frontend, backend");
  });

  it("rejects a role the room does not have", async () => {
    const dir = await repo();
    const { code, stderr } = await run(
      ["join", ROOM_KEY, "--role", "designer", "--base", base],
      dir,
    );
    expect(code).toBe(1);
    expect(stderr).toContain('no role "designer"');
  });

  it("explains an unknown room instead of dumping a status code", async () => {
    const dir = await repo();
    const { code, stderr } = await run(
      ["join", "gone-gone-11", "--role", "backend", "--base", base],
      dir,
    );
    expect(code).toBe(1);
    expect(stderr).toContain("gone-gone-11");
    expect(stderr).toContain("room key");
  });
});

describe("publish / republish", () => {
  it("publishes, saves the host token, and gitignores it", async () => {
    const dir = await repo();
    await writeFile(join(dir, ".gitignore"), "node_modules/\n", "utf8");
    await writeFile(join(dir, "grill-room.json"), ROOM_JSON, "utf8");

    const { code, stdout } = await run(["publish", "grill-room.json", "--base", base], dir);
    expect(code).toBe(0);
    expect(published).toHaveLength(1);
    expect(stdout).toContain(`${base}/r/${ROOM_KEY}`);
    expect(stdout).toContain("/host");

    const config = JSON.parse(await read(dir, ".grill-with-me.json"));
    expect(config).toMatchObject({ roomKey: ROOM_KEY, hostToken: "token-abc", base });
    expect(await read(dir, ".gitignore")).toContain(".grill-with-me.json");
  });

  it("republishes with no arguments after a CLI publish", async () => {
    const dir = await repo();
    await writeFile(join(dir, "grill-room.json"), ROOM_JSON, "utf8");
    await run(["publish", "grill-room.json", "--base", base], dir);

    const { code, stdout } = await run(["republish"], dir);
    expect(code).toBe(0);
    expect(republished).toHaveLength(1);
    expect(stdout).toContain("v2");
  });

  it("says which flag is missing rather than 401ing at the user", async () => {
    const dir = await repo();
    await writeFile(join(dir, "grill-room.json"), ROOM_JSON, "utf8");
    const { code, stderr } = await run(
      ["republish", "grill-room.json", "--key", ROOM_KEY, "--base", base],
      dir,
    );
    expect(code).toBe(1);
    expect(stderr).toContain("host token");
    expect(stderr).toContain("--token");
  });

  it("names the file when it isn't there", async () => {
    const dir = await repo();
    const { code, stderr } = await run(["publish", "--base", base], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("grill-room.json");
  });
});

describe("status", () => {
  it("shows who has claimed what", async () => {
    const dir = await repo();
    claims = { frontend: "Bo" };
    const { code, stdout } = await run(["status", ROOM_KEY, "--base", base], dir);
    expect(code).toBe(0);
    expect(stdout).toContain("Bo");
    expect(stdout).toContain("unclaimed");
    expect(stdout).toContain("1/2 claimed");
  });
});

describe("host", () => {
  it("installs the host skills without cloning this repo", async () => {
    const dir = await repo();
    const { code, stdout } = await run(["host", "--base", base], dir);
    expect(code).toBe(0);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toContain(
      "name: grill-host",
    );
    expect(await read(dir, ".claude/skills/merge-contract/SKILL.md")).toContain(
      "name: merge-contract",
    );
    expect(stdout).toContain("grill-room.json");
  });

  it("keeps an existing copy unless forced", async () => {
    const dir = await repo();
    await mkdir(join(dir, ".claude/skills/grill-host"), { recursive: true });
    await writeFile(
      join(dir, ".claude/skills/grill-host/SKILL.md"),
      "mine",
      "utf8",
    );

    await run(["host", "--base", base], dir);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toBe("mine");

    await run(["host", "--base", base, "--force"], dir);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toContain(
      "name: grill-host",
    );
  });
});

describe("check-spec", () => {
  const spec = (sections: string[]) =>
    sections.map((h) => `${h}\n\n- something concrete about it.\n`).join("\n");

  it("passes a well-formed spec and says to commit it", async () => {
    const dir = await repo();
    await mkdir(join(dir, "grill"), { recursive: true });
    await writeFile(
      join(dir, "grill", "backend-spec.md"),
      spec([...SPEC_HEADINGS]),
      "utf8",
    );
    const { code, stdout } = await run(["check-spec"], dir);
    expect(code).toBe(0);
    expect(stdout).toContain("all five sections");
    expect(stdout).toContain("Commit it");
  });

  it("names the heading a spec is missing, and exits non-zero", async () => {
    const dir = await repo();
    await mkdir(join(dir, "grill"), { recursive: true });
    await writeFile(
      join(dir, "grill", "backend-spec.md"),
      spec(SPEC_HEADINGS.filter((h) => h !== "## Still unclear")),
      "utf8",
    );
    const { code, stdout } = await run(["check-spec"], dir);
    expect(code).toBe(1);
    expect(stdout).toContain("## Still unclear");
  });

  it("warns about a thin spec without failing it", async () => {
    const dir = await repo();
    await mkdir(join(dir, "grill"), { recursive: true });
    await writeFile(
      join(dir, "grill", "backend-spec.md"),
      SPEC_HEADINGS.join("\n\n") + "\n",
      "utf8",
    );
    const { code, stdout } = await run(["check-spec"], dir);
    expect(code).toBe(0);
    expect(stdout).toContain("thin");
  });

  it("points at the grill when there is no spec yet", async () => {
    const dir = await repo();
    const { code, stderr } = await run(["check-spec"], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("grill-my-role");
  });

  /**
   * The CLI ships separately from the app, so it carries its own copy of the
   * headings. If lib/spec-format.ts moves and this doesn't, members get told
   * a spec is fine that merge-contract will reject.
   */
  it("checks the same headings merge-contract parses", () => {
    const cli = readFileSync(join(__dirname, "..", "cli", "grill.mjs"), "utf8");
    for (const heading of SPEC_HEADINGS) {
      expect(cli).toContain(`"${heading}"`);
    }
  });
});

describe("usage", () => {
  it("with no arguments, tells both audiences what to run", async () => {
    const dir = await repo();
    const { code, stdout } = await run([], dir);
    expect(code).toBe(0);
    expect(stdout).toContain("join");
    expect(stdout).toContain("publish");
  });

  it("suggests real commands for a typo", async () => {
    const dir = await repo();
    const { code, stderr } = await run(["joim", "x"], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("join");
  });
});
