import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import JSZip from "jszip";

const room = {
  schemaVersion: 1,
  project: { name: "Browser fixture", idea: "Exercise actual browser onboarding.", mode: "side_project" },
  roles: [
    { slug: "frontend", name: "Frontend", description: "Own the UI." },
    { slug: "backend", name: "Backend", description: "Own the API." },
  ],
};

async function pastePublish(page: Page) {
  await page.goto("/");
  await page.getByText("Can't drag a file here? Paste it instead").click();
  await page.getByRole("textbox", { name: "Room JSON" }).fill(JSON.stringify(room));
  await page.getByRole("button", { name: "Publish this" }).click();
  await expect(page.getByRole("heading", { name: "✓ Room published" })).toBeVisible();
  return (await page.getByRole("link", { name: "host view" }).getAttribute("href"))!.split("/")[2];
}

test("file input publishes a real room and prints a working custom-origin browser republish command", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose grill-room.json").setInputFiles({ name: "grill-room.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(room)) });
  await expect(page.getByRole("heading", { name: "✓ Room published" })).toBeVisible();
  const hostPath = (await page.getByRole("link", { name: "host view" }).getAttribute("href"))!;
  const key = hostPath.split("/")[2];
  await expect(page.locator("code").filter({ hasText: "republish grill-room.json" })).toHaveText(`npx grill-with-me republish grill-room.json --key ${key} --token YOUR_HOST_TOKEN --base http://127.0.0.1:3108`);
  const token = (await page.getByRole("button", { name: "copy token", exact: true }).locator("..").locator("code").textContent())!;
  const temporaryRoot = await realpath(tmpdir());
  const consumer = await mkdtemp(join(temporaryRoot, "grill-browser-host-"));
  try {
    await writeFile(join(consumer, "grill-room.json"), JSON.stringify(room));
    const printed = (await page.locator("code").filter({ hasText: "republish grill-room.json" }).textContent())!;
    const args = printed.replace("YOUR_HOST_TOKEN", token).split(" ").slice(2);
    const result = await promisify(execFile)(process.execPath, [resolve("cli/grill.mjs"), ...args], { cwd: consumer, timeout: 20_000, windowsHide: true });
    expect(result.stdout).toContain(`Room ${key} is now v2`);
    expect(result.stdout).not.toContain(token);
  } finally {
    const actual = await realpath(consumer);
    const child = relative(temporaryRoot, actual);
    expect(child.startsWith("grill-browser-host-") && !child.includes(sep)).toBe(true);
    expect(resolve(temporaryRoot, child)).toBe(actual);
    await rm(actual, { recursive: true, force: true });
  }
  await page.goto(hostPath);
  await expect(page.getByText("pack v2", { exact: false })).toBeVisible();
  await expect(page.getByText("the first time and it saves it", { exact: false })).toHaveCount(0);
});

