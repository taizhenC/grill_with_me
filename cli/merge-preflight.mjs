import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseMergeInput } from "./merge-input.mjs";
import { specPath, validateSpec } from "./spec-format.mjs";

/** Read-only gate: never creates or replaces project/contract/spec files. */
export async function preflightMerge(root, inputPath = "grill-room.json") {
  let raw;
  try { raw = await readFile(resolve(root, inputPath), "utf8"); }
  catch { return { ok: false, errors: [`cannot read ${inputPath}; keep the host's grill-room.json in this checkout`], warnings: [], specs: [] }; }
  const parsed = parseMergeInput(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map((error) => `${inputPath}: ${error}`), warnings: [], specs: [] };
  const { manifest } = parsed;
  const errors = [];
  const warnings = [];
  const specs = manifest.roles.map((role) => ({ role: role.slug, file: specPath(role.slug) }));
  let files = [];
  try { files = await readdir(join(root, "grill")); }
  catch (error) { if (error.code !== "ENOENT") errors.push("cannot inspect grill/ for role specs"); }
  const expected = new Set(specs.map(({ file }) => file));
  for (const file of files.filter((name) => name.endsWith("-spec.md"))) {
    if (!expected.has(`grill/${file}`)) errors.push(`unexpected role spec grill/${file}; reconcile it with the role roster`);
  }
  await Promise.all(specs.map(async ({ role, file }) => {
    let markdown;
    try { markdown = await readFile(join(root, file), "utf8"); }
    catch (error) {
      errors.push(error.code === "ENOENT" ? `missing role "${role}": ${file}` : `cannot read role "${role}": ${file}`);
      return;
    }
    const result = validateSpec(markdown);
    if (!result.ok) errors.push(...result.errors.map((error) => `${file}: ${error}`));
    else if (result.thin.length) warnings.push({ file, thin: result.thin });
  }));
  warnings.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return { ok: errors.length === 0, errors: errors.sort(), warnings, manifest, specs };
}
