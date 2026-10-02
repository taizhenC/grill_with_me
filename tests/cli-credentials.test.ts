import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "..", "cli/grill.mjs");
const CONFIG = ".grill-with-me.json";
const KEY = "pearl-summit-88";
const TOKEN = "fixture-host-token";
const EXPLICIT_TOKEN = "fixture-explicit-token";
let primary: Server;
let foreign: Server;
let base: string;
let otherBase: string;
let calls: { path: string; expectedToken: boolean }[];
let foreignCalls: number;
let foreignExplicitToken: boolean;
let redirectTo: string | null;
let echoAuthError: boolean;

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => {
  primary = createServer(async (req, res) => {
    for await (const _chunk of req) { /* consume the request */ }
    const path = req.url ?? "/";
    calls.push({ path, expectedToken: req.headers.authorization === `Bearer ${TOKEN}` });
    if (redirectTo) {
      res.writeHead(307, { location: redirectTo });
      return res.end();
    }
    if (echoAuthError) {
      res.writeHead(403, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: req.headers.authorization }));
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(path === "/api/rooms"
      ? { key: KEY, hostToken: TOKEN, url: `/r/${KEY}` }
      : { key: KEY, version: 2 }));
  });
  foreign = createServer(async (req, res) => {
    for await (const _chunk of req) { /* consume the request */ }
    foreignCalls++;
    foreignExplicitToken = req.headers.authorization === `Bearer ${EXPLICIT_TOKEN}`;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ version: 2 }));
  });
  base = await listen(primary);
  otherBase = await listen(foreign);
});

afterAll(async () => {
  await Promise.all([primary, foreign].map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))));
});

beforeEach(() => {
  calls = [];
  foreignCalls = 0;
  foreignExplicitToken = false;
  redirectTo = null;
  echoAuthError = false;
});

async function checkout(saved = true) {
  const dir = await mkdtemp(join(tmpdir(), "grill-credentials-"));
  await writeFile(join(dir, "grill-room.json"), "{}\n");
  if (saved) {
    await writeFile(join(dir, CONFIG), JSON.stringify({ base, roomKey: KEY, hostToken: TOKEN }));
  }
  return dir;
}

async function run(args: string[], cwd: string, extraEnv: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv, NODE_ENV: process.env.NODE_ENV, NO_COLOR: "1" };
  if (!("GRILL_WITH_ME_TOKEN" in extraEnv)) delete env.GRILL_WITH_ME_TOKEN;
  if (!("GRILL_WITH_ME_URL" in extraEnv)) delete env.GRILL_WITH_ME_URL;
  try {
    const result = await exec(process.execPath, [CLI, ...args], { cwd, env });
    return { code: 0, ...result };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

describe("host credential destinations", () => {
  it("never sends a saved token when --base changes origin", async () => {
    const dir = await checkout();
    const before = await readFile(join(dir, CONFIG), "utf8");
    const result = await run(["republish", "--base", otherBase], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("saved host token");
    expect(foreignCalls).toBe(0);
    expect(calls).toEqual([]);
    expect(await readFile(join(dir, CONFIG), "utf8")).toBe(before);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it("never sends a saved token to a different room on the same origin", async () => {
    const result = await run(["republish", "--key", "other-room-22"], await checkout());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("saved host token");
    expect(calls).toEqual([]);
  });

  it("uses the origin in a room URL and refuses to reuse another origin's token", async () => {
    const result = await run(["republish", "--key", `${otherBase}/r/${KEY}`], await checkout());
    expect(result.code).toBe(1);
    expect(foreignCalls).toBe(0);
    expect(calls).toEqual([]);
  });

  it("reuses a saved token for equivalent normalized origins and the same room", async () => {
    const dir = await checkout();
    await writeFile(join(dir, CONFIG), JSON.stringify({ base: base.replace("http:", "HTTP:") + "/", roomKey: KEY, hostToken: TOKEN }));
    const result = await run(["republish", "--base", `${base}/`, "--key", `${base}/r/${KEY}`], dir);
    expect(result.code).toBe(0);
    expect(calls).toEqual([{ path: `/api/room/${KEY}/republish`, expectedToken: true }]);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it.each(["flag", "environment"])("allows an explicit %s token for another requested destination", async (source) => {
    const args = ["republish", "--base", otherBase, "--key", "other-room-22"];
    if (source === "flag") args.push("--token", EXPLICIT_TOKEN);
    const result = await run(args, await checkout(), source === "environment" ? { GRILL_WITH_ME_TOKEN: EXPLICIT_TOKEN } : {});
    expect(result.code).toBe(0);
    expect(foreignCalls).toBe(1);
    expect(foreignExplicitToken).toBe(true);
    expect(calls).toEqual([]);
    expect((result.stdout + result.stderr).includes(EXPLICIT_TOKEN)).toBe(false);
  });

  it.each([
    "http://example.invalid", "ftp://example.invalid", "http://127.0.0.1.example.invalid",
    "https://user:password@example.invalid", "https://example.invalid/api", "https://example.invalid/?secret=x",
    "https://example.invalid/#fragment",
  ])("rejects an unsafe credential destination %s before sending a request", async (destination) => {
    const result = await run(["republish", "--base", destination, "--token", EXPLICIT_TOKEN], await checkout());
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/origin|HTTPS/);
    expect(calls).toEqual([]);
    expect((result.stdout + result.stderr).includes(EXPLICIT_TOKEN)).toBe(false);
  });

  it("rejects an unbound saved credential", async () => {
    const dir = await checkout();
    await writeFile(join(dir, CONFIG), JSON.stringify({ roomKey: KEY, hostToken: TOKEN }));
    const result = await run(["republish", "--base", base], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("origin binding");
    expect(calls).toEqual([]);
  });

  it.each(["../other", "room?query", "room%2fother"])("rejects a room path escape %s", async (key) => {
    const result = await run(["republish", "--key", key, "--token", EXPLICIT_TOKEN], await checkout());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("room key");
    expect(calls).toEqual([]);
  });

  it.each(["same origin", "other origin"])("does not forward credentials through a %s redirect", async (destination) => {
    redirectTo = `${destination === "same origin" ? base : otherBase}/api/room/other-room-22/republish`;
    const result = await run(["republish"], await checkout());
    expect(result.code).toBe(1);
    expect(calls).toHaveLength(1);
    expect(foreignCalls).toBe(0);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it("redacts a host token echoed by a failing server", async () => {
    echoAuthError = true;
    const result = await run(["republish"], await checkout());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("[redacted]");
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });
});
