import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { link, mkdir, mkdtemp, readFile, rmdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { POST } from "@/app/api/rooms/route";
import { getStore, MemoryStore, setStore } from "@/lib/store";
import { resetRateLimit } from "@/lib/rate-limit";

const exec = promisify(execFile);
const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "..", "cli/grill.mjs");
const RECOVERY = ".grill-with-me-publish.json";
const body = JSON.stringify({ schemaVersion: 1, project: { name: "Recover", idea: "Lost response fixture.", mode: "production" }, roles: [{ slug: "builder", name: "Builder", description: "Build." }] });
let server: Server;
let base: string;
let calls: number;
let dropResponse: boolean;
let currentDirectory: string;
let storedBeforeSend: boolean;
let lastCreated: { key: string; hostToken: string };
let beforeResponse: (() => Promise<void>) | null;
let echoCapability: boolean;
let invalidAcknowledgement: boolean;
let createdKeys: Set<string>;
let malformedToken: boolean;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      let data = ""; for await (const chunk of req) data += chunk.toString();
      calls++;
      const capability = req.headers["idempotency-key"];
      const saved = JSON.parse(await readFile(join(currentDirectory, RECOVERY), "utf8").catch(() => "{}"));
      storedBeforeSend = !!capability && saved.capability === capability && saved.origin === base && saved.body === data;
      if (echoCapability) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: `Do not echo ${capability}` })); return; }
      const response = await POST(new Request(`${base}/api/rooms`, { method: "POST", body: data, headers: capability ? { "idempotency-key": String(capability) } : {} }));
      const result = await response.json();
      if (response.ok) { lastCreated = result; createdKeys.add(result.key); }
      if (dropResponse) { req.socket.destroy(); return; }
      if (beforeResponse) await beforeResponse();
      if (invalidAcknowledgement) result.recovery.expiresAt = "invalid";
      if (malformedToken) result.hostToken = "x";
      res.writeHead(response.status, { "content-type": "application/json" }); res.end(JSON.stringify(result));
    } catch { res.writeHead(500); res.end('{}'); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("no fixture port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { calls = 0; dropResponse = false; storedBeforeSend = false; beforeResponse = null; echoCapability = false; invalidAcknowledgement = false; malformedToken = false; createdKeys = new Set(); setStore(new MemoryStore()); resetRateLimit(); });
async function checkout() {
  currentDirectory = await mkdtemp(join(tmpdir(), "grill-publication-"));
  await writeFile(join(currentDirectory, "grill-room.json"), body);
  return currentDirectory;
}
async function run(args: string[], cwd: string, orderingRole?: "A" | "B") {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" }; delete env.GRILL_WITH_ME_URL; delete env.GRILL_WITH_ME_TOKEN;
  const preload = orderingRole ? ["--import", pathToFileURL(join(__dirname, "fixtures/publication-ordering.mjs")).href] : [];
  if (orderingRole) env.GRILL_PUBLICATION_ORDERING_ROLE = orderingRole;
  try { return { code: 0, ...await exec(process.execPath, [...preload, CLI, ...args], { cwd, env, timeout: 20_000 }) }; }
  catch (error) { const value = error as { code: number; stdout: string; stderr: string }; return { code: value.code, stdout: value.stdout, stderr: value.stderr }; }
}

async function expectSingleRecoverablePublication(cwd: string) {
  expect(createdKeys.size).toBeLessThanOrEqual(1);
  const original = await readFile(join(cwd, RECOVERY), "utf8");
  const saved = JSON.parse(original);
  expect(saved).toMatchObject({ version: 1, origin: base, body });
  expect(saved.capability).toMatch(/^v1\.[0-9]+\.[a-f0-9]{64}$/);
  const recovered = await run(["publish", "--recover"], cwd);
  expect(recovered.code, recovered.stderr).toBe(0);
  expect(storedBeforeSend).toBe(true);
  expect(createdKeys.size).toBe(1);
  expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe(original);
  const config = JSON.parse(await readFile(join(cwd, ".grill-with-me.json"), "utf8"));
  expect(config).toMatchObject({ base, roomKey: lastCreated.key, hostToken: lastCreated.hostToken });
  expect([...createdKeys]).toEqual([config.roomKey]);
}

describe("CLI publication recovery", { timeout: 20_000 }, () => {
  it("persists before sending and recovers the same room/token after a lost response and process restart", async () => {
    const cwd = await checkout(); dropResponse = true;
    const lost = await run(["publish", "--base", base], cwd);
    expect(lost.code).not.toBe(0);
    expect(storedBeforeSend).toBe(true);
    const firstKey = lastCreated.key; const firstToken = lastCreated.hostToken;
    const original = await readFile(join(cwd, RECOVERY), "utf8");
    await writeFile(join(cwd, "grill-room.json"), body.replace("Recover", "Edited after loss"));
    dropResponse = false;
    const recovered = await run(["publish", "--recover"], cwd);
    expect(recovered.code, recovered.stderr).toBe(0);
    const config = JSON.parse(await readFile(join(cwd, ".grill-with-me.json"), "utf8"));
    expect(config.roomKey === firstKey && config.hostToken === firstToken).toBe(true);
    expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe(original);
    expect(calls).toBe(2);
    const capability = JSON.parse(original).capability;
    expect([lost.stdout, lost.stderr, recovered.stdout, recovered.stderr].some((text) => text.includes(capability) || text.includes(firstToken))).toBe(false);
  });

  it("reuses an acknowledged publication and requires explicit new-publication for another room", async () => {
    const cwd = await checkout();
    expect((await run(["publish", "--base", base], cwd)).code).toBe(0);
    const key = lastCreated.key;
    expect((await run(["publish", "--base", base], cwd)).code).toBe(0);
    expect(lastCreated.key).toBe(key);
    expect((await run(["publish", "--base", base, "--new-publication"], cwd)).code).toBe(0);
    expect(lastCreated.key).not.toBe(key);
  });
  it("refuses changed payloads and destinations before any request, even with force", async () => {
    const cwd = await checkout();
    await run(["publish", "--base", base], cwd);
    const saved = await readFile(join(cwd, RECOVERY), "utf8");
    await writeFile(join(cwd, "grill-room.json"), `${body}\n`);
    const changed = await run(["publish", "--base", base, "--force"], cwd);
    expect(changed.code).not.toBe(0); expect(changed.stderr).toContain("different payload");
    const elsewhere = await run(["publish", "--recover", "--base", "https://unrequested.invalid"], cwd);
    expect(elsewhere.code).not.toBe(0); expect(elsewhere.stderr).toContain("another origin");
    expect(calls).toBe(1);
    expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe(saved);
  });
  it("retains expired attempts until explicit replacement and never automatically retries them", async () => {
    const cwd = await checkout(); await run(["publish", "--base", base], cwd);
    const pending = JSON.parse(await readFile(join(cwd, RECOVERY), "utf8"));
    pending.capability = pending.capability.replace(/^v1\.[0-9]+\./, `v1.${Math.floor(Date.now() / 1000) - 86401}.`);
    const saved = JSON.stringify(pending); await writeFile(join(cwd, RECOVERY), saved);
    const expired = await run(["publish", "--recover"], cwd);
    expect(expired.code).not.toBe(0); expect(expired.stderr).toContain("expired"); expect(calls).toBe(1);
    expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe(saved);
    expect((await run(["publish", "--base", base, "--new-publication"], cwd)).code).toBe(0);
  });
  it("keeps a deleted publication's attempt instead of silently creating a replacement", async () => {
    const cwd = await checkout(); await run(["publish", "--base", base], cwd);
    const pending = await readFile(join(cwd, RECOVERY), "utf8");
    await getStore().delete(lastCreated.key, lastCreated.hostToken);
    const retry = await run(["publish", "--recover"], cwd);
    expect(retry.code).not.toBe(0); expect(retry.stderr).toContain("removed");
    expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe(pending);
    expect(await getStore().get(lastCreated.key)).toBeNull();
  });
  it("can recover after the response arrives but credential persistence fails", async () => {
    const cwd = await checkout();
    beforeResponse = () => mkdir(join(cwd, ".grill-with-me.json"));
    const failed = await run(["publish", "--base", base], cwd);
    expect(failed.code).not.toBe(0);
    const original = lastCreated;
    await rmdir(join(cwd, ".grill-with-me.json")); beforeResponse = null;
    const recovered = await run(["publish", "--recover"], cwd);
    expect(recovered.code, recovered.stderr).toBe(0);
    const config = JSON.parse(await readFile(join(cwd, ".grill-with-me.json"), "utf8"));
    expect(config.hostToken === original.hostToken && config.roomKey === original.key).toBe(true);
  });
  it("does not complete an invalid acknowledgement and redacts a server-echoed capability", async () => {
    const cwd = await checkout(); invalidAcknowledgement = true;
    const invalid = await run(["publish", "--base", base], cwd);
    expect(invalid.code).not.toBe(0); expect(invalid.stderr).toContain("did not acknowledge");
    expect(await stat(join(cwd, ".grill-with-me.json")).then(() => true, () => false)).toBe(false);
    invalidAcknowledgement = false; echoCapability = true;
    const echoed = await run(["publish", "--recover"], cwd);
    const { capability } = JSON.parse(await readFile(join(cwd, RECOVERY), "utf8"));
    expect(echoed.code).not.toBe(0); expect(echoed.stderr).toContain("[redacted]");
    expect(echoed.stderr.includes(capability) || echoed.stdout.includes(capability)).toBe(false);
  });
  it("establishes ignores before first send and keeps recovery out of git add -A", async () => {
    const cwd = await checkout(); await exec("git", ["init", "--quiet"], { cwd });
    const published = await run(["publish", "--base", base], cwd);
    expect(published.code, published.stderr).toBe(0); expect(storedBeforeSend).toBe(true);
    for (const file of [RECOVERY, `${RECOVERY}.tmp`]) await exec("git", ["check-ignore", "--quiet", "--", file], { cwd });
    await exec("git", ["add", "-A"], { cwd });
    expect((await exec("git", ["ls-files"], { cwd })).stdout).not.toContain(RECOVERY);
    if (process.platform !== "win32") expect((await stat(join(cwd, RECOVERY))).mode & 0o777).toBe(0o600);
  });
  it.each([RECOVERY, `${RECOVERY}.tmp`])("rejects tracked recovery storage %s before sending", async (file) => {
    const cwd = await checkout(); await exec("git", ["init", "--quiet"], { cwd });
    await writeFile(join(cwd, file), "private sentinel"); await exec("git", ["add", "-f", "--", file], { cwd });
    const result = await run(["publish", "--base", base, "--force", "--new-publication"], cwd);
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("tracked"); expect(calls).toBe(0);
    expect(await readFile(join(cwd, file), "utf8")).toBe("private sentinel");
  });
  it("rejects hardlinked recovery storage without touching its sentinel", async () => {
    const cwd = await checkout(); const sentinel = join(cwd, "sentinel.json");
    await writeFile(sentinel, "private sentinel"); await link(sentinel, join(cwd, RECOVERY));
    const result = await run(["publish", "--base", base, "--force"], cwd);
    expect(result.code).not.toBe(0); expect(calls).toBe(0);
    expect(await readFile(sentinel, "utf8")).toBe("private sentinel");
  });
  it("preserves malformed recovery state and does not send or replace it", async () => {
    const cwd = await checkout(); await writeFile(join(cwd, RECOVERY), '{"private":"sentinel"}');
    const result = await run(["publish", "--base", base, "--new-publication"], cwd);
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("invalid saved publication");
    expect(result.stderr).not.toContain("sentinel"); expect(calls).toBe(0);
    expect(await readFile(join(cwd, RECOVERY), "utf8")).toBe('{"private":"sentinel"}');
  });
  it("dry-run writes no ignore, recovery or credential file and sends nothing", async () => {
    const cwd = await checkout();
    expect((await run(["publish", "--base", base, "--dry-run"], cwd)).code).toBe(0);
    for (const path of [RECOVERY, ".gitignore", ".grill-with-me.json"]) expect(await stat(join(cwd, path)).then(() => true, () => false)).toBe(false);
    expect(calls).toBe(0);
  });
  it("concurrent first publishers cannot replace each other's pending capability and create two rooms", async () => {
    const cwd = await checkout();
    await Promise.all([run(["publish", "--base", base], cwd), run(["publish", "--base", base], cwd)]);
    await expectSingleRecoverablePublication(cwd);
  });
  it("recovers one unchanged publication when both first publishers safely stop before sending", async () => {
    const cwd = await checkout();
    const [winner, contender] = await Promise.all([
      run(["publish", "--base", base], cwd, "A"),
      run(["publish", "--base", base], cwd, "B"),
    ]);
    expect(winner.code, winner.stderr).not.toBe(0);
    expect(winner.stderr).toContain("temporary credential file");
    expect(contender.code, contender.stderr).not.toBe(0);
    expect(contender.stderr).toContain("state changed");
    expect(calls).toBe(0);
    expect(await stat(join(cwd, `${RECOVERY}.tmp`)).then(() => true, () => false)).toBe(false);
    await expectSingleRecoverablePublication(cwd);
    expect(calls).toBe(1);
  });
  it("rejects a short host token in a publication acknowledgement and preserves recovery", async () => {
    const cwd = await checkout(); malformedToken = true;
    const failed = await run(["publish", "--base", base], cwd);
    expect(failed.code).not.toBe(0);
    expect(await stat(join(cwd, ".grill-with-me.json")).then(() => true, () => false)).toBe(false);
    malformedToken = false;
    expect((await run(["publish", "--recover"], cwd)).code).toBe(0);
  });
});
