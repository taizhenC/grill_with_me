import { afterEach, describe, expect, it, vi } from "vitest";
import { storageRequest, StorageUnavailableError, unavailableOperation } from "@/lib/storage-failure";

afterEach(() => vi.useRealTimers());

describe("bounded storage failures", () => {
  it("bounds a stalled operation even when the transport ignores cancellation", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const result = storageRequest("republish", (value) => { signal = value; return new Promise(() => {}); });
    const rejection = expect(result).rejects.toMatchObject({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "republish" });
    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
    expect(signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not forward a rejected transport's message or cause", async () => {
    const secret = "host-token-and-private-brief";
    const failure = await storageRequest("read", async () => { throw new Error(secret); }).catch((error) => error);
    expect(failure).toBeInstanceOf(StorageUnavailableError);
    expect(`${failure.stack}${JSON.stringify(failure)}`).not.toContain(secret);
    expect(failure.cause).toBeUndefined();
  });

  it("recognizes a fixed code across module bundles and rejects arbitrary operations", () => {
    expect(unavailableOperation({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "claim" })).toBe("claim");
    expect(unavailableOperation({ code: "GRILL_STORAGE_UNAVAILABLE", operation: "secret-brief" })).toBeNull();
    expect(unavailableOperation(new Error("backend"))).toBeNull();
  });
});
