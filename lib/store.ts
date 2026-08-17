import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GrillRoom } from "./schema";
import { generateRoomKey, generateHostToken } from "./keys";

/**
 * Persistence for rooms. Two implementations behind one interface:
 *
 * - SupabaseStore — production. All access goes through the service key on
 *   the server (decision: no client-side DB, no RLS to fight in v1).
 * - MemoryStore — tests and credential-less local dev. Same semantics.
 *
 * Chosen once at startup: Supabase when SUPABASE_URL + SUPABASE_SERVICE_KEY
 * are set, memory otherwise.
 */

export const ROOM_TTL_DAYS = 30;

export type StoredRoom = {
  key: string;
  hostToken: string;
  version: number;
  room: GrillRoom;
  /** roleSlug -> display name of whoever claimed it. Informational only. */
  claims: Record<string, string>;
  createdAt: string;
  expiresAt: string;
};

/** What non-host callers may see. Never leaks hostToken. */
export type PublicRoom = Omit<StoredRoom, "hostToken">;

export interface RoomStore {
  create(room: GrillRoom): Promise<{ key: string; hostToken: string }>;
  get(key: string): Promise<StoredRoom | null>;
  /** Replace the room content; bumps version. Requires the host token. */
  republish(key: string, hostToken: string, room: GrillRoom): Promise<number>;
  claim(key: string, roleSlug: string, displayName: string): Promise<void>;
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

export function toPublic(stored: StoredRoom): PublicRoom {
  const { hostToken: _hostToken, ...pub } = stored;
  return pub;
}

function expiry(): string {
  return new Date(Date.now() + ROOM_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(stored: StoredRoom): boolean {
  return new Date(stored.expiresAt).getTime() < Date.now();
}

/* ------------------------------------------------------------------ */

export class MemoryStore implements RoomStore {
  private rooms = new Map<string, StoredRoom>();

  async create(room: GrillRoom) {
    const key = generateRoomKey();
    const hostToken = generateHostToken();
    this.rooms.set(key, {
      key,
      hostToken,
      version: 1,
      room,
      claims: {},
      createdAt: new Date().toISOString(),
      expiresAt: expiry(),
    });
    return { key, hostToken };
  }

  async get(key: string) {
    const stored = this.rooms.get(key);
    if (!stored || isExpired(stored)) return null;
    return structuredClone(stored);
  }

  async republish(key: string, hostToken: string, room: GrillRoom) {
    const stored = this.rooms.get(key);
    if (!stored || isExpired(stored)) throw new NotFoundError(key);
    if (stored.hostToken !== hostToken) throw new ForbiddenError();
    stored.room = room;
    stored.version += 1;
    return stored.version;
  }

  async claim(key: string, roleSlug: string, displayName: string) {
    const stored = this.rooms.get(key);
    if (!stored || isExpired(stored)) throw new NotFoundError(key);
    if (!stored.room.roles.some((r) => r.slug === roleSlug)) {
      throw new NotFoundError(`role ${roleSlug}`);
    }
    stored.claims[roleSlug] = displayName;
  }
}

/* ------------------------------------------------------------------ */

type RoomRow = {
  key: string;
  host_token: string;
  version: number;
  room: GrillRoom;
  claims: Record<string, string>;
  created_at: string;
  expires_at: string;
};

function fromRow(row: RoomRow): StoredRoom {
  return {
    key: row.key,
    hostToken: row.host_token,
    version: row.version,
    room: row.room,
    claims: row.claims ?? {},
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export class SupabaseStore implements RoomStore {
  constructor(private db: SupabaseClient) {}

  async create(room: GrillRoom) {
    const key = generateRoomKey();
    const hostToken = generateHostToken();
    const { error } = await this.db.from("rooms").insert({
      key,
      host_token: hostToken,
      version: 1,
      room,
      claims: {},
      expires_at: expiry(),
    });
    if (error) throw new Error(`room insert failed: ${error.message}`);
    return { key, hostToken };
  }

  async get(key: string) {
    const { data, error } = await this.db
      .from("rooms")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`room read failed: ${error.message}`);
    if (!data) return null;
    const stored = fromRow(data as RoomRow);
    return isExpired(stored) ? null : stored;
  }

  async republish(key: string, hostToken: string, room: GrillRoom) {
    const stored = await this.get(key);
    if (!stored) throw new NotFoundError(key);
    if (stored.hostToken !== hostToken) throw new ForbiddenError();
    const next = stored.version + 1;
    const { error } = await this.db
      .from("rooms")
      .update({ room, version: next })
      .eq("key", key)
      .eq("version", stored.version); // optimistic: concurrent republish loses
    if (error) throw new Error(`republish failed: ${error.message}`);
    return next;
  }

  async claim(key: string, roleSlug: string, displayName: string) {
    const stored = await this.get(key);
    if (!stored) throw new NotFoundError(key);
    if (!stored.room.roles.some((r) => r.slug === roleSlug)) {
      throw new NotFoundError(`role ${roleSlug}`);
    }
    const claims = { ...stored.claims, [roleSlug]: displayName };
    const { error } = await this.db
      .from("rooms")
      .update({ claims })
      .eq("key", key);
    if (error) throw new Error(`claim failed: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */

/**
 * The singleton lives on globalThis, not at module level: Next.js compiles
 * pages and route handlers into separate bundles, each with its own module
 * instance, so a module-level singleton would give the join page a different
 * MemoryStore than the publish API. With Supabase configured this wouldn't
 * matter (state is external); for credential-less dev it's the difference
 * between working and 404ing.
 */
const GLOBAL_KEY = Symbol.for("grill-with-me.store");

type GlobalWithStore = { [GLOBAL_KEY]?: RoomStore };

export function getStore(): RoomStore {
  const g = globalThis as GlobalWithStore;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY];
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  g[GLOBAL_KEY] =
    url && serviceKey
      ? new SupabaseStore(
          createClient(url, serviceKey, { auth: { persistSession: false } }),
        )
      : new MemoryStore();
  return g[GLOBAL_KEY];
}

/** Test hook. */
export function setStore(store: RoomStore | null): void {
  const g = globalThis as GlobalWithStore;
  if (store === null) delete g[GLOBAL_KEY];
  else g[GLOBAL_KEY] = store;
}
