"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isRoomKey } from "../cli/room-key.mjs";

/**
 * Paste the key or the room link the host shared.
 */
export function JoinBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function open() {
    const key = value.trim().match(/\/r\/([^/?#]+)/)?.[1] ?? value.trim();
    if (!isRoomKey(key)) {
      setError("Paste a valid room key or the full link your host sent you.");
      return;
    }
    setError("");
    router.push(`/r/${encodeURIComponent(key)}`);
  }

  return (
    <div>
      <div className="row">
        <input
          type="text"
          value={value}
          placeholder="Paste your room link or key"
          aria-label="Room key or link"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") open();
          }}
        />
        <button onClick={open} disabled={value.trim().length === 0}>
          Open room
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
