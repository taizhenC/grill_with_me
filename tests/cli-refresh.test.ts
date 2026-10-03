import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseGrillRoom } from "@/lib/schema";
import { renderPack, skillFiles, AGENTS_BLOCK_START, AGENTS_BLOCK_END, type PackFile } from "@/lib/pack";

const exec = promisify(execFile);
const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "../cli/grill.mjs");
const KEY = "pearl-summit-88";
let server: Server;
let second: Server;
let base: string;
let otherBase: string;
let revision: number;
let claims: number;
let memberRole: string;
let changePack: ((pack: Record<string, unknown> & { files: PackFile[] }) => void) | undefined;

function room() {
  const parsed = parseGrillRoom(JSON.stringify({
    schemaVersion: 1,
    project: { name: `Project v${revision}`, idea: "Build together.", mode: "production" },
    roles: [{ slug: memberRole, name: "Backend", description: "Own the API." }],
  }));
  if (!parsed.ok) throw new Error("bad fixture");
  return parsed.room;
}

function fixtureServer() {
  return createServer(async (req, res) => {
    for await (const _chunk of req) { /* consume request */ }
    const url = new URL(req.url ?? "/", "http://localhost");
    let body: unknown;
    if (url.pathname === "/api/skills/host") {
      body = { bundle: "host", files: skillFiles(["grill-host", "merge-contract"]).map((file) => ({ ...file, content: `${file.content}\nfixture revision ${revision}\n` })) };
    } else if (req.method === "POST") {
      claims++;
      body = { ok: true };
    } else {
      const summary = { key: KEY, version: revision, project: room().project, roles: room().roles };
      if (url.searchParams.has("role")) {
        const pack = { ...summary, role: memberRole, files: renderPack(room(), memberRole, KEY, revision).map((file) => ({
          ...file,
          content: file.path === ".grill-with-me/member.json" ? file.content : file.path === "AGENTS.md"
            ? file.content.replace("# Agent instructions", `# Agent instructions v${revision}`)
            : `${file.content}\nfixture revision ${revision}\n`,
        })) };
        changePack?.(pack);
        body = pack;
      } else body = summary;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
}

async function listen(instance: Server) {
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => {
  server = fixtureServer();
  second = fixtureServer();
  base = await listen(server);
  otherBase = await listen(second);
});
afterAll(async () => {
  await Promise.all([server, second].map((instance) => new Promise<void>((resolve) => instance.close(() => resolve()))));
});
beforeEach(() => { revision = 1; claims = 0; memberRole = "backend"; changePack = undefined; });

async function run(args: string[], cwd: string) {
  try {
    return { code: 0, ...await exec(process.execPath, [CLI, ...args], { cwd, timeout: 10_000, env: { ...process.env, NO_COLOR: "1" } }) };
  } catch (err) {
    const result = err as { code: number; stdout: string; stderr: string };
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

const read = (dir: string, path: string) => readFile(join(dir, path), "utf8");
const joinArgs = () => ["join", KEY, "--base", base, "--role", "backend", "--no-claim"];
async function installed() {
  const dir = await mkdtemp(join(tmpdir(), "grill-refresh-"));
  expect((await run(joinArgs(), dir)).code).toBe(0);
  return dir;
}

// These cases install, fsync, and refresh through multiple real subprocesses.
// Windows CI exceeded the default 5s once; keep a finite allowance scoped here.
describe("safe member refresh", { timeout: 20_000 }, () => {
  it("preserves a locally edited pack file and the completed receipt", async () => {
    const dir = await installed();
    const stamp = await read(dir, ".grill-with-me/member.json");
    await writeFile(join(dir, "grill/PROJECT.md"), "my local changes\n");
    revision = 2;

    const result = await run(joinArgs(), dir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("grill/PROJECT.md");
    expect(await read(dir, "grill/PROJECT.md")).toBe("my local changes\n");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(stamp);
  });

  it("refreshes unchanged files, keeps the same local role, and records normalized origin and hashes", async () => {
    const dir = await installed();
    revision = 2;
    const result = await run(["join", KEY, "--base", `${base}/`, "--no-claim"], dir);
    expect(result.code).toBe(0);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v2");
    const receipt = JSON.parse(await read(dir, ".grill-with-me/member.json"));
    expect(receipt).toMatchObject({ receiptVersion: 2, origin: base, roomKey: KEY, role: "backend", packVersion: 2 });
    expect(Object.keys(receipt.files)).toHaveLength(6);
    expect(receipt.files["grill/PROJECT.md"]).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.files[".grill-with-me/member.json"]).toBeUndefined();
    expect(await read(dir, ".gitignore")).toContain("/.grill-with-me/");
  });

  it("accepts schema-valid digit-prefixed role slugs and reuses them from receipts", async () => {
    memberRole = "3d-api";
    const dir = await mkdtemp(join(tmpdir(), "grill-role-slug-"));
    expect((await run(["join", KEY, "--base", base, "--role", memberRole, "--no-claim"], dir)).code).toBe(0);
    expect((await run(["join", KEY, "--base", base, "--no-claim"], dir)).code).toBe(0);
    expect(JSON.parse(await read(dir, ".grill-with-me/member.json")).role).toBe(memberRole);
  });

  it("does not reuse the saved role or write when the same key comes from another origin", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    const result = await run(["join", KEY, "--base", otherBase, "--no-claim"], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no role chosen");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
  });

  it("requires force to replace different content from the same key at another origin", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    revision = 2;
    const args = ["join", KEY, "--base", otherBase, "--role", "backend", "--no-claim"];
    expect((await run(args, dir)).code).toBe(1);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v1");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
    expect((await run([...args, "--force"], dir)).code).toBe(0);
    expect(JSON.parse(await read(dir, ".grill-with-me/member.json")).origin).toBe(otherBase);
  });

  it("preserves AGENTS personal text byte-for-byte while updating only its owned fence", async () => {
    const dir = await installed();
    const original = await read(dir, "AGENTS.md");
    const personalPrefix = "# Personal\r\nKeep trailing spaces.  \r\n\r\n";
    const personalSuffix = "\r\n\r\nAnother instruction.  \r\n";
    await writeFile(join(dir, "AGENTS.md"), personalPrefix + original + personalSuffix);
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(0);
    expect(await read(dir, "AGENTS.md")).toBe(personalPrefix + original.replace("instructions v1", "instructions v2") + personalSuffix);
  });

  it("refuses invalid local UTF-8 before merging personal AGENTS text even with force", async () => {
    const dir = await installed();
    const invalid = Buffer.from([0x23, 0x20, 0xc3, 0x28]);
    await writeFile(join(dir, "AGENTS.md"), invalid);
    revision = 2;
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("invalid UTF-8");
    expect(await readFile(join(dir, "AGENTS.md"))).toEqual(invalid);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v1");
  });

  it.skipIf(process.platform === "win32")("does not widen a private existing file's permissions when replacing it", async () => {
    const dir = await installed();
    const path = join(dir, "grill/PROJECT.md");
    await chmod(path, 0o600);
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(0);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("preserves an edited owned AGENTS block unless explicitly forced and never touches specs or contracts", async () => {
    const dir = await installed();
    const personal = "# Personal\n";
    const agents = personal + (await read(dir, "AGENTS.md")).replace("# Agent instructions", "# My customized instructions");
    await writeFile(join(dir, "AGENTS.md"), agents);
    await writeFile(join(dir, "grill/backend-spec.md"), "my spec");
    await writeFile(join(dir, "grill/CONTRACT.md"), "our contract");
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(1);
    expect(await read(dir, "AGENTS.md")).toBe(agents);
    expect((await run([...joinArgs(), "--force"], dir)).code).toBe(0);
    expect(await read(dir, "AGENTS.md")).toBe(personal + renderPack(room(), "backend", KEY, 2)[0].content.replace("# Agent instructions", "# Agent instructions v2"));
    expect(await read(dir, "grill/backend-spec.md")).toBe("my spec");
    expect(await read(dir, "grill/CONTRACT.md")).toBe("our contract");
  });

  it("treats a deleted installed file as a local edit", async () => {
    const dir = await installed();
    await unlink(join(dir, "grill/PROJECT.md"));
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(1);
    await expect(read(dir, "grill/PROJECT.md")).rejects.toMatchObject({ code: "ENOENT" });
    expect((await run([...joinArgs(), "--force"], dir)).code).toBe(0);
  });

  it("preserves personal AGENTS text when its installed fence was deliberately removed", async () => {
    const dir = await installed();
    const personal = "# Only my instructions remain.  \r\n";
    await writeFile(join(dir, "AGENTS.md"), personal);
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(1);
    expect(await read(dir, "AGENTS.md")).toBe(personal);
    expect((await run([...joinArgs(), "--force"], dir)).code).toBe(0);
    expect((await read(dir, "AGENTS.md")).startsWith(personal)).toBe(true);
    expect((await read(dir, "AGENTS.md")).split(AGENTS_BLOCK_START)).toHaveLength(2);
  });

  it("requires an explicit role for legacy stamps and refuses unverified changed files", async () => {
    const dir = await installed();
    await unlink(join(dir, ".grill-with-me/member.json"));
    await writeFile(join(dir, "grill/.room"), JSON.stringify({ roomKey: KEY, role: "backend", packVersion: 1 }));
    expect((await run(["join", KEY, "--base", base, "--no-claim"], dir)).stderr).toContain("no role chosen");
    revision = 2;
    expect((await run(joinArgs(), dir)).code).toBe(1);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v1");
    expect((await run([...joinArgs(), "--force"], dir)).code).toBe(0);
  });

  it("adopts legacy files only when their content matches the requested pack", async () => {
    const dir = await installed();
    await unlink(join(dir, ".grill-with-me/member.json"));
    await writeFile(join(dir, "grill/.room"), JSON.stringify({ roomKey: KEY, role: "backend", packVersion: 1 }));
    expect((await run(joinArgs(), dir)).code).toBe(0);
    expect(JSON.parse(await read(dir, ".grill-with-me/member.json")).origin).toBe(base);
  });

  it("dry-run reports local conflicts without changing receipts, files, ignore rules, or claims", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    const ignore = await read(dir, ".gitignore");
    await writeFile(join(dir, "grill/PROJECT.md"), "local");
    revision = 2;
    const result = await run([...joinArgs().filter((arg) => arg !== "--no-claim"), "--dry-run", "--name", "Member"], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("blocked");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
    expect(await read(dir, ".gitignore")).toBe(ignore);
    expect(await read(dir, "grill/PROJECT.md")).toBe("local");
    expect(claims).toBe(0);
  });

  it.each([
    ["unclosed", `${AGENTS_BLOCK_START}\ntext`],
    ["reversed", `${AGENTS_BLOCK_END}\ntext\n${AGENTS_BLOCK_START}`],
    ["duplicate", `${AGENTS_BLOCK_START}\none\n${AGENTS_BLOCK_END}\n${AGENTS_BLOCK_START}\ntwo\n${AGENTS_BLOCK_END}`],
  ])("refuses %s local AGENTS fences even with force", async (_label, malformed) => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    await writeFile(join(dir, "AGENTS.md"), malformed);
    revision = 2;
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("local AGENTS.md");
    expect(await read(dir, "AGENTS.md")).toBe(malformed);
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
  });

  it.each(["missing fence", "duplicate fence", "outside text"])("refuses incoming AGENTS %s before creating anything", async (issue) => {
    const dir = await mkdtemp(join(tmpdir(), "grill-bad-fence-"));
    changePack = (pack) => {
      const file = pack.files.find((entry) => entry.path === "AGENTS.md")!;
      file.content = issue === "missing fence" ? "instructions" : issue === "duplicate fence" ? file.content + file.content : "unowned\n" + file.content;
    };
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("downloaded AGENTS.md");
    expect(await readdir(dir)).toEqual([]);
  });

  it.each(["key", "role", "version", "stamp room", "stamp role", "stamp version"])("refuses mismatched %s metadata before writing", async (field) => {
    const dir = await mkdtemp(join(tmpdir(), "grill-bad-identity-"));
    changePack = (pack) => {
      if (field === "key") pack.key = "other-room-88";
      else if (field === "role") pack.role = "frontend";
      else if (field === "version") pack.version = 0;
      else {
        const file = pack.files.find((entry) => entry.path === ".grill-with-me/member.json")!;
        const stamp = JSON.parse(file.content);
        stamp[field === "stamp room" ? "roomKey" : field === "stamp role" ? "role" : "packVersion"] = field === "stamp room" ? "other-room-88" : field === "stamp role" ? "frontend" : 9;
        file.content = JSON.stringify(stamp);
      }
    };
    expect((await run(joinArgs(), dir)).stderr).toContain("does not match");
    expect(await readdir(dir)).toEqual([]);
  });

  it.each(["JSON", "origin", "hash", "path", "identity"])("refuses malformed receipt %s even with force", async (issue) => {
    const dir = await installed();
    const stamp = JSON.parse(await read(dir, ".grill-with-me/member.json"));
    if (issue === "origin") stamp.origin += "/path";
    if (issue === "hash") stamp.files["AGENTS.md"] = "not a hash";
    if (issue === "path") stamp.files["../outside"] = "a".repeat(64);
    if (issue === "identity") stamp.role = "../bad";
    const malformed = issue === "JSON" ? "{" : JSON.stringify(stamp);
    await writeFile(join(dir, ".grill-with-me/member.json"), malformed);
    revision = 2;
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("install receipt");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(malformed);
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v1");
  });

  it("preflights late temporary collisions before modifying earlier files even with force", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    const path = ".claude/skills/amend-contract/SKILL.md.grill-tmp";
    await writeFile(join(dir, path), "recover this interrupted write");
    revision = 2;
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("unfinished install");
    expect(await read(dir, path)).toBe("recover this interrupted write");
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v1");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
  });

  it("rejects a junction or symlink leading to local install metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-linked-ignore-"));
    const outside = await mkdtemp(join(tmpdir(), "grill-ignore-sentinel-"));
    await writeFile(join(outside, "sentinel"), "do not touch");
    await symlink(outside, join(dir, ".gitignore"), process.platform === "win32" ? "junction" : "dir");
    expect((await run([...joinArgs(), "--force"], dir)).stderr).toContain("unsafe pack target");
    expect(await readdir(dir)).toEqual([".gitignore"]);
    expect(await read(outside, "sentinel")).toBe("do not touch");
  });

  it.skipIf(process.platform !== "win32" && process.getuid?.() === 0)("retains the old receipt after partial I/O failure and safely retries an identical payload", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    const lateFile = ".claude/skills/amend-contract/SKILL.md";
    const oldLate = await read(dir, lateFile);
    const locked = join(dir, process.platform === "win32" ? lateFile : ".claude/skills/amend-contract");
    await chmod(locked, process.platform === "win32" ? 0o444 : 0o555);
    revision = 2;
    try {
      const result = await run([...joinArgs().filter((arg) => arg !== "--no-claim"), "--name", "Member"], dir);
      expect(result.code).toBe(1);
      expect(await read(dir, "grill/PROJECT.md")).toContain("Project v2");
      expect(await read(dir, lateFile)).toBe(oldLate);
      expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
      expect(claims).toBe(0);
    } finally { await chmod(locked, process.platform === "win32" ? 0o644 : 0o755); }
    expect((await run(joinArgs(), dir)).code).toBe(0);
    expect(await read(dir, lateFile)).toContain("fixture revision 2");
    expect(JSON.parse(await read(dir, ".grill-with-me/member.json")).packVersion).toBe(2);
    expect((await readdir(join(dir, ".claude/skills/amend-contract"))).some((path) => path.endsWith(".grill-tmp"))).toBe(false);
  });

  it.skipIf(process.platform !== "win32" && process.getuid?.() === 0)("blocks changed payload after an interrupted refresh rather than guessing ownership", async () => {
    const dir = await installed();
    const receipt = await read(dir, ".grill-with-me/member.json");
    const locked = join(dir, process.platform === "win32" ? ".claude/skills/amend-contract/SKILL.md" : ".claude/skills/amend-contract");
    await chmod(locked, process.platform === "win32" ? 0o444 : 0o555);
    revision = 2;
    try { expect((await run(joinArgs(), dir)).code).toBe(1); }
    finally { await chmod(locked, process.platform === "win32" ? 0o644 : 0o755); }
    revision = 3;
    const result = await run(joinArgs(), dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("grill/PROJECT.md");
    expect(await read(dir, "grill/PROJECT.md")).toContain("Project v2");
    expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
  });

  it.skipIf(process.platform !== "win32")("does not claim success when the final receipt cannot be replaced", async () => {
    const dir = await installed();
    const path = join(dir, ".grill-with-me/member.json");
    const receipt = await read(dir, ".grill-with-me/member.json");
    await chmod(path, 0o444);
    revision = 2;
    try {
      const result = await run(joinArgs(), dir);
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain("You're set up");
      expect(await read(dir, ".grill-with-me/member.json")).toBe(receipt);
      expect(await read(dir, ".claude/skills/amend-contract/SKILL.md")).toContain("fixture revision 2");
    } finally { await chmod(path, 0o644); }
    expect((await run(joinArgs(), dir)).code).toBe(0);
    expect(JSON.parse(await read(dir, ".grill-with-me/member.json")).packVersion).toBe(2);
  });
});

describe("safe host refresh", { timeout: 20_000 }, () => {
  const args = () => ["host", "--base", base];
  it("updates unedited host skills and preserves edited files with a separate local receipt", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-host-refresh-"));
    expect((await run(args(), dir)).code).toBe(0);
    revision = 2;
    expect((await run(args(), dir)).code).toBe(0);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toContain("fixture revision 2");
    expect(await read(dir, ".gitignore")).toContain("/.grill-with-me-host.json");
    const receipt = await read(dir, ".grill-with-me-host.json");
    await writeFile(join(dir, ".claude/skills/grill-host/SKILL.md"), "my host workflow");
    revision = 3;
    expect((await run(args(), dir)).code).toBe(1);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toBe("my host workflow");
    expect(await read(dir, ".grill-with-me-host.json")).toBe(receipt);
    expect((await run([...args(), "--force"], dir)).code).toBe(0);
    expect(await read(dir, ".claude/skills/grill-host/SKILL.md")).toContain("fixture revision 3");
  });

  it("binds host receipt ownership to origin and supports an empty dry-run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grill-host-origin-"));
    expect((await run([...args(), "--dry-run"], dir)).code).toBe(0);
    expect(await readdir(dir)).toEqual([]);
    expect((await run(args(), dir)).code).toBe(0);
    revision = 2;
    expect((await run(["host", "--base", otherBase], dir)).code).toBe(1);
    expect(JSON.parse(await read(dir, ".grill-with-me-host.json")).origin).toBe(base);
    await expect(read(dir, ".grill-with-me/member.json")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps host and member receipts separate and ignores both in a fresh Git repo", async () => {
    const dir = await installed();
    const memberReceipt = await read(dir, ".grill-with-me/member.json");
    expect((await run(args(), dir)).code).toBe(0);
    expect(await read(dir, ".grill-with-me/member.json")).toBe(memberReceipt);
    await exec("git", ["init", "--quiet"], { cwd: dir });
    const paths = [".grill-with-me/member.json", ".grill-with-me-host.json", ".claude/skills/grill-host/SKILL.md.grill-tmp"];
    const ignored = await exec("git", ["check-ignore", "--no-index", ...paths], { cwd: dir });
    expect(ignored.stdout.trim().split(/\r?\n/)).toEqual(paths);
  });
});
