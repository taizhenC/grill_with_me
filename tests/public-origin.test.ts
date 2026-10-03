import { describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/public-origin";
import { joinCommand } from "@/lib/commands";

const resolveOrigin = (headers: Record<string, string>, env: Record<string, string> = {}) => publicOrigin(new Headers(headers), env);

describe("public origins and printed commands", () => {
  it("ignores untrusted forwarded values and normalizes the actual host", () => {
    expect(resolveOrigin({ host: "Beta.Example:443", "x-forwarded-host": "evil.example;touch sentinel", "x-forwarded-proto": "http" })).toBe("https://beta.example");
  });
  it("uses an explicit configured origin regardless of incoming headers", () => {
    expect(resolveOrigin({ host: "evil.example" }, { GRILL_PUBLIC_ORIGIN: "https://Beta.Example:443/" })).toBe("https://beta.example");
  });
  it.each(["localhost:3000", "127.0.0.1:3000", "127.15.2.3:3000", "[::1]:3000"])("supports literal loopback %s", (host) => {
    expect(resolveOrigin({ host })).toBe(`http://${host}`);
  });
  it("accepts forwarded origin only behind explicitly trusted sanitized ingress", () => {
    expect(resolveOrigin({ host: "internal.example", "x-forwarded-host": "public.example:443", "x-forwarded-proto": "https" }, { GRILL_TRUST_PROXY: "1" })).toBe("https://public.example");
  });
  it.each(["evil.example;touch sentinel", "$(touch).example", "evil`command`.example", "evil.example/path", "evil.example?secret", "user@evil.example", "evil.example,public.example", "-bad.example", "bad_.example"])("rejects unsafe host %s without echoing it", (host) => {
    expect(() => resolveOrigin({ host })).toThrow("public origin is unavailable");
    try { resolveOrigin({ host }); } catch (error) { expect(String(error)).not.toContain(host); }
  });
  it.each(["https://user:secret@example.com", "https://example.com/path", "http://example.com", "https://$(touch).example", "https://example.com?secret", "https://example.com#fragment"])("rejects invalid configured origin %s", (origin) => {
    expect(() => resolveOrigin({ host: "localhost:3000" }, { GRILL_PUBLIC_ORIGIN: origin })).toThrow("public origin is unavailable");
  });
  it.each(["https,http", "https;touch sentinel", "javascript", "HTTP"])("rejects invalid trusted protocol %s", (proto) => {
    expect(() => resolveOrigin({ host: "public.example", "x-forwarded-proto": proto }, { GRILL_TRUST_PROXY: "1" })).toThrow("public origin is unavailable");
  });
  it("prints only normalized origin characters as a CLI argument", () => {
    const origin = resolveOrigin({ host: "beta.example:8443" });
    expect(joinCommand(`r_${"0".repeat(32)}`, origin)).toContain("--base https://beta.example:8443");
    expect(() => resolveOrigin({})).toThrow("public origin is unavailable");
  });
});
