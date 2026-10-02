/**
 * The fixed structure of a role spec (P0-2).
 *
 * This is the load-bearing agreement in the whole pipeline: MY-ROLE.md asks
 * the member's agent to write these headings, and merge-contract refuses to
 * parse anything that doesn't carry them. One list, imported by both sides,
 * so they can never drift.
 */
export { SPEC_HEADINGS, validateSpec, specPath } from "../cli/spec-format.mjs";
export type { SpecValidation } from "../cli/spec-format.mjs";
