export type MergeManifest = {
  schemaVersion: 1;
  project: {
    name: string; idea: string; mode: "hackathon" | "side_project" | "production";
    knownStack: string; demoTarget: string; hoursLeft: number | null;
    mustWork: string[]; outOfScope: string[];
  };
  roles: Array<{ slug: string; name: string; description: string; owns: string[]; mustCover: string[] }>;
};
export function parseMergeInput(raw: string):
  { ok: true; manifest: MergeManifest } | { ok: false; errors: string[] };
