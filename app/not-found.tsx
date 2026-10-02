import { JoinBox } from "./join-box";
import { ROOM_TTL_DAYS } from "@/lib/store";

/**
 * Room links get pasted into group chats, retyped from a whiteboard, and
 * opened three days late. A bare 404 leaves that person stuck; this one
 * gives them the two things that actually fix it.
 */
export default function NotFound() {
  return (
    <>
      <h1>Nothing here</h1>
      <p className="lede">
        That room doesn&apos;t exist — or it expired. Rooms last{" "}
        {ROOM_TTL_DAYS} days.
      </p>
      <p className="muted">
        Paste the whole room link or key your host sent you. New keys start
        with <span className="mono">r_</span>; older room links also work
        until they expire.
      </p>
      <JoinBox />
      <p className="muted small">
        Still nothing? Ask your host to re-publish and send a fresh link — it
        takes them one command.
      </p>
      <p className="muted small">
        <a href="/">grill-with-me</a>
      </p>
    </>
  );
}
