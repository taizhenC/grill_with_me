import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const CLI = join(__dirname, "../cli/grill.mjs");
let parent: string;
let workspace: string;
beforeAll(async () => {
  parent = await realpath(tmpdir());
  workspace = await mkdtemp(join(parent, "grill-contract-types-"));
});
afterAll(async () => {
  const root = await realpath(workspace);
  const child = relative(parent, root);
  expect(child.startsWith("grill-contract-types-") && !child.includes(sep)).toBe(true);
  await rm(root, { recursive: true, force: true });
});

async function project(compiler = true) {
  const dir = await mkdtemp(join(workspace, "project with spaces-"));
  await cp(join(__dirname, "../examples/type-integration"), dir, { recursive: true });
  if (compiler) {
    await mkdir(join(dir, "node_modules"));
    // The fixture declares TypeScript; reuse the already installed dependency without network/install scripts.
    await symlink(await realpath(join(__dirname, "../node_modules/typescript")), join(dir, "node_modules/typescript"), process.platform === "win32" ? "junction" : "dir");
  }
  return dir;
}
async function gate(dir: string, config?: string) {
  try {
    const { stdout } = await exec(process.execPath, [CLI, "contract-typecheck", ...(config ? [config] : [])], { cwd: dir });
    return { code: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string };
    return { code: failed.code, result: JSON.parse(failed.stdout || JSON.stringify({ error: failed.stderr })) };
  }
}

describe("project-level consuming contract typecheck", () => {
  it("passes actual producer/consumer imports and fails a seeded consumer field mismatch", async () => {
    const dir = await project();
    const correct = await gate(dir);
    expect(correct.code, JSON.stringify(correct.result)).toBe(0);
    expect(correct.result.integration).toBe("integrated");
    expect(correct.result.consumers.map((entry: { file: string }) => entry.file)).toEqual(["src/consumer.ts", "src/producer.ts"]);
    expect(correct.result.typecheck.command).toBe("npm run typecheck");
    await writeFile(join(dir, "src/consumer.ts"), await readFile(join(dir, "consumer-mismatch.txt"), "utf8"));
    const mismatch = await gate(dir);
    expect(mismatch.code).toBe(1);
    expect(mismatch.result.integration).toBe("integrated");
    expect(mismatch.result.typecheck.passed).toBe(false);
    expect(mismatch.result.typecheck.diagnostics).toContainEqual(expect.objectContaining({ file: "src/consumer.ts", code: 2339 }));
    expect(mismatch.result.typecheck.output).toContain("shadeRating");
  });

  it.each(["absent", "unused", "side-effect"])("reports %s imports as unintegrated even though the project compiles", async (kind) => {
    const dir = await project();
    const content = kind === "unused" ? 'import type { RankResponse } from "../grill/contract";\nexport const untouched = 1;\n'
      : kind === "side-effect" ? 'import "../grill/contract";\nexport const untouched = 1;\n' : "export const untouched = 1;\n";
    await writeFile(join(dir, "src/producer.ts"), content);
    await writeFile(join(dir, "src/consumer.ts"), content);
    const result = await gate(dir);
    expect(result.code).toBe(1);
    expect(result.result.integration).toBe("unintegrated");
    expect(result.result.typecheck.passed).toBe(true);
    expect(result.result.consumers).toEqual([]);
  });

  it("requires the installed project compiler and reports solution configs as unknown", async () => {
    const dir = await project(false);
    const missing = await gate(dir);
    expect(missing.code).toBe(1);
    expect(missing.result.integration).toBe("unknown");
    expect(missing.result.reason).toContain("project-local");
    const installed = await project();
    await writeFile(join(installed, "solution.json"), '{"files":[],"references":[{"path":"./tsconfig.json"}]}');
    const solution = await gate(installed, "solution.json");
    expect(solution.code).toBe(1);
    expect(solution.result.reason).toContain("leaf tsconfig");
  });

  it("uses an installed local tsc project invocation when no npm typecheck script is declared", async () => {
    const dir = await project();
    await writeFile(join(dir, "package.json"), '{"name":"local-tsc-fixture","private":true}');
    const result = await gate(dir);
    expect(result.code, JSON.stringify(result.result)).toBe(0);
    expect(result.result.typecheck.command).toBe("local tsc --noEmit -p tsconfig.json");
  });
});
