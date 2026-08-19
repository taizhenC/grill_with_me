import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLI_DEFAULT_BASE,
  baseFlag,
  joinCommand,
  publishCommand,
  republishCommand,
  statusCommand,
} from "@/lib/commands";

describe("printed commands", () => {
  it("stay bare on the canonical deployment", () => {
    expect(joinCommand("pearl-summit-88", CLI_DEFAULT_BASE)).toBe(
      "npx grill-with-me join pearl-summit-88",
    );
    expect(baseFlag(CLI_DEFAULT_BASE)).toBe("");
  });

  it("carry --base everywhere else, so a fork or dev server still works", () => {
    const origin = "http://localhost:3000";
    expect(joinCommand("pearl-summit-88", origin, "backend")).toBe(
      "npx grill-with-me join pearl-summit-88 --role backend --base http://localhost:3000",
    );
    for (const command of [
      publishCommand(origin),
      republishCommand(origin),
      statusCommand("pearl-summit-88", origin),
    ]) {
      expect(command).toContain("--base http://localhost:3000");
    }
  });

  /**
   * The app prints commands for a CLI that ships separately. If its default
   * moves and this constant doesn't, every printed command silently points
   * at the wrong deployment — the exact failure --base exists to prevent.
   */
  it("agree with the CLI's own default base", () => {
    const cli = readFileSync(
      join(__dirname, "..", "cli", "grill.mjs"),
      "utf8",
    );
    expect(cli).toContain(`"${CLI_DEFAULT_BASE}"`);
  });
});
