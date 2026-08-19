"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Someone got a room key over the phone, or the link died in a chat app's
 * link preview. One box, and it takes whatever they paste.
 */
export function JoinBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function open() {
    const key = value.trim().match(/\/r\/([^/?#]+)/)?.[1] ?? value.trim();
    if (key) router.push(`/r/${encodeURIComponent(key)}`);
  }

  return (
    <div className="row">
      <input
        type="text"
        value={value}
        placeholder="pearl-summit-88"
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
  );
}
