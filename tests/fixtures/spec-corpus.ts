import { SPEC_HEADINGS } from "@/lib/spec-format";

export const completeSpec = SPEC_HEADINGS.map((heading) =>
  `${heading}\n\n- Concrete endpoint or ownership agreement.\n`).join("\n");

export const specCorpus = [
  { name: "LF with heading first", text: completeSpec, ok: true, thin: false },
  { name: "CRLF", text: completeSpec.replace(/\n/g, "\r\n"), ok: true, thin: false },
  { name: "title and trailing whitespace", text: `# Backend spec\n${completeSpec.replace(/^(## .+)$/gm, "$1  \t")}`, ok: true, thin: false },
  { name: "allowed Markdown heading indentation", text: completeSpec.replace(/^##/gm, "   ##"), ok: true, thin: false },
  { name: "partially thin", text: SPEC_HEADINGS.join("\n\n") + "\nPending.\n", ok: true, thin: true },
  { name: "empty sections", text: SPEC_HEADINGS.join("\n\n"), ok: false, thin: true },
  { name: "empty document", text: "", ok: false, thin: true },
  { name: "comments only", text: SPEC_HEADINGS.map((h) => `${h}\n<!-- explain this -->\n`).join("\n"), ok: false, thin: true },
  { name: "empty bullet markers", text: SPEC_HEADINGS.map((h) => `${h}\n-\n`).join("\n"), ok: false, thin: true },
  { name: "content outside sections", text: `# Real title and introduction\n${SPEC_HEADINGS.join("\n\n")}`, ok: false, thin: true },
  { name: "whole spec hidden in a comment", text: `<!--\n${completeSpec}\n-->`, ok: false, thin: true },
  { name: "backtick-fenced fake headings", text: `\`\`\`markdown\n${completeSpec}\`\`\``, ok: false, thin: true },
  { name: "tilde-fenced fake headings", text: `~~~markdown\n${completeSpec}~~~`, ok: false, thin: true },
  { name: "shorter fence cannot close block", text: `\`\`\`\`markdown\n\`\`\`\n${completeSpec}\`\`\`\``, ok: false, thin: true },
  { name: "mixed fence cannot close block", text: `~~~markdown\n\`\`\`\n${completeSpec}~~~`, ok: false, thin: true },
  { name: "fenced headings inside real sections", text: completeSpec.replace("- Concrete endpoint or ownership agreement.", "```ts\n## Scope\ninterface Request { id: string }\n```"), ok: true, thin: false },
  { name: "unclosed HTML comment literal inside fence", text: completeSpec.replace("- Concrete endpoint or ownership agreement.", "```html\n<!-- literal marker\n```"), ok: true, thin: false },
  { name: "complete HTML comment literal inside fence", text: completeSpec.replace("- Concrete endpoint or ownership agreement.", "```html\n<!-- literal code comment -->\n```"), ok: true, thin: false },
  { name: "missing heading", text: completeSpec.replace("## Decisions made", "## Other decisions"), ok: false, thin: true },
  { name: "suffixed heading", text: completeSpec.replace("## Scope", "## Scope details"), ok: false, thin: true },
  { name: "heading with inline comment suffix", text: completeSpec.replace("## Scope", "## Scope <!-- copied -->"), ok: false, thin: true },
  { name: "inline fake heading", text: completeSpec.replace("## Scope", "Text before ## Scope"), ok: false, thin: true },
  { name: "duplicate", text: completeSpec + "\n## Scope\nAnother agreement.\n", ok: false, thin: false },
  { name: "out of order", text: completeSpec.replace("## Scope", "## TEMP").replace("## Still unclear", "## Scope").replace("## TEMP", "## Still unclear"), ok: false, thin: false },
  { name: "extra top-level section", text: completeSpec + "\n## Appendix\nDetails.\n", ok: false, thin: false },
];
