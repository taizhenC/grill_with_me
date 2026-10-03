import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { chmod, link, mkdir, mkdtemp, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { readPublicationCapability } from "@/cli/publication-capability.mjs";

const exec = promisify(execFile);
const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "..", "cli/grill.mjs");
const CONFIG = ".grill-with-me.json";
const KEY = "r_0123456789abcdef0123456789abcdef";
const TOKEN = "t".repeat(32);
const EXPLICIT_TOKEN = "fixture-explicit-token";
let primary: Server;
let foreign: Server;
let base: string;
let otherBase: string;
let calls: { path: string; expectedToken: boolean; method?: string }[];
let foreignCalls: number;
let foreignExplicitToken: boolean;
let redirectTo: string | null;
let echoAuthError: boolean;
let beforePublish: (() => Promise<void>) | null;

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
    calls.push({ path, expectedToken: req.headers.authorization === `Bearer ${TOKEN}`, ...(req.method === "DELETE" ? { method: "DELETE" } : {}) });
    if (path === "/api/rooms" && beforePublish) await beforePublish();
    if (redirectTo) {
      res.writeHead(307, { location: redirectTo });
      return res.end();
    }
    if (echoAuthError) {
      res.writeHead(403, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: req.headers.authorization }));
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.method === "DELETE" ? { ok: true } : path === "/api/rooms"
      ? { key: KEY, hostToken: TOKEN, url: `/r/${KEY}`, recovery: { expiresAt: new Date(readPublicationCapability(req.headers["idempotency-key"]).expiresAt).toISOString(), replayed: false } }
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
  beforePublish = null;
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
  it("deletes only an explicit room with scoped saved credentials and preserves local files", async () => {
    const dir = await checkout();
    const before = await readFile(join(dir, CONFIG), "utf8");
    const result = await run(["delete", `${base}/r/${KEY}`], dir);
    expect(result.code).toBe(0);
    expect(calls).toEqual([{ path: `/api/room/${KEY}`, expectedToken: true, method: "DELETE" }]);
    expect(await readFile(join(dir, CONFIG), "utf8")).toBe(before);
    expect(await readFile(join(dir, "grill-room.json"), "utf8")).toBe("{}\n");
    expect(result.stdout).toContain("Local packs, specs and saved credentials remain");
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
  });

  it("does not infer a destructive destination from saved state", async () => {
    const result = await run(["delete"], await checkout());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("explicit room key");
    expect(calls).toEqual([]);
  });

  it("supports explicit --key and rejects ambiguous deletion targets", async () => {
    const dir = await checkout();
    expect((await run(["delete", "--key", KEY], dir)).code).toBe(0);
    expect(calls).toHaveLength(1);
    expect((await run(["delete", KEY, "--key", KEY], dir)).code).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("refuses saved deletion credentials for another room or origin before contacting either server", async () => {
    const dir = await checkout();
    expect((await run(["delete", KEY, "--base", otherBase], dir)).code).toBe(1);
    expect((await run(["delete", "other-room-22"], dir)).code).toBe(1);
    expect(calls).toEqual([]);
    expect(foreignCalls).toBe(0);
  });

  it("does not forward deletion credentials through redirects or echo them in errors", async () => {
    const dir = await checkout();
    redirectTo = `${otherBase}/api/room/${KEY}`;
    const redirected = await run(["delete", KEY], dir);
    expect(redirected.code).toBe(1);
    expect(foreignCalls).toBe(0);
    redirectTo = null;
    echoAuthError = true;
    const denied = await run(["delete", KEY], dir);
    expect(denied.code).toBe(1);
    expect(denied.stdout + denied.stderr + redirected.stderr).not.toContain(TOKEN);
  });

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

describe("host credential storage", () => {
  it("creates Git ignore protection before publishing into a fresh checkout", async () => {
    const dir = await checkout(false);
    await exec("git", ["init", "--quiet"], { cwd: dir });
    let ignoredBeforePublish = false;
    beforePublish = async () => {
      try {
        await exec("git", ["check-ignore", "--quiet", CONFIG], { cwd: dir });
        ignoredBeforePublish = true;
      } catch { /* record failure without exposing request data */ }
    };

    const result = await run(["publish", "--base", base], dir);

    expect(result.code).toBe(0);
    expect(ignoredBeforePublish).toBe(true);
    const stored = JSON.parse(await readFile(join(dir, CONFIG), "utf8"));
    expect(stored.base).toBe(base);
    expect(stored.roomKey).toBe(KEY);
    expect(stored.hostToken === TOKEN).toBe(true);
    await expect(exec("git", ["check-ignore", "--quiet", CONFIG], { cwd: dir })).resolves.toBeDefined();
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it("protects a folder without .git before a future git init", async () => {
    const dir = await checkout(false);
    const result = await run(["publish", "--base", `${base}/`], dir);
    expect(result.code).toBe(0);
    await exec("git", ["init", "--quiet"], { cwd: dir });
    await expect(exec("git", ["check-ignore", "--quiet", CONFIG], { cwd: dir })).resolves.toBeDefined();
    expect((await readdir(dir)).includes(`${CONFIG}.tmp`)).toBe(false);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it("keeps existing ignore rules and overrides a later credential negation", async () => {
    const dir = await checkout(false);
    await exec("git", ["init", "--quiet"], { cwd: dir });
    await writeFile(join(dir, ".gitignore"), `node_modules/\n${CONFIG}\n!${CONFIG}`);
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(0);
    expect((await readFile(join(dir, ".gitignore"), "utf8")).startsWith("node_modules/\n")).toBe(true);
    await expect(exec("git", ["check-ignore", "--quiet", CONFIG], { cwd: dir })).resolves.toBeDefined();
    await expect(exec("git", ["check-ignore", "--quiet", `${CONFIG}.tmp`], { cwd: dir })).resolves.toBeDefined();
  });

  it.each(["publish", "republish"])("rejects a tracked config before %s sends anything", async (command) => {
    const dir = await checkout();
    await exec("git", ["init", "--quiet"], { cwd: dir });
    await exec("git", ["add", "--", CONFIG], { cwd: dir });
    const before = await readFile(join(dir, CONFIG), "utf8");
    const result = await run([command, "--base", base], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("already tracked");
    expect(calls).toEqual([]);
    expect(await readFile(join(dir, CONFIG), "utf8") === before).toBe(true);
    expect((await readdir(dir)).includes(".gitignore")).toBe(false);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it.each([CONFIG, ".gitignore"])("rejects a hard-linked %s without changing the outside file", async (path) => {
    const dir = await checkout(false);
    const outside = await checkout(false);
    await writeFile(join(outside, "sentinel"), "outside sentinel\n");
    await link(join(outside, "sentinel"), join(dir, path));
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("hard-linked");
    expect(calls).toEqual([]);
    expect(await readFile(join(outside, "sentinel"), "utf8")).toBe("outside sentinel\n");
  });

  it.each([CONFIG, ".gitignore"])("rejects a directory junction/symlink at %s", async (path) => {
    const dir = await checkout(false);
    const outside = await checkout(false);
    await symlink(outside, join(dir, path), process.platform === "win32" ? "junction" : "dir");
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/links|junctions/);
    expect(calls).toEqual([]);
    expect(await readdir(outside)).toEqual(["grill-room.json"]);
  });

  it.skipIf(process.platform === "win32").each([CONFIG, ".gitignore"])(
    "rejects a file symlink at %s",
    async (path) => {
      const dir = await checkout(false);
      const outside = await checkout(false);
      await symlink(join(outside, "grill-room.json"), join(dir, path), "file");
      const result = await run(["publish", "--base", base], dir);
      expect(result.code).toBe(1);
      expect(calls).toEqual([]);
      expect(await readFile(join(outside, "grill-room.json"), "utf8")).toBe("{}\n");
    },
  );

  it.each([CONFIG, ".gitignore"])("refuses a directory at the %s file destination", async (path) => {
    const dir = await checkout(false);
    await mkdir(join(dir, path));
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(1);
    expect(calls).toEqual([]);
    expect(await readdir(join(dir, path))).toEqual([]);
  });

  it.each([`{"hostToken":"${TOKEN}"`, `{"hostToken":42}`])("rejects malformed local config without printing its contents", async (contents) => {
    const dir = await checkout();
    await writeFile(join(dir, CONFIG), contents);
    const result = await run(["republish"], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`invalid ${CONFIG}`);
    expect(calls).toEqual([]);
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });

  it.skipIf(process.platform === "win32")("replaces an old config with owner-only permissions", async () => {
    const dir = await checkout();
    await chmod(join(dir, CONFIG), 0o666);
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(0);
    expect((await stat(join(dir, CONFIG))).mode & 0o777).toBe(0o600);
    expect((await readdir(dir)).includes(`${CONFIG}.tmp`)).toBe(false);
  });

  it.skipIf(process.platform !== "win32" && process.getuid?.() === 0)("does not publish if ignore protection cannot be written", async () => {
    const dir = await checkout(false);
    await writeFile(join(dir, ".gitignore"), "house rules\n");
    await chmod(join(dir, ".gitignore"), 0o444);
    try {
      const result = await run(["publish", "--base", base], dir);
      expect(result.code).toBe(1);
      expect(calls).toEqual([]);
      expect((await readdir(dir)).includes(CONFIG)).toBe(false);
    } finally {
      await chmod(join(dir, ".gitignore"), 0o644);
    }
  });

  it("preserves the existing config if a storage conflict appears during publish", async () => {
    const dir = await checkout();
    const before = await readFile(join(dir, CONFIG), "utf8");
    beforePublish = async () => { await writeFile(join(dir, `${CONFIG}.tmp`), "another operation\n"); };
    const result = await run(["publish", "--base", base], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("may have succeeded");
    expect(await readFile(join(dir, CONFIG), "utf8") === before).toBe(true);
    expect(await readFile(join(dir, `${CONFIG}.tmp`), "utf8")).toBe("another operation\n");
    expect((result.stdout + result.stderr).includes(TOKEN)).toBe(false);
  });
});
