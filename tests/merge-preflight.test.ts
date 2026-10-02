import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { parseMergeInput, preflightMerge } from "@/lib/merge-preflight";
import { SPEC_HEADINGS } from "@/lib/spec-format";
import { completeSpec } from "./fixtures/spec-corpus";

const exec = promisify(execFile);
const CLI = join(__dirname, "..", "cli/grill.mjs");
const project = { name: "Fresh host", idea: "Merge directly from host context.", mode: "side_project" };
const backend = { slug: "backend", name: "Backend", description: "Own the API." };
const frontend = { slug: "frontend", name: "Frontend", description: "Own the UI." };
const input = { schemaVersion: 1, project, roles: [backend, frontend] };
const contractPaths = ["grill/CONTRACT.md", "grill/contract.ts", "grill/CONTRACT-CHANGES.md"];
let workspace: string;
let temporaryRoot: string;
beforeAll(async () => {
  temporaryRoot = await realpath(tmpdir());
  workspace = await mkdtemp(join(temporaryRoot, "grill-merge-gate-"));
});
afterAll(async () => {
  const actual = await realpath(workspace);
  const child = relative(temporaryRoot, actual);
  expect(child.startsWith("grill-merge-gate-") && !child.includes(sep)).toBe(true);
  await rm(actual, { recursive: true, force: true });
});

