import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGrillRoom } from "@/lib/schema";
import { SPEC_HEADINGS } from "@/lib/spec-format";

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
