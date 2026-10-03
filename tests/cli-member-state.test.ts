import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseGrillRoom } from "@/lib/schema";
import { AGENTS_BLOCK_END, AGENTS_BLOCK_START, renderPack } from "@/lib/pack";

const exec = promisify(execFile);
const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "../cli/grill.mjs");
const KEY = "pearl-summit-88";
const RECEIPT = ".grill-with-me/member.json";
const ROLE = ".grill-with-me/MY-ROLE.md";
let base: string;
let server: Server;

function room() {
  const parsed = parseGrillRoom(JSON.stringify({
    schemaVersion: 1,
    project: { name: "Shared project", idea: "Build together.", mode: "production" },
    roles: [
      { slug: "backend", name: "Backend", description: "Own the API." },
      { slug: "frontend", name: "Frontend", description: "Own the UI." },
    ],
  }));
  if (!parsed.ok) throw new Error("invalid fixture");
  return parsed.room;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const role = url.searchParams.get("role");
    const summary = { key: KEY, version: 1, project: room().project, roles: room().roles };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(role ? { ...summary, role, files: renderPack(room(), role, KEY, 1) } : summary));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

const identity = {
  GIT_AUTHOR_NAME: "taizhenC", GIT_AUTHOR_EMAIL: "tzhcheung@gmail.com",
  GIT_COMMITTER_NAME: "taizhenC", GIT_COMMITTER_EMAIL: "tzhcheung@gmail.com",
};
const git = (cwd: string, ...args: string[]) => exec("git", args, { cwd, timeout: 10_000, env: { ...process.env, ...identity, GIT_TERMINAL_PROMPT: "0" } });
const read = (dir: string, path: string) => readFile(join(dir, path), "utf8");
async function write(dir: string, path: string, content: string) {
  await mkdir(join(dir, path, ".."), { recursive: true });
  await writeFile(join(dir, path), content);
}
async function run(dir: string, role?: string, env: Partial<NodeJS.ProcessEnv> = {}, flags: string[] = []) {
  const args = [CLI, "join", KEY, "--base", base, "--no-claim", ...(role ? ["--role", role] : []), ...flags];
  try { return { code: 0, ...await exec(process.execPath, args, { cwd: dir, timeout: 10_000, env: { ...process.env, NO_COLOR: "1", ...env } }) }; }
  catch (err) {
    const result = err as { code: number; stdout: string; stderr: string };
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

/** A real old installation, including hashes of the old shared selector paths. */
async function writeLegacyPack(dir: string) {
  const files = renderPack(room(), "frontend", KEY, 1).map((file) => ({
    path: file.path === RECEIPT ? "grill/.room" : file.path === ROLE ? "grill/MY-ROLE.md" : file.path,
    content: file.content.replaceAll(ROLE, "grill/MY-ROLE.md").replaceAll(RECEIPT, "grill/.room"),
  }));
  const hashes: Record<string, string> = {};
  for (const file of files) {
    await write(dir, file.path, file.content);
    if (file.path === "grill/.room") continue;
    const content = file.path === "AGENTS.md"
      ? file.content.slice(file.content.indexOf(AGENTS_BLOCK_START), file.content.indexOf(AGENTS_BLOCK_END) + AGENTS_BLOCK_END.length)
      : file.content;
    hashes[file.path] = createHash("sha256").update(content).digest("hex");
  }
  await write(dir, "grill/.room", JSON.stringify({ receiptVersion: 1, kind: "member", origin: base, roomKey: KEY, role: "frontend", packVersion: 1, files: hashes }));
}

describe("member-local state across Git updates", { timeout: 20_000 }, () => {
  it("migrates tracked selectors and keeps two different roles local through both directions of commit and pull", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "grill-two-members-"));
    const remote = join(workspace, "remote.git");
    const seed = join(workspace, "seed");
    const backend = join(workspace, "backend");
    const frontend = join(workspace, "frontend");
    await git(workspace, "init", "--bare", "--initial-branch=main", remote);
    await git(workspace, "clone", remote, seed);
    await writeLegacyPack(seed);
    await write(seed, ".gitignore", "!/grill/.room\n!/.grill-with-me/\n");
    await write(seed, "grill/.gitignore", "!.room\n!MY-ROLE.md\n");
    await git(seed, "add", "-A");
    await git(seed, "commit", "-m", "Seed legacy tracked role selectors");
    await git(seed, "push", "origin", "main");

    await git(workspace, "clone", remote, backend);
    expect((await run(backend)).stderr).toContain("no role chosen");
    expect((await run(backend, "backend")).code).toBe(0);
    const backendReceipt = await read(backend, RECEIPT);
    expect(JSON.parse(backendReceipt).role).toBe("backend");
    expect(await read(backend, ROLE)).toContain("# Your role: Backend");
    expect(await read(backend, "grill/MY-ROLE.md")).toContain("# Your role: Frontend");
    await write(backend, "grill/backend-spec.md", "Backend shared decisions.\n");
    await git(backend, "add", "-A");
    expect((await git(backend, "ls-files", "--", ".grill-with-me")).stdout).toBe("");
    await git(backend, "commit", "-m", "Migrate shared adapters and publish backend decisions");
    await git(backend, "push", "origin", "main");

    await git(workspace, "clone", remote, frontend);
    expect((await run(frontend, "frontend")).code).toBe(0);
    const frontendReceipt = await read(frontend, RECEIPT);
    const frontendRole = await read(frontend, ROLE);
    await write(frontend, "grill/frontend-spec.md", "Frontend shared decisions.\n");
    await write(frontend, "grill/.room", '{"role":"frontend","obsolete":true}\n');
    await write(frontend, "grill/MY-ROLE.md", "Tracked legacy frontend notes.\n");
    await git(frontend, "add", "-A");
    expect((await git(frontend, "ls-files", "--", ".grill-with-me")).stdout).toBe("");
    await git(frontend, "commit", "-m", "Publish frontend decisions and legacy notes");
    await git(frontend, "push", "origin", "main");

    await git(backend, "pull", "--ff-only");
    expect(await read(backend, RECEIPT)).toBe(backendReceipt);
    expect((await run(backend)).code).toBe(0);
    expect(await read(backend, ROLE)).toContain("# Your role: Backend");
    expect((await read(backend, "grill/frontend-spec.md")).replaceAll("\r\n", "\n")).toBe("Frontend shared decisions.\n");
    await write(backend, "grill/.room", '{"role":"backend","obsolete":true}\n');
    await write(backend, "grill/MY-ROLE.md", "Tracked legacy backend notes.\n");
    await write(backend, "grill/CONTRACT.md", "Shared contract stays in Git.\n");
    await git(backend, "add", "-A");
    await git(backend, "commit", "-m", "Publish shared contract and legacy backend notes");
    await git(backend, "push", "origin", "main");
    await git(frontend, "pull", "--ff-only");
    expect(await read(frontend, RECEIPT)).toBe(frontendReceipt);
    expect(await read(frontend, ROLE)).toBe(frontendRole);
    expect((await run(frontend)).code).toBe(0);
    expect(JSON.parse(await read(frontend, RECEIPT)).role).toBe("frontend");
    expect((await read(frontend, "grill/CONTRACT.md")).replaceAll("\r\n", "\n")).toBe("Shared contract stays in Git.\n");
    expect((await read(frontend, ".claude/commands/grill-my-role.md")).replaceAll("\r\n", "\n"))
      .toBe((await read(backend, ".claude/commands/grill-my-role.md")).replaceAll("\r\n", "\n"));
  }, 30_000);

  it.each([RECEIPT, ROLE])("refuses a force-added tracked local selector %s even with force or an alternate Git index", async (path) => {
    const dir = await mkdtemp(join(tmpdir(), "grill-tracked-member-"));
    await git(dir, "init", "--quiet");
    expect((await run(dir, "backend")).code).toBe(0);
    await git(dir, "add", "--force", "--", path);
    const before = await read(dir, path);
    const result = await run(dir, "frontend", { GIT_INDEX_FILE: join(dir, "unrelated-index") }, ["--force"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("tracked by Git");
    expect(await read(dir, path)).toBe(before);
    expect(JSON.parse(await read(dir, RECEIPT)).role).toBe("backend");
  });

  it("excludes the parent directory despite nested negations and earlier root negations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-nested-ignores-"));
    await git(dir, "init", "--quiet");
    await write(dir, ".gitignore", "/.grill-with-me/\n!/.grill-with-me/\n");
    await write(dir, ".grill-with-me/.gitignore", "!member.json\n!MY-ROLE.md\n");
    expect((await run(dir, "backend")).code).toBe(0);
    for (const path of [RECEIPT, ROLE]) expect((await git(dir, "check-ignore", "--", path)).stdout.trim()).toBe(path);
    await git(dir, "add", "-A");
    expect((await git(dir, "ls-files", "--", ".grill-with-me")).stdout).toBe("");
    expect(await read(dir, ".grill-with-me/.gitignore")).toBe("!member.json\n!MY-ROLE.md\n");
  });

  it("supports a plain folder without Git but refuses unverifiable state inside a Git checkout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-no-git-"));
    const unavailable = { PATH: join(dir, "no-git-executable") };
    expect((await run(dir, "backend", unavailable)).code).toBe(0);
    await git(dir, "init", "--quiet");
    const receipt = await read(dir, RECEIPT);
    const result = await run(dir, "frontend", unavailable);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Git is required");
    expect(await read(dir, RECEIPT)).toBe(receipt);
  });

  it("does not edit the Git index, ignore rules, or local directory during dry-run migration", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-migration-preview-"));
    await git(dir, "init", "--quiet");
    await writeLegacyPack(dir);
    await git(dir, "add", "-A");
    const index = (await git(dir, "ls-files", "--stage")).stdout;
    const before = await read(dir, "grill/MY-ROLE.md");
    const result = await run(dir, "backend", {}, ["--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(RECEIPT);
    expect((await git(dir, "ls-files", "--stage")).stdout).toBe(index);
    expect(await read(dir, "grill/MY-ROLE.md")).toBe(before);
    expect(await readdir(dir)).not.toContain(".grill-with-me");
    expect(await readdir(dir)).not.toContain(".gitignore");
  });

  it("preserves edited legacy role notes while explicitly selecting a new local role", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-legacy-notes-"));
    await writeLegacyPack(dir);
    await write(dir, "grill/MY-ROLE.md", "My edited legacy notes must survive.\n");
    expect((await run(dir, "backend")).code).toBe(0);
    expect(await read(dir, "grill/MY-ROLE.md")).toBe("My edited legacy notes must survive.\n");
    expect(await read(dir, ROLE)).toContain("# Your role: Backend");
  });
});
