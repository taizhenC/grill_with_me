import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { cases, createFixture } from "../evals/fixtures.mjs";
import { selectedEvents, assistantText, invoke, redactEvidence, homeReadFindings, redactForeignOutputs } from "../scripts/run-agent-evals.mjs";

const directories = [];
async function temporary() {
  const path = await mkdtemp(join(tmpdir(), "grill-eval-test-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + "/") && !resolve(directory).startsWith(resolve(tmpdir()) + "\\"))
      throw new Error("Temporary cleanup escaped its parent");
    await rm(directory, { recursive: true });
  }
});

describe("reproducible live-agent evaluation inputs", () => {
  it("installs the real member pack while hiding respondent facts and leaving a fresh output path", async () => {
    const directory = await temporary();
    const { files, entry } = await createFixture("member-frontend", directory);
    const receipt = JSON.parse(files[".grill-with-me/member.json"]);
    expect(receipt).toMatchObject({ receiptVersion: 2, role: "frontend", kind: "member", origin: "https://synthetic.invalid" });
    expect(receipt.roomKey).toMatch(/^r_[a-f0-9]{32}$/);
    expect(receipt.files[".grill-with-me/MY-ROLE.md"]).toMatch(/^[a-f0-9]{64}$/);
    expect(files[".claude/commands/grill-my-role.md"]).toContain(".grill-with-me/MY-ROLE.md");
    expect(files[".grill-with-me/MY-ROLE.md"]).toContain("EXACTLY these five headings");
    expect(files[".grill-with-me/MY-ROLE.md"]).not.toContain("undefined");
    expect(files["grill/frontend-spec.md"]).toBeUndefined();
    expect(JSON.stringify(files)).not.toContain(entry.role.answer);
    expect(files[".gitignore"]).toContain("/.grill-with-me/");
    expect(await readFile(join(directory, "AGENTS.md"), "utf8")).toBe(files["AGENTS.md"]);
  });

  it("pairs the amendment clean case with matching code and preserves a deliberately obsolete shared selector", async () => {
    const { files } = await createFixture("clean-no-local-role", await temporary());
    expect(files["grill/CONTRACT.md"]).toContain("returns { items:");
    expect(files["grill/CONTRACT-CHANGES.md"]).toContain("items wrapper replaces tickets");
    expect(JSON.parse(files["grill/CONTRACT-STATE.json"])).toBeTruthy();
    expect(files["src/api.ts"]).toContain("return { items:");
    expect(files["src/TicketList.ts"]).toContain("body.items");
    expect(files[".grill-with-me/member.json"]).toBeUndefined();
    expect(files["grill/.room"]).toContain('"role":"backend"');
  });

  it("seeds independent field, ownership, missing-file and absent-owner faults without exposing the grading key", async () => {
    const { files, entry } = await createFixture("seeded-drift", await temporary());
    expect(files["src/TicketList.ts"]).toContain("body.tickets");
    expect(files["src/api.ts"]).toContain("return { items:");
    expect(files["src/TicketList.ts"]).toContain("database.query");
    expect(files["src/archive.ts"]).toBeUndefined();
    expect(files["grill/CONTRACT.md"].split("\n")[13]).toContain("src/archive.ts");
    expect(files["grill/CONTRACT.md"].split("\n")[15]).toContain("Payments");
    expect(entry.expected.findings).toHaveLength(5);
    expect(cases.filter(c => c.kind === "member")).toHaveLength(5);
    expect(cases.filter(c => c.id.startsWith("clean-"))).toHaveLength(3);
    expect(Object.keys(files).some(path => /answer|expected|golden/.test(path))).toBe(false);
  });
});

describe("agent evidence handling", () => {
  it("distinguishes native runtime paths from actual global content reads and redacts foreign output", () => {
    const shell = join(homedir(), "runtime/pwsh.exe");
    const events = [
      { type: "item.completed", item: { id: "local", type: "command_execution", command: `"${shell}" -Command 'Get-Content README.md'`, exit_code: 0, aggregated_output: "fixture" } },
      { type: "item.completed", item: { id: "foreign", type: "command_execution", command: `"${shell}" -Command 'Get-Content ${join(homedir(), ".agents/skills/grilling/SKILL.md")}'`, exit_code: 0, aggregated_output: "private global text" } },
    ];
    expect(homeReadFindings("codex", events)).toHaveLength(1);
    const redacted = redactForeignOutputs("codex", events);
    expect(redacted[0].item.aggregated_output).toBe("fixture");
    expect(redacted[1].item.originalOutputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(redacted)).not.toContain("private global text");
    const fixture = join(homedir(), "AppData/Local/Temp/grill-owned-fixture");
    const localRead = [{ type: "assistant", content: [{ type: "tool_use", id: "owned", name: "Read", input: { file_path: join(fixture, "README.md") } }] }];
    expect(homeReadFindings("claude", localRead, fixture)).toEqual([]);
    const siblingRead = [{ type: "assistant", content: [{ type: "tool_use", id: "sibling", name: "Read", input: { file_path: join(fixture + "-sibling", "README.md") } }] }];
    expect(homeReadFindings("claude", siblingRead, fixture)).toHaveLength(1);
    expect(homeReadFindings("claude", [{ type: "assistant", content: [{ type: "tool_use", id: "redacted", name: "Read", input: { file_path: "${FIXTURE}/README.md" } }] }])).toEqual([]);
  });
  it("redacts nested shell-escaped account and fixture paths", () => {
    const directory = join(tmpdir(), "grill-eval-test-owned");
    const result = redactEvidence({ command: homedir().replaceAll("\\", "\\\\"), nested: [{ path: directory }] }, directory);
    expect(result).toContain("${HOME}");
    expect(result).toContain("${FIXTURE}");
    expect(result).not.toContain(homedir().replaceAll("\\", "\\\\"));
  });
  it("retains tool and answer evidence while excluding reasoning and account metadata", () => {
    const stream = [
      { type: "system", subtype: "init", model: "actual-model", claude_code_version: "local-version", apiKeySource: "private", session_id: "private" },
      { type: "assistant", message: { model: "actual-model", content: [
        { type: "thinking", thinking: "private reasoning", signature: "secret" },
        { type: "text", text: "Observed answer" },
        { type: "tool_use", name: "Read", input: { file_path: "README.md" } },
      ] } },
      { type: "rate_limit_event", rate_limit_info: { utilization: 0.97 } },
    ].map(JSON.stringify).join("\n");
    const events = selectedEvents("claude", stream);
    expect(assistantText("claude", events)).toBe("Observed answer");
    expect(JSON.stringify(events)).not.toMatch(/private|secret|utilization/);
    expect(JSON.stringify(events)).toContain("README.md");
    expect(selectedEvents("codex", JSON.stringify({ type: "item.completed", item: { type: "reasoning", text: "secret" } }))).toEqual([]);
  });

  it("terminates an overlong fixture process and records failure rather than manufacturing a result", async () => {
    const wrapper = `const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', "console.log('grandchild-ready'); setInterval(() => {}, 1000)"], { stdio: 'inherit' });
setInterval(() => {}, 1000);`;
    const result = await invoke(process.execPath, ["-e", wrapper], await temporary(), "", 2000);
    expect(result.stopped).toBe("timeout");
    expect(result.stdout).toContain("grandchild-ready");
    expect(result.durationMs).toBeLessThan(10_000);
  }, 15_000);
});
