import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { repository } from "../evals/fixtures.mjs";
import { redactEvidence, redactForeignOutputs, homeReadFindings } from "./run-agent-evals.mjs";

const root = resolve(process.argv[2] || "");
const allowed = join(repository, "evals/runs");
const location = relative(allowed, root);
if (!process.argv[2] || location.startsWith("..") || resolve(root) === resolve(repository))
  throw new Error("Select an existing directory inside this repository's evals/runs; stop active runs first.");

async function sanitize(directory, agent = null) {
  const entries = await readdir(directory, { withFileTypes: true });
  const phaseReads = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error("Evidence directories must not contain symlinks");
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await sanitize(path, entry.name.startsWith("codex") ? "codex" : entry.name.startsWith("claude") ? "claude" : agent); continue; }
    if (!/\.(json|md)$/.test(entry.name)) continue;
    const raw = await readFile(path, "utf8");
    if (entry.name.endsWith(".md")) {
      await writeFile(path, JSON.parse(redactEvidence(raw, null)));
      continue;
    }
    const value = JSON.parse(raw);
    if (value.events && agent) {
      const findings = homeReadFindings(agent, value.events);
      phaseReads.push(...findings);
      value.events = redactForeignOutputs(agent, value.events);
      value.scopeAudit = { knownHomeReads: findings, completeReadConfinement: "Not established by this detector; manual review required." };
      value.sanitizedRetrospectively = { method: "JSON parse then recursive path redaction; outside-fixture output omitted with SHA256; semantic assistant outputs unchanged.",
        originalRecordSha256: createHash("sha256").update(raw).digest("hex") };
    }
    await writeFile(path, redactEvidence(value, null));
  }
  if (entries.some(entry => entry.name === "outcome.json")) {
    const path = join(directory, "outcome.json");
    const value = JSON.parse(await readFile(path, "utf8"));
    value.writeScopeOk ??= value.scopeOk;
    delete value.scopeOk;
    value.readScope = { knownHomeReadFindings: phaseReads, fullyConfined: false,
      review: "Recomputed from retained selected traces after fixture containment fix; manual full trace review still required." };
    await writeFile(path, redactEvidence(value, null));
  }
}
await sanitize(root);
console.log("Sanitized selected local evidence; no model invocation.");
