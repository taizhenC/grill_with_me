import { expect, it } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { MAX_RESPONSE_BYTES } from "../cli/http.mjs";

it("CLI host rejects a large download before installing files", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "grill-http-"));
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(`{"files":[],"padding":"${"x".repeat(MAX_RESPONSE_BYTES)}"}`);
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no HTTP fixture port");
    const CLI = process.env.GRILL_CLI_TEST_BIN ?? join(__dirname, "../cli/grill.mjs");
    await expect(promisify(execFile)(process.execPath,
      [CLI, "host", "--base", `http://127.0.0.1:${address.port}`], { cwd: directory }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("too large") });
    expect(await readdir(directory)).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const actual = await realpath(directory);
    const child = relative(temporaryRoot, actual);
    expect(child.startsWith("grill-http-") && !child.includes(sep)).toBe(true);
    await rm(actual, { recursive: true, force: true });
  }
});
