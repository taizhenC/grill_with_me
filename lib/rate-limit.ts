/**
 * Per-IP rate limit for room creation (P1-1).
 *
 * In-memory sliding window. On serverless this is per-instance, so it's a
 * best-effort brake on casual abuse, not a security boundary — the real
 * exposure is storage only (the app spends no LLM tokens). Move to a
 * durable counter if this app ever holds anything worth farming.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_CREATES_PER_WINDOW = 10;

const hits = new Map<string, number[]>();

export function allowCreate(ip: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_CREATES_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= cutoff)) hits.delete(key);
    }
  }
  return true;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

/** Test hook. */
export function resetRateLimit(): void {
  hits.clear();
}
