"use client";

import { useState } from "react";

/**
 * A copyable line. Every string this app shows a user is meant to be pasted
 * somewhere — a terminal, a group chat, a password manager — and selecting
 * a monospace room key by hand at a table full of people is exactly the
 * friction this product exists to remove.
 */
export function CopyLine({
  value,
  label = "copy",
}: {
  value: string;
  label?: string;
}) {
  return (
    <div className="cmd">
      <code>{value}</code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function CopyButton({
  value,
  label = "copy",
}: {
  value: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      className="copy"
      aria-label={`Copy: ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "done" ? "copied" : state === "failed" ? "select it" : label}
    </button>
  );
}
