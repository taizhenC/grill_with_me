import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGrillRoom } from "@/lib/schema";
import { SPEC_HEADINGS } from "@/lib/spec-format";

describe("examples", () => {
  const example = (name: string) =>
    readFileSync(join(__dirname, "..", "examples", name), "utf8");

  it("examples/grill-room.json validates against the real schema", () => {
    const result = parseGrillRoom(example("grill-room.json"));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.room.roles.length).toBe(3);
  });

  /**
   * Nobody commits a team to this without seeing the output first (P1-6), so
   * the examples are the pitch. They have to keep showing what the skills
   * actually produce.
   */
  it("the example check report shows what check-contract promises", () => {
    const report = example("CHECK-REPORT.example.md");
    expect(report).toContain("Outcome: [ ] fix the code");
    expect(report).toContain("contract is wrong → run amend-contract");
    expect(report).toContain("accepted, ignore");
    expect(report).toContain("**NEW**");
    expect(report).toMatch(/`[\w./[\]-]+:\d+`/); // every finding cites file:line
    expect(report).toContain("✅");
  });

  it("the example contract names concrete shapes, not descriptions", () => {
    const contract = example("CONTRACT.example.md");
    expect(contract).toContain("## Endpoints");
    expect(contract).toContain("owner: **Backend**");
    expect(contract).toContain("shadeScore: number");
  });
});

/**
 * Skills are prompts, so their behavior is exercised by running them — but
 * their *contracts* are testable: the JSON example a skill shows must
 * validate against the real schema, and the headings it teaches must be the
 * real headings. These tests stop the skill docs drifting from the code.
 */

const skillsDir = join(__dirname, "..", "skills");

function readSkill(name: string): string {
  return readFileSync(join(skillsDir, name, "SKILL.md"), "utf8");
}

function extractJsonBlock(markdown: string): string {
  const match = markdown.match(/```json\r?\n([\s\S]*?)```/);
  if (!match) throw new Error("no ```json block found");
  return match[1];
}

describe("grill-host skill", () => {
  const skill = readSkill("grill-host");

  it("has frontmatter with name and description", () => {
    expect(skill).toMatch(/^---\r?\nname: grill-host/);
    expect(skill).toContain("description:");
  });

  it("its example grill-room.json validates against the real schema", () => {
    const example = extractJsonBlock(skill);
    const result = parseGrillRoom(example);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("teaches the three-phase flow in order", () => {
    const p1 = skill.indexOf("Phase 1");
    const p2 = skill.indexOf("Phase 2");
    const p3 = skill.indexOf("Phase 3");
    expect(p1).toBeGreaterThan(-1);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });

  it("keeps the grill-me interviewing style", () => {
    expect(skill.toLowerCase()).toContain("one question at a time");
    expect(skill.toLowerCase()).toContain("recommended answer");
  });

  it("forbids inventing scope", () => {
    expect(skill).toContain("do not invent");
  });

  it("captures the fields the schema requires", () => {
    for (const field of [
      "schemaVersion",
      "knownStack",
      "demoTarget",
      "hoursLeft",
      "mustCover",
    ]) {
      expect(skill).toContain(field);
    }
  });
});

describe("merge-contract skill", () => {
  const skill = readSkill("merge-contract");

  it("requires exactly the real spec headings, in order", () => {
    let cursor = 0;
    for (const heading of SPEC_HEADINGS) {
      const at = skill.indexOf(heading, cursor);
      expect(at, `missing or out of order: ${heading}`).toBeGreaterThan(-1);
      cursor = at + heading.length;
    }
  });

  it("fails loudly on malformed specs instead of merging around them", () => {
    expect(skill).toContain("STOP and report");
    expect(skill).toContain("do not merge around it");
  });

  it("routes contradictions to UNRESOLVED and gaps to NOBODY OWNS THIS", () => {
    expect(skill).toContain("## ⚠️ UNRESOLVED — decide this before you code");
    expect(skill).toContain("## ⚠️ NOBODY OWNS THIS");
    expect(skill).toContain("Never resolve a contradiction yourself");
  });

  it("emits contract.ts on TypeScript stacks and verifies it compiles", () => {
    expect(skill).toContain("grill/contract.ts");
    expect(skill).toContain("tsc --noEmit");
  });
});

describe("check-contract skill", () => {
  const skill = readSkill("check-contract");

  it("scopes the check from the contract instead of reading the repo (P0-3)", () => {
    expect(skill).toContain("Do NOT read the whole repo");
    expect(skill).toContain("Derive the file set from the contract");
  });

  it("treats amendments as authoritative (decision 16)", () => {
    expect(skill).toContain("Amendments override");
  });

  it("attributes findings to roles and offers three outcomes (decision 9)", () => {
    expect(skill).toContain("who to go talk to");
    expect(skill).toContain("fix the code");
    expect(skill).toContain("contract is wrong");
    expect(skill).toContain("accepted, ignore");
  });

  it("guards against manufactured findings and re-reported noise (P1-4)", () => {
    expect(skill).toContain("empty report");
    expect(skill).toContain("NEW");
  });

  it("checks pack staleness via .room (decision 18)", () => {
    expect(skill).toContain("grill/.room");
    expect(skill).toContain("stale");
  });
});

describe("amend-contract skill", () => {
  const skill = readSkill("amend-contract");

  it("appends to an audit trail and updates the contract in place", () => {
    expect(skill).toContain("CONTRACT-CHANGES.md");
    expect(skill).toContain("append-only");
    expect(skill).toContain("in place");
  });

  it("surfaces un-agreed changes instead of refusing or hiding them", () => {
    expect(skill).toContain("not yet agreed");
    expect(skill).toContain("Do not refuse");
  });

  it("keeps contract.ts in sync when present", () => {
    expect(skill).toContain("grill/contract.ts");
    expect(skill).toContain("tsc --noEmit");
  });
});

describe("spec headings are stated once and reused", () => {
  it("SPEC_HEADINGS has the five sections the plan documents", () => {
    expect(SPEC_HEADINGS).toEqual([
      "## Scope",
      "## What I own",
      "## What I need from other roles",
      "## Decisions made",
      "## Still unclear",
    ]);
  });
});
