import { join } from "node:path";
import { createHash } from "node:crypto";
import { repository } from "../evals/fixtures.mjs";
import { redactEvidence, redactForeignOutputs, homeReadFindings } from "./run-agent-evals.mjs";
import { prepareEvidenceRoot } from "./evaluation-evidence-paths.mjs";

const evidence = await prepareEvidenceRoot(repository, process.argv[2]);

async function sanitize(directory, agent = null) {
  const entries = evidence.entries(directory);
  const phaseReads = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error("Evidence directories must not contain symlinks");
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await sanitize(path, entry.name.startsWith("codex") ? "codex" : entry.name.startsWith("claude") ? "claude" : agent); continue; }
    if (!/\.(json|md)$/.test(entry.name)) continue;
    const raw = await evidence.read(path);
    if (entry.name.endsWith(".md")) {
      await evidence.write(path, JSON.parse(redactEvidence(raw, null)));
      continue;
    }
    const value = JSON.parse(raw);
    if (value.events && agent) {
      const findings = homeReadFindings(agent, value.events);
      phaseReads.push(...findings);
      value.events = redactForeignOutputs(agent, value.events);
      value.scopeAudit = { knownHomeReads: findings, completeReadConfinement: "Not established by this detector; manual review required." };
      value.sanitizedRetrospectively ??= { method: "JSON parse then recursive path redaction; outside-fixture output omitted with SHA256; semantic assistant outputs unchanged.",
        originalRecordSha256: createHash("sha256").update(raw).digest("hex") };
    }
    await evidence.write(path, redactEvidence(value, null));
  }
  if (entries.some(entry => entry.name === "outcome.json")) {
    const path = join(directory, "outcome.json");
    const value = JSON.parse(await evidence.read(path));
    value.writeScopeOk ??= value.scopeOk;
    delete value.scopeOk;
    value.readScope = { knownHomeReadFindings: phaseReads, fullyConfined: false,
      review: "Recomputed from retained selected traces after fixture containment fix; manual full trace review still required." };
    await evidence.write(path, redactEvidence(value, null));
  }
}
await sanitize(evidence.root);
console.log("Sanitized selected local evidence; no model invocation.");
