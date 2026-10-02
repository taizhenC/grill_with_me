/** Shared by the server, browser, and zero-dependency packaged CLI. */
export const ROOM_KEY_PATTERN = /^r_[0-9a-f]{32}$/;

// Compatibility is access-only: creation always issues the strong format.
// Existing links keep their original expiry; there is no weak alias for new rooms.
const LEGACY_ROOM_KEY_PATTERN = /^[a-z]{1,7}-[a-z]{1,7}-[0-9]{2}$/;

export function isRoomKey(value) {
  return typeof value === "string" && value.length <= 34 &&
    value === value.trim() &&
    (ROOM_KEY_PATTERN.test(value) || LEGACY_ROOM_KEY_PATTERN.test(value));
}
