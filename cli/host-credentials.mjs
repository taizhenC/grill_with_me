/** Credential-bearing operations support origin URLs, not arbitrary API paths. */
export function normalizeHostOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("host destination must be a valid HTTP(S) origin");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("host destination must be an origin without credentials, a path, query, or fragment");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("host credentials require HTTPS; HTTP is allowed only for loopback development");
  }
  return url.origin;
}

export function validateHostRoomKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new Error("invalid room key for host operation");
  }
  return value;
}

export function validateHostToken(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(value)) {
    throw new Error("invalid host token; supply a nonempty URL-safe token");
  }
  return value;
}

/** Explicit credentials apply to this call; saved credentials have a binding. */
export function selectHostToken(config, base, roomKey, explicitToken) {
  if (explicitToken !== undefined) return validateHostToken(explicitToken);
  if (!config.hostToken) return null;
  let savedOrigin;
  try {
    savedOrigin = normalizeHostOrigin(config.base);
  } catch {
    throw new Error("saved host token has no valid origin binding; supply an explicit --token");
  }
  if (savedOrigin !== base || config.roomKey !== roomKey) {
    throw new Error("saved host token belongs to a different origin or room; supply an explicit --token for this destination");
  }
  return validateHostToken(config.hostToken);
}
