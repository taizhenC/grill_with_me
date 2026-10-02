export class StoreConfigurationError extends Error {}

type StoreConfig =
  | { mode: "memory" }
  | { mode: "supabase"; url: string; serviceKey: string };

/** Lazy validation keeps builds secret-free and refuses volatile production data. */
export function storeConfig(env: Record<string, string | undefined>): StoreConfig {
  const mode = env.GRILL_STORE ?? "supabase";
  if (mode === "memory") {
    if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
      throw new StoreConfigurationError(
        "GRILL_STORE=memory is only supported in development or tests",
      );
    }
    return { mode };
  }
  if (mode !== "supabase") {
    throw new StoreConfigurationError("GRILL_STORE must be supabase or memory");
  }
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new StoreConfigurationError(
      "Room storage requires SUPABASE_URL and SUPABASE_SERVICE_KEY",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new StoreConfigurationError("SUPABASE_URL must be an HTTP(S) URL");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username || parsed.password || parsed.search || parsed.hash
  ) {
    throw new StoreConfigurationError("SUPABASE_URL must be an HTTP(S) URL without credentials, query, or fragment");
  }
  const localDevelopment =
    (env.NODE_ENV === "development" || env.NODE_ENV === "test") &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localDevelopment) {
    throw new StoreConfigurationError(
      "SUPABASE_URL requires HTTPS; HTTP is allowed only for loopback development or tests",
    );
  }
  return { mode, url, serviceKey };
}
