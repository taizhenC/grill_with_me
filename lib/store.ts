import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GrillRoom } from "./schema";
import { generateRoomKey, generateHostToken } from "./keys";
import { storeConfig } from "./store-config";
import type { PublicationRequest, PublicationResult } from "./publication";
import { PublicationError, PUBLICATION_CLOCK_SKEW_MS } from "../cli/publication-capability.mjs";

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
  create(room: GrillRoom, publication?: PublicationRequest): Promise<PublicationResult>;
  get(key: string): Promise<StoredRoom | null>;
  /** Replace the room content; bumps version. Requires the host token. */
  republish(key: string, hostToken: string, room: GrillRoom): Promise<number>;
  claim(key: string, roleSlug: string, displayName: string): Promise<void>;
  /** Physically remove a room, including an expired room, with its host token. */
  delete(key: string, hostToken: string): Promise<void>;
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
  private publications = new Map<string, PublicationRequest & { stored: StoredRoom | null }>();

  async delete(key: string, hostToken: string) {
    const stored = this.rooms.get(key);
    if (!stored) throw new NotFoundError(key);
    if (stored.hostToken !== hostToken) throw new ForbiddenError();
    for (const publication of this.publications.values()) if (publication.stored === stored) publication.stored = null;
    this.rooms.delete(key);
  }

  /** Development maintenance counterpart; expiry alone only hides rooms. */
  purgeExpired(limit: number): number {
    let deleted = 0;
    for (const [key, stored] of this.rooms) {
      if (deleted >= limit) break;
      if (isExpired(stored)) {
        for (const publication of this.publications.values()) if (publication.stored === stored) publication.stored = null;
        this.rooms.delete(key); deleted++;
      }
    }
    return deleted;
  }

  purgePublications(limit: number): number {
    let deleted = 0;
    for (const [hash, publication] of this.publications) {
      if (deleted >= limit) break;
      if (Date.parse(publication.expiresAt) <= Date.now()) { this.publications.delete(hash); deleted++; }
    }
    return deleted;
  }

  async create(room: GrillRoom, publication?: PublicationRequest): Promise<PublicationResult> {
    if (publication) {
      if (Date.parse(publication.issuedAt) > Date.now() + PUBLICATION_CLOCK_SKEW_MS) throw new PublicationError("publication_invalid", "publication clock is ahead of the service", 400);
      if (Date.parse(publication.expiresAt) <= Date.now()) throw new PublicationError("publication_gone", "publication recovery window has expired", 410);
      const existing = this.publications.get(publication.hash);
      if (existing) {
        if (existing.origin !== publication.origin || existing.payloadHash !== publication.payloadHash) throw new PublicationError("publication_conflict", "publication recovery belongs to another origin or payload", 409);
        const stored = existing.stored && this.rooms.get(existing.stored.key);
        if (!stored || stored !== existing.stored || isExpired(stored)) throw new PublicationError("publication_gone", "publication room was removed or expired", 410);
        return { key: stored.key, hostToken: stored.hostToken, recovery: { expiresAt: existing.expiresAt, replayed: true } };
      }
    }
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
      if (publication) this.publications.set(publication.hash, { ...publication, stored: this.rooms.get(key)! });
      return { key, hostToken, ...(publication ? { recovery: { expiresAt: publication.expiresAt, replayed: false } } : {}) };
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

  async delete(key: string, hostToken: string) {
    const { data, error } = await this.db.rpc("delete_room", {
      p_key: key, p_host_token: hostToken,
    }).abortSignal(AbortSignal.timeout(5000));
    if (error?.code === "PT404") throw new NotFoundError(key);
    if (error?.code === "PT403") throw new ForbiddenError();
    if (error || data !== true) throw new Error("room deletion unavailable");
  }

  async create(room: GrillRoom, publication?: PublicationRequest): Promise<PublicationResult> {
    const hostToken = generateHostToken();
    for (let attempt = 0; attempt < ROOM_CREATION_ATTEMPTS; attempt++) {
      const key = generateRoomKey();
      if (publication) {
        const { data, error } = await this.db.rpc("create_room_recoverable", {
          p_capability_hash: publication.hash, p_payload_hash: publication.payloadHash,
          p_origin: publication.origin, p_issued_at: publication.issuedAt,
          p_key: key, p_host_token: hostToken, p_room: room,
        }).abortSignal(AbortSignal.timeout(5000));
        if (error?.code === "PT400") throw new PublicationError("publication_invalid", "invalid publication recovery capability or clock", 400);
        if (error?.code === "PT409") throw new PublicationError("publication_conflict", "publication recovery belongs to another origin or payload", 409);
        if (error?.code === "PT410") throw new PublicationError("publication_gone", "publication recovery expired or its room was removed", 410);
        if (error?.code === "23505" && error.message === 'duplicate key value violates unique constraint "rooms_key_key"') continue;
        if (error) throw new Error("publication recovery backend unavailable");
        if (!data || typeof data.key !== "string" || typeof data.hostToken !== "string" ||
            typeof data.recovery?.replayed !== "boolean" || Date.parse(data.recovery.expiresAt) !== Date.parse(publication.expiresAt)) {
          throw new Error("publication recovery backend returned an invalid result");
        }
        return { key: data.key, hostToken: data.hostToken, recovery: { replayed: data.recovery.replayed, expiresAt: publication.expiresAt } };
      }
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
