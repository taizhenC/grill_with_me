import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { validateSpec } from "@/lib/spec-format";
import { validateSpec as cliValidator } from "../cli/spec-format.mjs";
import { specCorpus } from "./fixtures/spec-corpus";

const exec = promisify(execFile);
const CLI = join(__dirname, "..", "cli/grill.mjs");
let workspace: string;
let temporaryRoot: string;
beforeAll(async () => {
  temporaryRoot = await realpath(tmpdir());
  workspace = await mkdtemp(join(temporaryRoot, "grill-spec-corpus-"));
});
afterAll(async () => {
  const actual = await realpath(workspace);
  const child = relative(temporaryRoot, actual);
  expect(child.startsWith("grill-spec-corpus-") && !child.includes(sep)).toBe(true);
  await rm(actual, { recursive: true, force: true });
});

describe("library / packaged CLI spec policy parity", () => {
  it.each(specCorpus)("$name", async ({ name, text, ok, thin }) => {
    const expected = validateSpec(text);
    expect(expected.ok, name).toBe(ok);
    expect(expected.thin.length > 0, name).toBe(thin);
    expect(cliValidator(text)).toEqual(expected);
    const file = join(workspace, `${name.replaceAll(/[^a-z0-9]/gi, "-")}.md`);
    await writeFile(file, text);
    let code = 0;
    let stdout = "";
    try {
      ({ stdout } = await exec(process.execPath, [CLI, "check-spec", file], {
        cwd: workspace, env: { ...process.env, NO_COLOR: "1" },
      }));
    } catch (error) {
      const failure = error as { code: number; stdout: string };
      code = failure.code;
      stdout = failure.stdout;
    }
    expect(code).toBe(ok ? 0 : 1);
    if (!ok) {
      for (const error of expected.errors) expect(stdout).toContain(error);
      expect(stdout).not.toContain("Well-formed");
    } else {
      expect(stdout.includes("— but thin")).toBe(thin);
    }
  });
});
