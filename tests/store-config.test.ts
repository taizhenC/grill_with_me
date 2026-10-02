import { afterEach, describe, expect, it, vi } from "vitest";
import { getStore, MemoryStore, setStore, SupabaseStore } from "@/lib/store";
import { storeConfig, StoreConfigurationError } from "@/lib/store-config";

afterEach(() => {
  setStore(null);
  vi.unstubAllEnvs();
});

describe("storage configuration", () => {
  it.each(["production", "development", "test"])(
    "requires durable credentials by default in %s",
    (NODE_ENV) => {
      expect(() => storeConfig({ NODE_ENV })).toThrow(StoreConfigurationError);
      expect(() => storeConfig({ NODE_ENV, SUPABASE_URL: "https://test.supabase.co" })).toThrow(StoreConfigurationError);
      expect(() => storeConfig({ NODE_ENV, SUPABASE_SERVICE_KEY: "secret" })).toThrow(StoreConfigurationError);
    },
  );

  it.each(["development", "test"])("accepts explicit memory in %s", (NODE_ENV) => {
    expect(storeConfig({ NODE_ENV, GRILL_STORE: "memory" })).toEqual({ mode: "memory" });
  });

  it.each(["production", undefined, "staging"])("rejects volatile memory in %s", (NODE_ENV) => {
    expect(() => storeConfig({ NODE_ENV, GRILL_STORE: "memory" })).toThrow(StoreConfigurationError);
  });

  it("refuses unsupported modes and malformed Supabase URLs without exposing secrets", () => {
    expect(() => storeConfig({ GRILL_STORE: "memroy" })).toThrow(StoreConfigurationError);
    for (const SUPABASE_URL of ["bad", "file:///test", "https://user:password@test.supabase.co", "https://test.supabase.co?token=secret", "https://test.supabase.co#secret"]) {
      expect(() => storeConfig({ SUPABASE_URL, SUPABASE_SERVICE_KEY: "private-key" })).toThrow(StoreConfigurationError);
      expect(() => storeConfig({ SUPABASE_URL, SUPABASE_SERVICE_KEY: "private-key" })).not.toThrow("private-key");
    }
  });

  it("chooses a Supabase store without connecting during construction", () => {
    vi.stubEnv("GRILL_STORE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "private-service-key");
    expect(getStore()).toBeInstanceOf(SupabaseStore);
  });

  it("requires HTTPS in production and permits HTTP only for loopback development/test", () => {
    const credentials = { SUPABASE_SERVICE_KEY: "private-key" };
    for (const NODE_ENV of ["production", undefined, "staging"]) {
      expect(() => storeConfig({ ...credentials, NODE_ENV, SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow(StoreConfigurationError);
    }
    for (const NODE_ENV of ["development", "test"]) {
      for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
        expect(storeConfig({ ...credentials, NODE_ENV, SUPABASE_URL: `http://${host}:54321` }).mode).toBe("supabase");
      }
      for (const host of ["remote.example", "localhost.example", "127.0.0.1.example", "192.168.1.1"]) {
        expect(() => storeConfig({ ...credentials, NODE_ENV, SUPABASE_URL: `http://${host}:54321` })).toThrow(StoreConfigurationError);
      }
    }
  });

  it("does not cache failed configuration, and shares an explicitly selected memory store", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GRILL_STORE", "memory");
    expect(() => getStore()).toThrow(StoreConfigurationError);
    vi.stubEnv("NODE_ENV", "development");
    const store = getStore();
    expect(store).toBeInstanceOf(MemoryStore);
    expect(getStore()).toBe(store);
  });

  it("preserves the test store injection hook", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GRILL_STORE", "memory");
    const store = new MemoryStore();
    setStore(store);
    expect(getStore()).toBe(store);
  });
});
