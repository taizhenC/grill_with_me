import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { fetchJson, HttpRequestError, MAX_RESPONSE_BYTES } from "../cli/http.mjs";

let server: Server;
let base: string;
beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    switch (request.url) {
      case "/ok": response.end(JSON.stringify({ answer: "🌲" })); break;
      case "/big-header": response.writeHead(200, { "content-length": String(MAX_RESPONSE_BYTES + 1) }); response.end(); break;
      case "/chunked": response.write('{"text":"'); response.end(`${"x".repeat(128)}"}`); break;
      case "/compressed": response.setHeader("content-encoding", "gzip"); response.end(gzipSync(JSON.stringify({ text: "x".repeat(128) }))); break;
      case "/headers-stall": break;
      case "/body-stall": response.write('{"partial":'); break;
      case "/redirect": response.writeHead(307, { location: `${base}/ok` }); response.end(); break;
      case "/invalid": response.end("<html>not JSON</html>"); break;
      case "/bad-utf8": response.end(Buffer.from([0xff])); break;
      case "/array": response.end("[]"); break;
      default: response.writeHead(429); response.end(JSON.stringify({ error: "try later" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no HTTP fixture port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("bounded CLI HTTP", () => {
  it("returns real JSON and HTTP status", async () => {
    expect((await fetchJson(`${base}/ok`)).body).toEqual({ answer: "🌲" });
    const rejected = await fetchJson(`${base}/limited`);
    expect(rejected.response.status).toBe(429);
    expect(rejected.body.error).toBe("try later");
  });

  it.each(["big-header", "chunked", "compressed"])(
    "rejects oversized %s responses, including decoded compressed bytes", async (path) => {
      await expect(fetchJson(`${base}/${path}`, {}, { maxBytes: 64 })).rejects.toThrow("too large");
    },
  );

  it.each(["headers-stall", "body-stall"])("bounds the whole %s request", async (path) => {
    await expect(fetchJson(`${base}/${path}`, {}, { timeoutMs: 30 })).rejects.toThrow("timed out");
  });

  it.each(["invalid", "bad-utf8", "array"])("rejects malformed %s replies", async (path) => {
    await expect(fetchJson(`${base}/${path}`)).rejects.toBeInstanceOf(HttpRequestError);
  });

  it("does not follow a response redirect", async () => {
    await expect(fetchJson(`${base}/redirect`)).rejects.toThrow("could not complete");
  });

  it("marks an interrupted mutation as an unknown outcome", async () => {
    await expect(fetchJson(`${base}/body-stall`, { method: "POST" }, { timeoutMs: 30 }))
      .rejects.toMatchObject({ outcomeUnknown: true });
  });

  it("rejects a pre-aborted request before reaching the transport", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(fetchJson(`${base}/ok`, { signal: controller.signal })).rejects.toThrow("interrupted");
  });

  it.each(["http://remote.example/api", "http://localhost.example/api", "https://user:secret@remote.example/api"])(
    "rejects unsafe transport %s", async (url) => {
      await expect(fetchJson(url)).rejects.toThrow(/HTTPS|credentials/);
    },
  );

});
