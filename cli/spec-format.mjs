/** One executable spec contract for the library, packaged CLI, and merge gate. */
export const SPEC_HEADINGS = Object.freeze([
  "## Scope", "## What I own", "## What I need from other roles",
  "## Decisions made", "## Still unclear",
]);

export function specPath(roleSlug) {
  return `grill/${roleSlug}-spec.md`;
}

/** Exact H2 lines outside backtick/tilde fences; trailing whitespace is harmless. */
export function validateSpec(markdown) {
  const sections = new Map(SPEC_HEADINGS.map((heading) => [heading, []]));
  const found = [];
  const errors = [];
  let current = null;
  let fence = null;
  let inComment = false;
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  for (const [index, original] of lines.entries()) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.marker}{${fence.length},}[ \\t]*$`).test(original)) {
        fence = null;
      } else if (current) sections.get(current).push(original);
      continue;
    }
    const opening = !inComment && original.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) {
      fence = { marker: opening[1][0], length: opening[1].length };
      continue;
    }
    // Comments outside code cannot manufacture headings or nonempty content.
    // Inside fences every character, including an unclosed '<!--', is literal.
    let line = "";
    let cursor = 0;
    while (cursor < original.length) {
      const boundary = original.indexOf(inComment ? "-->" : "<!--", cursor);
      if (boundary === -1) {
        line += inComment ? " ".repeat(original.length - cursor) : original.slice(cursor);
        break;
      }
      if (inComment) {
        line += " ".repeat(boundary + 3 - cursor);
        cursor = boundary + 3;
      } else {
        line += original.slice(cursor, boundary) + "    ";
        cursor = boundary + 4;
      }
      inComment = !inComment;
    }
    const heading = line.replace(/^ {0,3}/, "").trimEnd();
    if (/^##(?:[ \t]|$)/.test(heading)) {
      current = null;
      if (!sections.has(heading) || original.replace(/^ {0,3}/, "").trimEnd() !== heading) {
        errors.push(`line ${index + 1}: unexpected or suffixed heading ${heading}`);
        continue;
      }
      if (found.includes(heading)) errors.push(`line ${index + 1}: duplicate heading ${heading}`);
      found.push(heading);
      current = heading;
    } else if (current) {
      sections.get(current).push(line);
    }
  }
  const missing = SPEC_HEADINGS.filter((heading) => !found.includes(heading));
  if (missing.length) errors.push(`missing headings: ${missing.join(", ")}`);
  const unique = [...new Set(found)];
  const ordered = SPEC_HEADINGS.filter((heading) => found.includes(heading));
  if (unique.some((heading, index) => heading !== ordered[index])) errors.push("headings are out of order");
  const content = SPEC_HEADINGS.map((heading) => sections.get(heading).join("\n")
    .replace(/^[ \t]*[-*+>][ \t]*$/gm, "").trim());
  if (content.every((text) => text.length === 0)) errors.push("spec is wholly empty under its headings");
  const thin = SPEC_HEADINGS.filter((_, index) => content[index].length < 12);
  return { ok: errors.length === 0, missing, thin, errors };
}
