const MODES = ["hackathon", "side_project", "production"];
const MAX_BYTES = 256 * 1024;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Validate the local merge-input contract; this is not the server's Zod schema. */
export function parseMergeInput(raw) {
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) return { ok: false, errors: ["merge input exceeds 256 KiB"] };
  let input;
  try { input = JSON.parse(raw); }
  catch { return { ok: false, errors: ["merge input is not valid JSON"] }; }
  if (!object(input)) return { ok: false, errors: ["merge input must be an object"] };
  const errors = [];
  const string = (value, path, limit, required = true) => {
    if (typeof value !== "string" || value.length > limit || (required && !value.trim())) {
      errors.push(`${path}: expected ${required ? "a nonempty" : "a"} string of at most ${limit} characters`);
      return "";
    }
    return value;
  };
  const list = (value, path) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 30) {
      errors.push(`${path}: expected an array of at most 30 strings`);
      return [];
    }
    return value.map((entry, index) => string(entry, `${path}[${index}]`, 500));
  };
  if (input.schemaVersion !== 1) errors.push("schemaVersion: expected 1");
  if (!object(input.project)) errors.push("project: expected project context");
  const source = object(input.project) ? input.project : {};
  const project = {
    name: string(source.name, "project.name", 120),
    idea: string(source.idea, "project.idea", 8000),
    mode: source.mode,
    knownStack: string(source.knownStack === undefined ? "" : source.knownStack, "project.knownStack", 2000, false),
    demoTarget: string(source.demoTarget === undefined ? "" : source.demoTarget, "project.demoTarget", 2000, false),
    hoursLeft: source.hoursLeft ?? null,
    mustWork: list(source.mustWork, "project.mustWork"),
    outOfScope: list(source.outOfScope, "project.outOfScope"),
  };
  if (!MODES.includes(project.mode)) errors.push("project.mode: expected hackathon, side_project, or production");
  if (project.hoursLeft !== null && (!Number.isInteger(project.hoursLeft) || project.hoursLeft < 1 || project.hoursLeft > 2000)) {
    errors.push("project.hoursLeft: expected null or a positive integer at most 2000");
  }
  const roles = [];
  const slugs = new Set();
  if (!Array.isArray(input.roles) || input.roles.length < 1 || input.roles.length > 12) {
    errors.push("roles: expected 1 to 12 roles");
  } else input.roles.forEach((role, index) => {
    const path = `roles[${index}]`;
    if (!object(role)) { errors.push(`${path}: expected a role object`); return; }
    const slug = string(role.slug, `${path}.slug`, 40);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug !== slug.trim()) errors.push(`${path}.slug: expected lowercase kebab-case`);
    if (slugs.has(slug)) errors.push(`${path}.slug: duplicate role slug "${slug}"`);
    slugs.add(slug);
    roles.push({
      slug,
      name: string(role.name, `${path}.name`, 60),
      description: string(role.description, `${path}.description`, 2000),
      owns: list(role.owns, `${path}.owns`),
      mustCover: list(role.mustCover, `${path}.mustCover`),
    });
  });
  return errors.length ? { ok: false, errors } : { ok: true, manifest: { schemaVersion: 1, project, roles } };
}
