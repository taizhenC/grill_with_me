export const PUBLICATION_WINDOW_MS: number;
export const PUBLICATION_CLOCK_SKEW_MS: number;
export class PublicationError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number);
}
export function readPublicationCapability(value: unknown, now?: number): { issuedAt: number; expiresAt: number };
export function mintPublicationCapability(now?: number): string;
