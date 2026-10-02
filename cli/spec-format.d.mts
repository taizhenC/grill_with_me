export const SPEC_HEADINGS: readonly string[];
export type SpecValidation = {
  ok: boolean;
  missing: string[];
  thin: string[];
  errors: string[];
};
export function validateSpec(markdown: string): SpecValidation;
export function specPath(roleSlug: string): string;
