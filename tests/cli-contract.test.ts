import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { completeSpec } from "./fixtures/spec-corpus";

const exec = promisify(execFile);
const CLI = join(__dirname, "../cli/grill.mjs");
let temporaryRoot: string;
let workspace: string;
beforeAll(async () => {
  temporaryRoot = await realpath(tmpdir());
  workspace = await mkdtemp(join(temporaryRoot, "grill-contract-"));
});
afterAll(async () => {
  const actual = await realpath(workspace);
  const child = relative(temporaryRoot, actual);
  expect(child.startsWith("grill-contract-") && !child.includes(sep)).toBe(true);
  await rm(actual, { recursive: true, force: true });
});

async function command(dir: string, name: string, ...args: string[]) {
  try {
    const { stdout } = await exec(process.execPath, [CLI, name, ...args], { cwd: dir });
    return { code: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const failure = error as { code: number; stdout: string; stderr: string };
    return { code: failure.code, result: failure.stdout ? JSON.parse(failure.stdout) : { error: failure.stderr } };
  }
}

const prose = "# Contract — Sample\n\n## Endpoints\n\n### [agreement:api.rank.response]\nReturn { shadeScore: number }. Backend owns this response.\n";
async function draft() {
  const dir = await mkdtemp(join(workspace, "draft-"));
  await mkdir(join(dir, "grill"));
  await writeFile(join(dir, "grill-room.json"), JSON.stringify({
    schemaVersion: 1, project: { name: "Sample", idea: "Rank shade.", mode: "side_project" },
    roles: [{ slug: "backend", name: "Backend", description: "Own the API." }],
  }));
  await writeFile(join(dir, "grill/backend-spec.md"), completeSpec);
  await writeFile(join(dir, "grill/CONTRACT.next.md"), prose);
  await writeFile(join(dir, "grill/CONTRACT-PROPOSAL.json"), JSON.stringify({
    schemaVersion: 1,
    kind: "merge", parentRevision: null, summary: "Initial agreement", changedAgreementIds: ["api.rank.response"],
    approval: "agreed", agreedBy: ["Backend"], pendingRoles: [], types: "none", amendmentResolution: [],
  }));
  return dir;
}

async function proposal(dir: string, changes: Record<string, unknown>) {
  const path = join(dir, "grill/CONTRACT-PROPOSAL.json");
  const original = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify({ ...original, ...changes }));
}