test("paste, clipboard, keyboard claim and takeover work against the actual server", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const key = await pastePublish(page);
  await page.getByRole("button", { name: "copy link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:3108/r/${key}`);
  await page.goto(`/r/${key}`);
  await page.getByRole("button", { name: "This one's mine", exact: true }).first().click();
  const name = page.getByRole("textbox", { name: "Your name, so the team sees who took this role" });
  await name.fill("Alice"); await name.press("Enter");
  await expect(page.getByText("taken by Alice", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Take this over", exact: true }).click();
  await name.fill("Bob"); await name.press("Enter");
  await expect(page.getByText("taken by Bob", { exact: true })).toBeVisible();
  const summary = await (await page.request.get(`/api/room/${key}`)).json();
  expect(summary.roles[0].claimedBy).toBe("Bob");
  expect(JSON.stringify(summary)).not.toContain("hostToken");
});

test("ZIP extraction stages JSON and instructions instead of overwriting repository files", async ({ page }) => {
  const key = await pastePublish(page);
  await page.goto(`/r/${key}`);
  await page.getByRole("button", { name: "This one's mine", exact: true }).first().click();
  await page.getByText("No terminal? Download the zip instead").click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download grill-${key}-frontend.zip`, exact: true }).click();
  const download = await downloading;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort()).toEqual(["grill-with-me-pack/IMPORT.md", "grill-with-me-pack/pack.json"]);
  const pack = JSON.parse(await zip.file("grill-with-me-pack/pack.json")!.async("string"));
  expect(pack.origin).toBe("http://127.0.0.1:3108"); expect(pack.roomKey).toBe(key);
  expect(pack.files.some((file: { path: string }) => file.path === "AGENTS.md")).toBe(true);
  expect(await zip.file("grill-with-me-pack/IMPORT.md")!.async("string")).toContain("preserving everything outside it");
});

test("invalid/oversize uploads fail locally and an interrupted publication reports an unknown outcome", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/rooms", async (route) => { calls++; await route.abort("connectionreset"); });
  await page.goto("/");
  await page.getByLabel("Choose grill-room.json").setInputFiles({ name: "grill-room.json", mimeType: "application/json", buffer: Buffer.alloc(256 * 1024 + 1, 32) });
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("256 KiB"); expect(calls).toBe(0);
  await page.getByText("Can't drag a file here? Paste it instead").click();
  const json = page.getByRole("textbox", { name: "Room JSON" });
  await json.fill("{invalid"); await page.getByRole("button", { name: "Publish this" }).click();
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("JSON"); expect(calls).toBe(0);
  await json.fill(JSON.stringify(room)); await page.getByRole("button", { name: "Publish this" }).click();
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("A room may have been created"); expect(calls).toBe(1);
  await expect(page.getByRole("alert", { name: "Publication status" })).not.toContainText("was not created");
});

test("failed claims and malformed publish acknowledgements produce readable recovery states", async ({ page }) => {
  const key = await pastePublish(page);
  await page.goto(`/r/${key}`);
  await page.route("**/claim", (route) => route.abort("connectionreset"));
  await page.getByRole("button", { name: "This one's mine", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Your name, so the team sees who took this role" }).fill("Alice");
  await page.getByRole("button", { name: "tell the team", exact: true }).click();
  await expect(page.getByText("Couldn't confirm that claim", { exact: false })).toBeVisible();
  await page.goto("/");
  await page.route("**/api/rooms", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ key: "../../unsafe", hostToken: "fake", url: "https://other.example" }) }));
  await page.getByText("Can't drag a file here? Paste it instead").click();
  await page.getByRole("textbox", { name: "Room JSON" }).fill(JSON.stringify(room));
  await page.getByRole("button", { name: "Publish this" }).click();
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("Could not confirm publication");
  await expect(page.getByRole("heading", { name: "✓ Room published" })).toHaveCount(0);
});

test("stalled publication is cancelled under one deadline and cannot trigger duplicate clicks", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/rooms", () => { calls++; });
  await page.goto("/");
  await page.getByText("Can't drag a file here? Paste it instead").click();
  await page.getByRole("textbox", { name: "Room JSON" }).fill(JSON.stringify(room));
  const started = page.waitForRequest("**/api/rooms");
  await page.getByRole("button", { name: "Publish this" }).click(); await started;
  await expect(page.getByRole("button", { name: "Publish this" })).toBeDisabled();
  await page.clock.fastForward(15_000);
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("Could not confirm publication");
  await expect(page.getByRole("button", { name: "Publish this" })).toBeEnabled();
  expect(calls).toBe(1);
});

test("an oversized decoded response is rejected without rendering raw reply content", async ({ page }) => {
  await page.route("**/api/rooms", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ private: "DO_NOT_RENDER", padding: "x".repeat(8 * 1024 * 1024) }) }));
  await page.goto("/");
  await page.getByText("Can't drag a file here? Paste it instead").click();
  await page.getByRole("textbox", { name: "Room JSON" }).fill(JSON.stringify(room));
  await page.getByRole("button", { name: "Publish this" }).click();
  await expect(page.getByRole("alert", { name: "Publication status" })).toContainText("Could not confirm publication");
  await expect(page.getByText("DO_NOT_RENDER")).toHaveCount(0);
});

test("untrusted forwarded origins cannot enter links or printed shell commands", async ({ request }) => {
  const response = await request.get("/", { headers: {
    "x-forwarded-host": "evil.example;touch sentinel", "x-forwarded-proto": "http",
  } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).not.toContain("evil.example");
  expect(html).not.toContain("touch sentinel");
  expect(html).toContain("--base http://127.0.0.1:3108");
});
