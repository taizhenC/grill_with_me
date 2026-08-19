import { describe, it, expect } from "vitest";
import { parseGrillRoom } from "@/lib/schema";
import {
  renderPack,
  renderMyRoleMd,
  renderProjectMd,
  renderAgentsMd,
  AGENTS_BLOCK_START,
  AGENTS_BLOCK_END,
  GRILL_COMMAND,
} from "@/lib/pack";
import { SPEC_HEADINGS, validateSpec, specPath } from "@/lib/spec-format";

function room() {
  const parsed = parseGrillRoom(
    JSON.stringify({
      schemaVersion: 1,
      project: {
        name: "Trailhead",
        idea: "Rank hikes by shade.",
        mode: "hackathon",
        hoursLeft: 18,
        knownStack: "Next.js, Supabase, TypeScript",
        demoTarget: "Search a city, see ranked trails.",
        outOfScope: ["accounts"],
        mustWork: ["ranking under 2s"],
      },
      roles: [
        {
          slug: "frontend",
          name: "Frontend",
          description: "Search UI and results page.",
          owns: ["app/page.tsx"],
          mustCover: ["empty state"],
        },
        {
          slug: "backend",
          name: "Backend",
          description: "Ranking API.",
          owns: [],
          mustCover: [],
        },
      ],
    }),
  );
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  return parsed.room;
}

describe("renderPack", () => {
  it("produces the documented file tree", () => {
    const files = renderPack(room(), "frontend", "blue-tiger-42", 1);
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([
      "AGENTS.md",
      "grill/PROJECT.md",
      "grill/MY-ROLE.md",
      "grill/.room",
      `.claude/commands/${GRILL_COMMAND}.md`,
      ".claude/skills/check-contract/SKILL.md",
      ".claude/skills/amend-contract/SKILL.md",
    ]);
  });

  it("ships a slash command that makes the first instruction true (decision 20)", () => {
    const files = renderPack(room(), "frontend", "blue-tiger-42", 1);
    const command = files.find((f) => f.path.endsWith(`${GRILL_COMMAND}.md`))!;
    expect(command.content).toMatch(/^---\ndescription: /);
    expect(command.content).toContain("grill/MY-ROLE.md");
    // Not `grill-me`: shadowing a member's installed skill would break the
    // one thing decision 19 relies on.
    expect(GRILL_COMMAND).not.toBe("grill-me");
  });

  it("bundles the real check/amend skills, not stubs (decision 17)", () => {
    const files = renderPack(room(), "backend", "k", 1);
    const check = files.find((f) =>
      f.path.endsWith("check-contract/SKILL.md"),
    )!;
    const amend = files.find((f) =>
      f.path.endsWith("amend-contract/SKILL.md"),
    )!;
    expect(check.content).toContain("name: check-contract");
    expect(check.content).toContain("CONTRACT-CHANGES.md");
    expect(amend.content).toContain("name: amend-contract");
    expect(amend.content).toContain("append-only");
  });

  it("throws on an unknown role slug", () => {
    expect(() => renderPack(room(), "designer", "k", 1)).toThrow(
      /no role "designer"/,
    );
  });

  it("stamps the room key, role, and pack version (decision 18)", () => {
    const files = renderPack(room(), "frontend", "blue-tiger-42", 3);
    const stamp = files.find((f) => f.path === "grill/.room")!;
    const parsed = JSON.parse(stamp.content);
    expect(parsed).toEqual({
      roomKey: "blue-tiger-42",
      role: "frontend",
      packVersion: 3,
    });
  });
});

describe("AGENTS.md", () => {
  it("is fenced so the CLI can merge it into a repo that has one (decision 21)", () => {
    const md = renderAgentsMd();
    expect(md.startsWith(AGENTS_BLOCK_START)).toBe(true);
    expect(md.trimEnd().endsWith(AGENTS_BLOCK_END)).toBe(true);
  });

  it("points a cold agent at the contract, then at the role", () => {
    const md = renderAgentsMd();
    expect(md).toContain("grill/CONTRACT.md");
    expect(md).toContain("NEVER invent a field name");
    expect(md).toContain(`/${GRILL_COMMAND}`);
  });
});

describe("MY-ROLE.md", () => {
  const md = renderMyRoleMd(room().project, room().roles[0]);

  it("names the role and scopes the grill to it", () => {
    expect(md).toContain("# Your role: Frontend");
    expect(md).toContain("MY LAYER ONLY");
  });

  it("instructs reading sibling specs and the repo (decision 15)", () => {
    expect(md).toContain("grill/*-spec.md");
    expect(md).toContain("the repo you are standing in");
  });

  it("carries every spec heading verbatim, in order (P0-2)", () => {
    for (const heading of SPEC_HEADINGS) {
      expect(md).toContain(heading);
    }
    const positions = SPEC_HEADINGS.map((h) => md.indexOf(h));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("names the exact output path for this role", () => {
    expect(md).toContain(specPath("frontend"));
  });

  it("includes the role's mustCover items", () => {
    expect(md).toContain("empty state");
  });

  it("one-question-at-a-time and recommended answers survive templating", () => {
    expect(md).toContain("one question at a time");
    expect(md).toContain("recommended answer");
  });
});

describe("PROJECT.md", () => {
  it("argues for cutting scope only under hackathon deadline", () => {
    const withDeadline = renderProjectMd(room().project);
    expect(withDeadline).toContain("~18 hours");
    expect(withDeadline).toContain("argue for shipping");

    const relaxed = renderProjectMd({
      ...room().project,
      mode: "side_project",
      hoursLeft: null,
    });
    expect(relaxed).not.toContain("argue for shipping");
  });

  it("renders must-work and out-of-scope lists", () => {
    const md = renderProjectMd(room().project);
    expect(md).toContain("ranking under 2s");
    expect(md).toContain("accounts");
  });
});

describe("validateSpec", () => {
  const wellFormed = [
    "# Frontend spec",
    "",
    ...SPEC_HEADINGS.flatMap((h) => [h, "", "- something", ""]),
  ].join("\n");

  it("accepts a spec with all headings in order", () => {
    expect(validateSpec(wellFormed)).toEqual({ ok: true });
  });

  it("names every missing heading", () => {
    const broken = wellFormed.replace("## Decisions made", "## Decisions");
    const result = validateSpec(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["## Decisions made"]);
  });

  it("rejects headings present but out of order", () => {
    const reordered = wellFormed
      .replace("## Scope", "## TEMP")
      .replace("## Still unclear", "## Scope")
      .replace("## TEMP", "## Still unclear");
    const result = validateSpec(reordered);
    expect(result.ok).toBe(false);
  });

  it("accepts a heading at the very start of the file", () => {
    const startsWithHeading = wellFormed.slice(wellFormed.indexOf("## Scope"));
    expect(validateSpec(startsWithHeading).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    const result = validateSpec("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toHaveLength(SPEC_HEADINGS.length);
  });
});
