export const MAX_RESPONSE_BYTES: number;
export class HttpRequestError extends Error {
  outcomeUnknown: boolean;
  constructor(message: string, outcomeUnknown?: boolean);
}
export function fetchJson(
  url: string, init?: RequestInit,
  options?: { maxBytes?: number; timeoutMs?: number },
): Promise<{ response: Response; body: Record<string, unknown> }>;
