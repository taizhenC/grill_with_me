import { headers } from "next/headers";
import { publicOrigin } from "./public-origin";

/**
 * The origin this request arrived on. Every command the app prints has to
 * work when pasted, including from a local dev server or a fork on someone
 * else's domain — a copyable command that silently talks to the wrong
 * deployment is worse than no command at all.
 */
export async function requestOrigin(): Promise<string> {
  return publicOrigin(await headers(), process.env);
}
