import { describe, expect, it } from "vitest";
import { readRequestText } from "@/lib/request-body";
import { MAX_ROOM_JSON_BYTES, parseGrillRoom } from "@/lib/schema";

const encode = (text: string) => new TextEncoder().encode(text);
const lengthHeaders: Record<string, string>[] = [
  {}, { "content-length": "1" }, { "content-length": "invalid" },
];

function streamedRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
  cancel?: () => void | Promise<void>,
): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel,
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", body, headers, duplex: "half",
  };
  return new Request("http://test/body", init);
}

describe("bounded request bodies", () => {
  it("decodes UTF-8 across chunk boundaries at the exact byte limit", async () => {
    const bytes = encode("a🌲b");
    const result = await readRequestText(
      streamedRequest([bytes.slice(0, 3), bytes.slice(3)]), bytes.length,
    );
    expect(result).toEqual({ ok: true, text: "a🌲b" });
  });

  it.each(lengthHeaders)(
    "enforces received byte limits with header %j", async (headers) => {
      const result = await readRequestText(
        streamedRequest([encode("1234"), encode("5")], headers), 4,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.response.status).toBe(413);
    },
  );

  it("rejects an advertised oversized body without reading it", async () => {
    const body = new ReadableStream<Uint8Array>({ pull() {} });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST", body, duplex: "half", headers: { "content-length": "999999" },
    };
    const result = await readRequestText(new Request("http://test/body", init), 4);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
  });

  it("rejects malformed and incomplete UTF-8", async () => {
    for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xf0, 0x9f])]) {
      const result = await readRequestText(streamedRequest([bytes]), 4);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.response.status).toBe(400);
    }
  });

  it("returns at its deadline even if the peer never finishes cancellation", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull() {}, cancel: () => new Promise<void>(() => {}),
    });
    const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half" };
    const result = await readRequestText(new Request("http://test/body", init), 4, 10);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(408);
  });

  it("returns a readable error when the request is aborted", async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({ pull() {} });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST", body, duplex: "half", signal: controller.signal,
    };
    const pending = readRequestText(new Request("http://test/body", init), 4);
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });

  it("uses UTF-8 bytes in the shared browser/server room parser", () => {
    const oversized = "🌲".repeat(Math.floor(MAX_ROOM_JSON_BYTES / 4) + 1);
    expect(oversized.length).toBeLessThan(MAX_ROOM_JSON_BYTES);
    const result = parseGrillRoom(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain(`file is ${encode(oversized).length} bytes`);
  });
});
