import { headers } from "next/headers";

/**
 * The origin this request arrived on. Every command the app prints has to
 * work when pasted, including from a local dev server or a fork on someone
 * else's domain — a copyable command that silently talks to the wrong
 * deployment is worse than no command at all.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
