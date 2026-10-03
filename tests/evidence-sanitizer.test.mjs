import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, symlink, link, rmdir, rm, realpath, lstat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve, dirname, basename, parse } from "node:path";
import { tmpdir, homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { repository } from "../evals/fixtures.mjs";

const execute = promisify(execFile), cleanup = [];
async function temporary(base = tmpdir()) {
  const parent = await realpath(base), directory = await mkdtemp(join(parent, "grill-eval-sanitizer-"));
  cleanup.push({ parent, directory });
  return directory;
}
afterEach(async () => {
  for (const { parent, directory } of cleanup.splice(0)) {
    if (dirname(await realpath(directory)) !== parent || !basename(directory).startsWith("grill-eval-sanitizer-") || (await lstat(directory)).isSymbolicLink())
      throw new Error("Refusing cleanup outside the exact owned temporary parent");
    await rm(directory, { recursive: true });
  }
});

async function fixture() {
  const base = await temporary(), repo = join(base, "repository"), allowed = join(repo, "evals/runs");
  await mkdir(join(repo, "scripts"), { recursive: true });
  await mkdir(allowed, { recursive: true });
  for (const file of ["sanitize-agent-evidence.mjs", "evaluation-evidence-paths.mjs"])
    await copyFile(join(repository, "scripts", file), join(repo, "scripts", file));
  await writeFile(join(repo, "evals/fixtures.mjs"), `export const repository = ${JSON.stringify(repo)};`);
  await writeFile(join(repo, "scripts/run-agent-evals.mjs"), `export { redactEvidence, redactForeignOutputs, homeReadFindings } from ${JSON.stringify(pathToFileURL(join(repository, "scripts/run-agent-evals.mjs")).href)};`);
  const command = join(repo, "scripts/sanitize-agent-evidence.mjs");
  return { base, allowed, command };
}
async function rejects(command, selection) {
  let failure;
  try { await execute(process.execPath, [command, selection]); } catch (error) { failure = error; }
  expect(failure?.code).toBe(1);
  expect(failure?.stderr).toContain("unlinked evidence directory");
}
const sentinelText = `owned sentinel ${homedir()} unchanged →🚀\n`;

describe("evidence sanitizer path ownership", () => {
  it("sanitizes an ordinary contained directory through the actual subprocess", async () => {
    const { allowed, command } = await fixture(), selected = join(allowed, "case");
    await mkdir(selected);
    await writeFile(join(selected, "artifact.md"), sentinelText);
    await execute(process.execPath, [command, selected]);
    expect(await readFile(join(selected, "artifact.md"), "utf8")).toBe("owned sentinel ${HOME} unchanged →🚀\n");
  });

  it("rejects outside selection without changing its sentinel", async () => {
    const { base, command } = await fixture(), outside = join(base, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "artifact.md"), sentinelText);
    await rejects(command, outside);
    expect(await readFile(join(outside, "artifact.md"), "utf8")).toBe(sentinelText);
  });

  it.each(["root", "ancestor", "allowed"])("rejects a %s junction/symlink before reaching the outside sentinel", async kind => {
    const { base, allowed, command } = await fixture(), outside = join(base, "outside"), nested = join(outside, "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "artifact.md"), sentinelText);
    let selected;
    if (kind === "allowed") {
      await rmdir(allowed);
      await symlink(outside, allowed, "junction");
      selected = join(allowed, "nested");
    } else {
      const linked = join(allowed, "linked");
      await symlink(kind === "root" ? nested : outside, linked, "junction");
      selected = kind === "root" ? linked : join(linked, "nested");
    }
    await rejects(command, selected);
    expect(await readFile(join(nested, "artifact.md"), "utf8")).toBe(sentinelText);
  });

  it("preflights a late hardlink before changing either the normal file or outside content", async () => {
    const { base, allowed, command } = await fixture(), selected = join(allowed, "case"), sentinel = join(base, "outside.md");
    await mkdir(selected);
    await writeFile(sentinel, sentinelText);
    await writeFile(join(selected, "a-normal.md"), sentinelText);
    await link(sentinel, join(selected, "z-linked.md"));
    await rejects(command, selected);
    expect(await readFile(sentinel, "utf8")).toBe(sentinelText);
    expect(await readFile(join(selected, "a-normal.md"), "utf8")).toBe(sentinelText);
  });

  it.runIf(process.platform === "win32" && Boolean(process.env.GRILL_EVAL_OTHER_DRIVE_TEMP))("rejects an available different-drive selection without changing its sentinel", async () => {
    const { allowed, command } = await fixture(), outside = await temporary(process.env.GRILL_EVAL_OTHER_DRIVE_TEMP);
    expect(parse(resolve(outside)).root.toLowerCase()).not.toBe(parse(resolve(allowed)).root.toLowerCase());
    await writeFile(join(outside, "artifact.md"), sentinelText);
    await rejects(command, outside);
    expect(await readFile(join(outside, "artifact.md"), "utf8")).toBe(sentinelText);
  });
});
