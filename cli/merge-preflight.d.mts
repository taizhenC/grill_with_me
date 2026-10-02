import type { MergeManifest } from "./merge-input.mjs";
export function preflightMerge(root: string, inputPath?: string): Promise<{
  ok: boolean; errors: string[]; warnings: Array<{ file: string; thin: string[] }>;
  manifest?: MergeManifest; specs: Array<{ role: string; file: string }>;
}>;