describe("local host merge input", () => {
  it("validates usable project context and defaults optional metadata", () => {
    const result = parseMergeInput(JSON.stringify(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.project).toMatchObject({ name: project.name, idea: project.idea, hoursLeft: null, mustWork: [] });
    expect(result.manifest.roles[0]).toMatchObject({ ...backend, owns: [], mustCover: [] });
  });

  it.each([
    { name: "wrong version", value: { ...input, schemaVersion: 2 }, error: "schemaVersion" },
    { name: "missing context", value: { schemaVersion: 1, roles: [backend] }, error: "project" },
    { name: "blank name", value: { ...input, project: { ...project, name: " " } }, error: "project.name" },
    { name: "blank idea", value: { ...input, project: { ...project, idea: "\t" } }, error: "project.idea" },
    { name: "long context", value: { ...input, project: { ...project, idea: "a".repeat(8001) } }, error: "project.idea" },
    { name: "invalid mode", value: { ...input, project: { ...project, mode: "demo" } }, error: "project.mode" },
    { name: "invalid hours", value: { ...input, project: { ...project, hoursLeft: 0 } }, error: "project.hoursLeft" },
    { name: "fractional hours", value: { ...input, project: { ...project, hoursLeft: 2.5 } }, error: "project.hoursLeft" },
    { name: "bad optional stack", value: { ...input, project: { ...project, knownStack: null } }, error: "project.knownStack" },
    { name: "bad optional demo", value: { ...input, project: { ...project, demoTarget: 42 } }, error: "project.demoTarget" },
    { name: "bad metadata list", value: { ...input, project: { ...project, mustWork: "ship" } }, error: "project.mustWork" },
    { name: "too many metadata entries", value: { ...input, project: { ...project, outOfScope: Array(31).fill("Later") } }, error: "project.outOfScope" },
    { name: "blank metadata", value: { ...input, project: { ...project, mustWork: [" "] } }, error: "project.mustWork[0]" },
    { name: "missing roster", value: { schemaVersion: 1, project }, error: "roles" },
    { name: "empty roster", value: { ...input, roles: [] }, error: "roles" },
    { name: "too many roles", value: { ...input, roles: Array.from({ length: 13 }, (_, i) => ({ ...backend, slug: `role-${i}` })) }, error: "roles" },
    { name: "duplicate slug", value: { ...input, roles: [backend, backend] }, error: "duplicate role slug" },
    { name: "unsafe slug", value: { ...input, roles: [{ ...backend, slug: "../outside" }] }, error: "roles[0].slug" },
    { name: "suffixed slug", value: { ...input, roles: [{ ...backend, slug: "backend\n" }] }, error: "roles[0].slug" },
    { name: "blank role name", value: { ...input, roles: [{ ...backend, name: " " }] }, error: "roles[0].name" },
    { name: "missing description", value: { ...input, roles: [{ slug: "backend", name: "Backend" }] }, error: "roles[0].description" },
    { name: "bad role metadata", value: { ...input, roles: [{ ...backend, owns: [42] }] }, error: "roles[0].owns[0]" },
    { name: "long role metadata", value: { ...input, roles: [{ ...backend, mustCover: ["a".repeat(501)] }] }, error: "roles[0].mustCover[0]" },
    { name: "non-object role", value: { ...input, roles: [null] }, error: "roles[0]" },
  ])("rejects $name with a field-specific reason", ({ value, error }) => {
    const result = parseMergeInput(JSON.stringify(value));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain(error);
  });

  it.each(["{", "[]", "null", '"not an object"', "🌲".repeat(65537)])("rejects malformed or oversized input", (raw) => {
    expect(parseMergeInput(raw).ok).toBe(false);
  });
});

async function checkout() {
  const dir = await mkdtemp(join(workspace, "case-"));
  await mkdir(join(dir, "grill"));
  await writeFile(join(dir, "grill-room.json"), JSON.stringify(input));
  for (const role of input.roles) await writeFile(join(dir, `grill/${role.slug}-spec.md`), completeSpec);
  await writeFile(join(dir, "grill/CONTRACT.md"), "Existing agreed contract — preserve this.\n");
  await writeFile(join(dir, "grill/contract.ts"), "export interface Agreement { id: string }\n");
  await writeFile(join(dir, "grill/CONTRACT-CHANGES.md"), "Previously agreed amendment.\n");
  return dir;
}

const contracts = (dir: string) => Promise.all(contractPaths.map((file) => readFile(join(dir, file), "utf8")));

async function cli(dir: string, args: string[] = []) {
  try {
    const { stdout } = await exec(process.execPath, [CLI, "merge-preflight", ...args], { cwd: dir });
    return { code: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const failed = error as { code: number; stdout: string };
    return { code: failed.code, result: JSON.parse(failed.stdout) };
  }
}

describe("read-only merge preflight", () => {
  it("lets a fresh host validate two roles without a member's personal pack", async () => {
    const dir = await checkout();
    const before = await readFile(join(dir, "grill/CONTRACT.md"), "utf8");
    const { code, result } = await cli(dir);
    expect(code).toBe(0);
    expect(result).toEqual(await preflightMerge(dir));
    expect(result.manifest.project.name).toBe(project.name);
    expect(result.specs.map((item: { file: string }) => item.file)).toEqual(["grill/backend-spec.md", "grill/frontend-spec.md"]);
    expect((await readdir(join(dir, "grill"))).sort()).toEqual(["CONTRACT-CHANGES.md", "CONTRACT.md", "backend-spec.md", "contract.ts", "frontend-spec.md"]);
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe(before);
  });

  it("names every missing role and preserves the previous contract", async () => {
    const dir = await checkout();
    await rm(join(dir, "grill/backend-spec.md"));
    await rm(join(dir, "grill/frontend-spec.md"));
    const before = await contracts(dir);
    const { code, result } = await cli(dir);
    expect(code).toBe(1);
    expect(result.errors).toEqual(["missing role \"backend\": grill/backend-spec.md", "missing role \"frontend\": grill/frontend-spec.md"]);
    expect(await contracts(dir)).toEqual(before);
  });

  it("rejects a missing roster without replacing contracts or amendment history", async () => {
    const dir = await checkout();
    const before = await contracts(dir);
    const raw = JSON.stringify({ schemaVersion: 1, project });
    await writeFile(join(dir, "grill-room.json"), raw);
    const filesBefore = await readdir(join(dir, "grill"));
    const { code, result } = await cli(dir);
    expect(code).toBe(1);
    expect(result.errors.join("\n")).toContain("roles: expected 1 to 12 roles");
    expect(result.specs).toEqual([]);
    expect(await contracts(dir)).toEqual(before);
    expect(await readFile(join(dir, "grill-room.json"), "utf8")).toBe(raw);
    expect(await readdir(join(dir, "grill"))).toEqual(filesBefore);
  });

  it("rejects a malformed generated spec without changing any input or contract", async () => {
    const dir = await checkout();
    const file = join(dir, "grill/backend-spec.md");
    const raw = completeSpec + "\n## Scope\nDuplicate section.\n";
    await writeFile(file, raw);
    const before = await readFile(join(dir, "grill/CONTRACT.md"), "utf8");
    const { code, result } = await cli(dir);
    expect(code).toBe(1);
    expect(result.errors.join("\n")).toContain("grill/backend-spec.md: line");
    expect(result.errors.join("\n")).toContain("duplicate heading");
    expect(await readFile(file, "utf8")).toBe(raw);
    expect(await readFile(join(dir, "grill/CONTRACT.md"), "utf8")).toBe(before);
  });

  it("reports valid thin specs as warnings", async () => {
    const dir = await checkout();
    await writeFile(join(dir, "grill/frontend-spec.md"), SPEC_HEADINGS.join("\n\n") + "\nPending.\n");
    const { code, result } = await cli(dir);
    expect(code).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].file).toBe("grill/frontend-spec.md");
  });

  it("requires the host roster and supports an explicit input filename", async () => {
    const dir = await checkout();
    await rm(join(dir, "grill-room.json"));
    expect((await cli(dir)).code).toBe(1);
    await writeFile(join(dir, "host-input.json"), JSON.stringify(input));
    expect((await cli(dir, ["host-input.json"])).code).toBe(0);
  });

  it("rejects an extra role spec instead of silently merging it", async () => {
    const dir = await checkout();
    await writeFile(join(dir, "grill/old-role-spec.md"), completeSpec);
    const { code, result } = await cli(dir);
    expect(code).toBe(1);
    expect(result.errors[0]).toContain("unexpected role spec grill/old-role-spec.md");
  });

  it("rejects an invalid roster before consulting any role path", async () => {
    const dir = await checkout();
    await writeFile(join(dir, "grill-room.json"), JSON.stringify({ ...input, roles: [{ ...backend, slug: "../../outside" }] }));
    const { code, result } = await cli(dir);
    expect(code).toBe(1);
    expect(result.specs).toEqual([]);
    expect(result.errors.join("\n")).toContain("roles[0].slug");
  });
});
