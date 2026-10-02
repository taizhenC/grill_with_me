import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(await readFile(join(root, "cli/package.json"), "utf8"));

// Run npm's JavaScript entry point directly: no shell quoting or Windows .cmd
// execution is needed, including when a checkout or temporary path has spaces.
const npm = [
  process.env.npm_execpath,
  ...[dirname(process.execPath), ...(process.env.PATH ?? "").split(delimiter)].map(
    (directory) => process.platform === "win32"
      ? join(directory, "node_modules/npm/bin/npm-cli.js")
      : join(directory, "npm"),
  ),
].find((candidate) => candidate && existsSync(candidate));
assert.ok(npm, "npm was not found; install Node.js with npm and add it to PATH");

function runNpm(args, cwd, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}`,
      NO_COLOR: "1",
    },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expectedStatus,
    `npm ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

const temporaryRoot = await realpath(tmpdir());
const workspace = await mkdtemp(join(temporaryRoot, "grill-package-"));
try {
  const packed = JSON.parse(runNpm(
    ["pack", "--json", "--ignore-scripts", "--pack-destination", workspace],
    join(root, "cli"),
  ));
  assert.equal(packed.length, 1, "npm pack must produce one CLI archive");
  const archive = packed[0];
  for (const path of ["package.json", "README.md", "LICENSE", ...metadata.files]) {
    assert.ok(archive.files.some((file) => file.path === path), `Archive is missing ${path}`);
  }
  assert.ok(!archive.files.some((file) =>
    /(^|\/)(?:\.env[^/]*|\.grill-with-me\.json[^/]*|\.room|node_modules)(?:\/|$)/.test(file.path),
  ), "Archive must not contain local credentials, room receipts, or installed dependencies");

  const consumer = join(workspace, "consumer with spaces");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), '{"name":"cli-smoke","private":true}\n');
  runNpm([
    "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
    "--package-lock=false", join(workspace, archive.filename),
  ], consumer);
  assert.ok((await readFile(join(consumer, "node_modules/grill-with-me/LICENSE"), "utf8")).includes("MIT License"));
  assert.ok((await readFile(join(consumer, "node_modules/grill-with-me/README.md"), "utf8")).includes("--base"));

  const command = ["exec", "--offline", "--no", "--", "grill-with-me"];
  assert.equal(runNpm([...command, "--version"], consumer), metadata.version);
  const help = runNpm([...command, "--help"], consumer);
  for (const name of ["join", "host", "publish", "check-spec"]) {
    assert.ok(help.includes(name), `Installed CLI help is missing ${name}`);
  }

  const spec = join(consumer, "backend-spec.md");
  const headings = [
    "Scope", "What I own", "What I need from other roles", "Decisions made", "Still unclear",
  ];
  await writeFile(spec, headings.map((heading) => `## ${heading}\n\nConcrete agreement for this section.\n`).join("\n"));
  runNpm([...command, "check-spec", spec], consumer);
  await writeFile(spec, "## Scope\n\nMissing the remaining required sections.\n");
  runNpm([...command, "check-spec", spec], consumer, 1);
  console.log(`Installed CLI ${metadata.version}: archive, command, help, and spec checks passed.`);
} finally {
  // Only remove the temporary directory created by this script, never a
  // checkout or an arbitrary path supplied in package metadata.
  const actualWorkspace = await realpath(workspace);
  const child = relative(temporaryRoot, actualWorkspace);
  assert.ok(child.startsWith("grill-package-") && !child.includes(sep));
  assert.equal(resolve(temporaryRoot, child), actualWorkspace);
  await rm(actualWorkspace, { recursive: true, force: true });
}