describe("local contract revision CLI", () => {
  it("reports unknown freshness without a revision and does not create files", async () => {
    const dir = await mkdtemp(join(workspace, "empty-"));
    const { code, result } = await command(dir, "contract-status");
    expect(code).toBe(0);
    expect(result.freshness).toBe("unknown");
    expect(result.revision).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });

  it("previews a valid proposal without writes and refuses a force bypass", async () => {
    const dir = await draft();
    const before = (await readdir(join(dir, "grill"))).sort();
    const planned = await command(dir, "contract-finalize", "--dry-run");
    expect(planned.code, JSON.stringify(planned.result)).toBe(0);
    expect(planned.result.dryRun).toBe(true);
    expect(planned.result.revision.number).toBe(1);
    expect((await readdir(join(dir, "grill"))).sort()).toEqual(before);
    expect((await command(dir, "contract-finalize", "--force")).code).toBe(1);
    expect((await readdir(join(dir, "grill"))).sort()).toEqual(before);
  });

  it("finalizes a non-TypeScript contract with a separate revision and source hashes", async () => {
    const dir = await draft();
    const finalized = await command(dir, "contract-finalize");
    expect(finalized.code, JSON.stringify(finalized.result)).toBe(0);
    expect(finalized.result.revision.number).toBe(1);
    expect(finalized.result.revision.parent).toBeNull();
    expect(finalized.result.revision.id).toMatch(/^[a-f0-9]{64}$/);
    const { result } = await command(dir, "contract-status");
    expect(result.freshness).toBe("fresh");
    expect(result.revision.id).toBe(finalized.result.revision.id);
    expect(result.revision.source.specs[0]).toMatchObject({ role: "backend", file: "grill/backend-spec.md" });
    expect(result.revision.source.specs[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe(prose);
    expect(result.revision).not.toHaveProperty("packVersion");
    expect(await readFile(join(dir, "grill/CONTRACT-CHANGES.md"), "utf8")).toContain("Initial agreement");
  });

  it("records a pending amendment without hiding disagreement when the host source is offline", async () => {
    const dir = await draft();
    const first = await command(dir, "contract-finalize");
    const history = await readFile(join(dir, "grill/CONTRACT-HISTORY.jsonl"), "utf8");
    const changes = await readFile(join(dir, "grill/CONTRACT-CHANGES.md"), "utf8");
    await writeFile(join(dir, "grill/CONTRACT.next.md"), prose.replace("number", "integer 0–100"));
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id, summary: "Use an integer scale",
      approval: "pending", agreedBy: ["Project owner"], pendingRoles: ["backend"] });
    const amended = await command(dir, "contract-finalize");
    expect(amended.code, JSON.stringify(amended.result)).toBe(0);
    expect(amended.result.revision.number).toBe(2);
    expect(amended.result.revision.parent).toBe(first.result.revision.id);
    expect((await readFile(join(dir, "grill/CONTRACT-HISTORY.jsonl"), "utf8")).startsWith(history)).toBe(true);
    expect((await readFile(join(dir, "grill/CONTRACT-CHANGES.md"), "utf8")).startsWith(changes)).toBe(true);
    await rm(join(dir, "grill-room.json"));
    const status = await command(dir, "contract-status");
    expect(status.result.freshness).toBe("unknown");
    expect(status.result.pending).toEqual([{ revision: amended.result.revision.id, roles: ["backend"] }]);
  });

  it("preserves old-format contracts until explicit adoption acknowledges the existing history", async () => {
    const dir = await draft();
    await writeFile(join(dir, "grill/CONTRACT.md"), "Old contract; keep our existing agreement.\n");
    await writeFile(join(dir, "grill/CONTRACT-CHANGES.md"), "Previously agreed change.\n");
    expect((await command(dir, "contract-finalize")).code).toBe(1);
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe("Old contract; keep our existing agreement.\n");
    const legacy = await command(dir, "contract-status");
    expect(legacy.result.freshness).toBe("unknown");
    await proposal(dir, { kind: "adopt", legacyHistoryHash: legacy.result.legacy.historyHash });
    const adopted = await command(dir, "contract-finalize");
    expect(adopted.code, JSON.stringify(adopted.result)).toBe(0);
    expect(adopted.result.revision.kind).toBe("adopt");
    expect((await readFile(join(dir, "grill/CONTRACT-CHANGES.md"), "utf8")).startsWith("Previously agreed change.\n")).toBe(true);
  });

  it("stops a re-merge from discarding an amendment and verifies a preservation acknowledgment", async () => {
    const dir = await draft();
    const first = await command(dir, "contract-finalize");
    const amendedProse = prose.replace("number", "integer 0–100");
    await writeFile(join(dir, "grill/CONTRACT.next.md"), amendedProse);
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id, summary: "Integer scale" });
    const amendment = await command(dir, "contract-finalize");
    expect(amendment.code).toBe(0);
    await writeFile(join(dir, "grill/CONTRACT.next.md"), prose);
    await proposal(dir, { kind: "merge", parentRevision: amendment.result.revision.id, summary: "Re-merge specs" });
    const missing = await command(dir, "contract-finalize");
    expect(missing.code).toBe(1);
    expect(missing.result.error).toContain("amendment");
    const resolution = [{ revision: amendment.result.revision.id, decision: "preserved", note: "Retain the integer scale." }];
    await proposal(dir, { amendmentResolution: resolution });
    const discarded = await command(dir, "contract-finalize");
    expect(discarded.code).toBe(1);
    expect(discarded.result.error).toContain("api.rank.response");
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe(amendedProse);
    await writeFile(join(dir, "grill/CONTRACT.next.md"), amendedProse);
    await proposal(dir, { changedAgreementIds: [] });
    const preserved = await command(dir, "contract-finalize");
    expect(preserved.code, JSON.stringify(preserved.result)).toBe(0);
    expect(preserved.result.revision.amendmentResolution).toEqual(resolution);
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe(amendedProse);
  });

  it("rejects an ambiguous approval before creating any canonical agreement files", async () => {
    const dir = await draft();
    await proposal(dir, { approval: "pending", pendingRoles: [] });
    const finalized = await command(dir, "contract-finalize");
    expect(finalized.code).toBe(1);
    expect(finalized.result.error).toContain("pendingRoles");
    expect((await readdir(join(dir, "grill"))).sort()).toEqual(["CONTRACT-PROPOSAL.json", "CONTRACT.next.md", "backend-spec.md"]);
  });

  it("records explicit later agreement before clearing a pending revision", async () => {
    const dir = await draft();
    await proposal(dir, { approval: "pending", pendingRoles: ["backend"] });
    const first = await command(dir, "contract-finalize");
    expect((await command(dir, "contract-status")).result.pending).toHaveLength(1);
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id,
      summary: "Backend agreed the recorded scale", approval: "agreed", pendingRoles: [],
      changedAgreementIds: [], resolvesPending: [first.result.revision.id] });
    expect((await command(dir, "contract-finalize")).code).toBe(0);
    const status = await command(dir, "contract-status");
    expect(status.result.pending).toEqual([]);
    expect(status.result.revision.resolvesPending).toEqual([first.result.revision.id]);
  });

  it("distinguishes locally fresh/stale/unknown sources independently of a member pack version", async () => {
    const dir = await draft();
    expect((await command(dir, "contract-finalize")).code).toBe(0);
    await mkdir(join(dir, ".grill-with-me"));
    await writeFile(join(dir, ".grill-with-me/member.json"), JSON.stringify({ packVersion: 999 }));
    expect((await command(dir, "contract-status")).result.freshness).toBe("fresh");
    await writeFile(join(dir, "grill/backend-spec.md"), completeSpec + "\nNew source decision.\n");
    expect((await command(dir, "contract-status")).result.freshness).toBe("stale");
    await rm(join(dir, "grill-room.json"));
    expect((await command(dir, "contract-status")).result.freshness).toBe("unknown");
  });

  it("rejects a paused stale plan after a competing process completes its revision", async () => {
    const dir = await draft();
    const workflow = pathToFileURL(join(__dirname, "../cli/contract-workflow.mjs")).href;
    const files = pathToFileURL(join(__dirname, "../cli/contract-files.mjs")).href;
    const processA = spawn(process.execPath, ["--input-type=module", "-e", `
      import { planContract } from ${JSON.stringify(workflow)};
      import { publishRevision } from ${JSON.stringify(files)};
      const plan = await planContract(process.cwd());
      console.log("planned");
      await new Promise(resolve => process.stdin.once("data", resolve));
      try { await publishRevision(process.cwd(), plan.outputs, plan.metadata); process.exitCode = 2; }
      catch (error) { console.log(error.message); }
    `], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    processA.stdout.on("data", (data) => { output += data.toString(); });
    const exited = new Promise<number | null>((resolve) => processA.once("exit", resolve));
    try {
      await new Promise<void>((resolve, reject) => {
        processA.stdout.once("data", () => resolve());
        processA.once("error", reject);
        processA.once("exit", () => reject(new Error("planner exited before signaling readiness")));
      });
      await proposal(dir, { summary: "Competing successful revision" });
      const winner = await command(dir, "contract-finalize");
      expect(winner.code, JSON.stringify(winner.result)).toBe(0);
      const history = await readFile(join(dir, "grill/CONTRACT-HISTORY.jsonl"), "utf8");
      processA.stdin.end("continue\n");
      expect(await exited).toBe(0);
      expect(output).toContain("stale contract plan");
      expect(await readFile(join(dir, "grill/CONTRACT-HISTORY.jsonl"), "utf8")).toBe(history);
      expect((await command(dir, "contract-status")).result.revision.id).toBe(winner.result.revision.id);
    } finally { if (processA.exitCode === null) processA.kill(); }
  });

  it("finalizes matching prose/types/history together and refuses to silently remove existing types", async () => {
    const dir = await draft();
    await writeFile(join(dir, "grill/contract.next.ts"), "export interface RankResponse { shadeScore: number }\n");
    await proposal(dir, { types: "replace" });
    const first = await command(dir, "contract-finalize");
    expect(first.code, JSON.stringify(first.result)).toBe(0);
    expect(first.result.revision.typesHash).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(join(dir, "grill/CONTRACT.next.md"), prose.replace("number", "string"));
    await writeFile(join(dir, "grill/contract.next.ts"), "export interface RankResponse { shadeScore: string }\n");
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id, summary: "Use a string scale", types: "none" });
    expect((await command(dir, "contract-finalize")).code).toBe(1);
    await proposal(dir, { types: "replace" });
    const amended = await command(dir, "contract-finalize");
    expect(amended.code, JSON.stringify(amended.result)).toBe(0);
    expect(await readFile(join(dir, "grill/contract.ts"), "utf8")).toContain("shadeScore: string");
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toContain("shadeScore: string");
    expect((await command(dir, "contract-status")).result.freshness).toBe("fresh");
  });

  it.skipIf(process.platform !== "win32")("rejects edited replay contents before writing canonical files", async () => {
    const dir = await draft();
    const first = await command(dir, "contract-finalize");
    await writeFile(join(dir, "grill/CONTRACT.next.md"), prose.replace("number", "integer 0–100"));
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id, summary: "Integer scale" });
    const locked = join(dir, "grill/CONTRACT-STATE.json");
    await chmod(locked, 0o444);
    try { expect((await command(dir, "contract-finalize")).code).toBe(1); }
    finally { await chmod(locked, 0o644); }
    const journal = join(dir, "grill/CONTRACT-PENDING.json");
    const original = JSON.parse(await readFile(journal, "utf8"));
    const files = ["CONTRACT.md", "CONTRACT-CHANGES.md", "CONTRACT-HISTORY.jsonl", "CONTRACT-STATE.json"];
    const before = await Promise.all(files.map((path) => readFile(join(dir, "grill", path), "utf8")));
    for (const path of files) {
      const edited = structuredClone(original);
      edited.outputs[`grill/${path}`] += "corrupted journal payload";
      await writeFile(journal, JSON.stringify(edited));
      const retried = await command(dir, "contract-finalize");
      expect(retried.code).toBe(1);
      expect(retried.result.error).toContain("journal outputs");
      expect(await Promise.all(files.map((file) => readFile(join(dir, "grill", file), "utf8")))).toEqual(before);
    }
  });

  it.skipIf(process.platform !== "win32")("keeps interrupted finalization unknown and resumes the same revision after an I/O failure", async () => {
    const dir = await draft();
    const first = await command(dir, "contract-finalize");
    await writeFile(join(dir, "grill/CONTRACT.next.md"), prose.replace("number", "integer 0–100"));
    await proposal(dir, { kind: "amend", parentRevision: first.result.revision.id, summary: "Integer scale" });
    const locked = join(dir, "grill/CONTRACT-STATE.json");
    await chmod(locked, 0o444);
    try {
      expect((await command(dir, "contract-finalize")).code).toBe(1);
      const status = await command(dir, "contract-status");
      expect(status.result.freshness).toBe("unknown");
      expect(status.code).toBe(1);
    } finally { await chmod(locked, 0o644); }
    const resumed = await command(dir, "contract-finalize");
    expect(resumed.code, JSON.stringify(resumed.result)).toBe(0);
    expect(resumed.result.revision.number).toBe(2);
    expect((await command(dir, "contract-status")).result.freshness).toBe("fresh");
  });
});
