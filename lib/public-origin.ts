import { isIP } from "node:net";

type Environment = Record<string, string | undefined>;

/** Canonical origins must also be safe as literal arguments in printed commands. */
function validatedOrigin(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("public origin must contain only an origin");
  const hostname = url.hostname;
  const ip = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  const dns = hostname.length <= 253 && hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
  if (!isIP(ip) && !dns) throw new Error("public origin has an invalid hostname");
  const loopback = hostname === "localhost" || hostname === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new Error("public origin requires HTTPS except for loopback development");
  return url;
}

/** Ignore forwarded origin headers unless a trusted ingress explicitly enables them. */
export function publicOrigin(headers: Pick<Headers, "get">, env: Environment): string {
  try {
    if (env.GRILL_PUBLIC_ORIGIN) return validatedOrigin(env.GRILL_PUBLIC_ORIGIN).origin;
    const trusted = env.GRILL_TRUST_PROXY === "1";
    const host = (trusted ? headers.get("x-forwarded-host") : null) ?? headers.get("host");
    if (!host || host.length > 300 || /[^a-z0-9.\[\]:-]/i.test(host)) throw new Error("invalid host");
    const parsed = validatedOrigin(`https://${host}`);
    const loopback = parsed.hostname === "localhost" || parsed.hostname === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(parsed.hostname);
    const forwarded = trusted ? headers.get("x-forwarded-proto") : null;
    if (forwarded !== null && forwarded !== "https" && forwarded !== "http") throw new Error("invalid protocol");
    return validatedOrigin(`${forwarded ?? (loopback ? "http" : "https")}://${parsed.host}`).origin;
  } catch {
    // Do not echo attacker-supplied headers or configuration into UI/log errors.
    throw new Error("public origin is unavailable; configure GRILL_PUBLIC_ORIGIN or a valid trusted ingress");
  }
}
