import { randomBytes } from "node:crypto";

export { ROOM_KEY_PATTERN, isRoomKey } from "../cli/room-key.mjs";

/** Account-free room access: 16 cryptographically random bytes (128 bits). */
export function generateRoomKey(): string {
  return `r_${randomBytes(16).toString("hex")}`;
}

/** Bearer secret the host uses to re-publish. Never rendered into packs. */
export function generateHostToken(): string {
  return randomBytes(24).toString("base64url");
}
