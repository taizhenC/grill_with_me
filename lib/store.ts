import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GrillRoom } from "./schema";
import { generateRoomKey, generateHostToken } from "./keys";
import { storeConfig } from "./store-config";

/**
 * Persistence for rooms. Two implementations behind one interface:
 *
 * - SupabaseStore — production. All access goes through the service key on
 *   the server (decision: no client-side DB, no RLS to fight in v1).
 * - MemoryStore — explicitly selected development/tests. Same semantics.
 *
 * Selected lazily on first use. Supabase is required by default; local
 * memory needs GRILL_STORE=memory and NODE_ENV=development or test.
 */

export const ROOM_TTL_DAYS = 30;
/** Bound retries even if randomness is broken or the key space is exhausted. */
export const ROOM_CREATION_ATTEMPTS = 5;

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
  return new Date(stored.expiresAt).getTime() <= Date.now();
}

/* ------------------------------------------------------------------ */

export class MemoryStore implements RoomStore {
  private rooms = new Map<string, StoredRoom>();

  async create(room: GrillRoom) {
    for (let attempt = 0; attempt < ROOM_CREATION_ATTEMPTS; attempt++) {
      const key = generateRoomKey();
      // Expired entries still own their keys until purged; never revive a link.
      if (this.rooms.has(key)) continue;
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
    throw new Error("room creation failed: unique key retries exhausted");
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
    stored.room = structuredClone(room);
    stored.claims = Object.fromEntries(
      Object.entries(stored.claims).filter(([slug]) =>
        room.roles.some((role) => role.slug === slug),
      ),
    );
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
    const hostToken = generateHostToken();
    for (let attempt = 0; attempt < ROOM_CREATION_ATTEMPTS; attempt++) {
      const key = generateRoomKey();
      const { error } = await this.db.from("rooms").insert({
        key,
        host_token: hostToken,
        version: 1,
        room,
        claims: {},
        expires_at: expiry(),
      });
      if (!error) return { key, hostToken };
      // 0001_rooms.sql gives key its own UNIQUE constraint; rooms_pkey is id.
      // PostgREST exposes the constraint name in PostgreSQL's error message.
      const keyCollision = error.code === "23505" &&
        error.message === 'duplicate key value violates unique constraint "rooms_key_key"';
      if (!keyCollision) throw new Error(`room insert failed: ${error.message}`);
    }
    throw new Error("room creation failed: unique key retries exhausted");
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
    const { data, error } = await this.db.rpc("republish_room", {
      p_key: key,
      p_host_token: hostToken,
      p_room: room,
    });
    if (error?.code === "PT404") throw new NotFoundError(key);
    if (error?.code === "PT403") throw new ForbiddenError();
    if (error) throw new Error(`republish failed: ${error.message}`);
    if (typeof data !== "number" || !Number.isInteger(data) || data < 2) {
      throw new Error("republish failed: database did not return a committed version");
    }
    return data;
  }

  async claim(key: string, roleSlug: string, displayName: string) {
    const { error } = await this.db.rpc("claim_room", {
      p_key: key,
      p_role_slug: roleSlug,
      p_display_name: displayName,
    });
    if (error?.code === "PT404") throw new NotFoundError(`room or role ${roleSlug}`);
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
  const config = storeConfig(process.env);
  g[GLOBAL_KEY] =
    config.mode === "supabase"
      ? new SupabaseStore(
          createClient(config.url, config.serviceKey, { auth: { persistSession: false } }),
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
