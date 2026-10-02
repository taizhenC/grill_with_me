import { describe, expect, it } from "vitest";
import { isRoomKey } from "../cli/room-key.mjs";

describe("shared room key validation", () => {
  it("accepts opaque capabilities and original legacy keys without normalization", () => {
    expect(isRoomKey("r_0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isRoomKey("pearl-summit-88")).toBe(true);
    expect(isRoomKey("juniper-kestrel-10")).toBe(true);
  });

  it.each([
    "", "r_0123456789abcdef0123456789abcde", "r_0123456789abcdef0123456789abcdef0",
    "R_0123456789abcdef0123456789abcdef", "r_0123456789abcdef0123456789abcdeG",
    "pearl-summit-8", "pearl-summit-888", "PEARL-summit-88", "toolongword-summit-88",
    "pearl-summit-88\n", " pearl-summit-88", "pearl-summit-88 ",
    "../pearl-summit-88", "pearl-summit-88?role=backend", "pearl%2dsummit%2d88",
    "r_0123456789abcdef0123456789abcdef\n", null, 42, {},
  ])("rejects malformed input %j", (value) => {
    expect(isRoomKey(value)).toBe(false);
  });
});
