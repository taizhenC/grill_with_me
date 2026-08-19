"use client";

import { useState } from "react";
import JSZip from "jszip";
import { CopyLine } from "@/app/copy";

type RoleView = {
  slug: string;
  name: string;
  description: string;
  owns: string[];
  claimedBy: string | null;
};

type PackFile = { path: string; content: string };

export function RoleList({
  roomKey,
  roles,
  commandFor,
}: {
  roomKey: string;
  roles: RoleView[];
  /** Built server-side so the command carries --base on non-canonical hosts. */
  commandFor: Record<string, string>;
}) {
  const [claims, setClaims] = useState<Record<string, string | null>>(
    Object.fromEntries(roles.map((r) => [r.slug, r.claimedBy])),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "saving" | "failed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function claim(slug: string) {
    const displayName = name.trim();
    if (!displayName) return;
    setClaimState("saving");
    try {
      const res = await fetch(`/api/room/${roomKey}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: slug, displayName }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setClaims((c) => ({ ...c, [slug]: displayName }));
      setClaimState("idle");
    } catch {
      setClaimState("failed");
    }
  }

  async function downloadZip(slug: string) {
    setError(null);
    try {
      const res = await fetch(`/api/room/${roomKey}?role=${slug}`);
      if (!res.ok) throw new Error(String(res.status));
      const body: { files: PackFile[] } = await res.json();
      const zip = new JSZip();
      for (const file of body.files) zip.file(file.path, file.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `grill-${roomKey}-${slug}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("download failed — check your connection and try again.");
    }
  }

  return (
    <>
      {roles.map((role) => {
        const takenBy = claims[role.slug];
        const open = picked === role.slug;
        return (
          <div key={role.slug} className={`card role${open ? " open" : ""}`}>
            <p className="role-head">
              <strong>{role.name}</strong>
              {takenBy && <span className="badge">taken by {takenBy}</span>}
            </p>
            <p className="muted">{role.description}</p>
            {role.owns.length > 0 && (
              <p className="muted small">
                Owns: {role.owns.join(" · ")}
              </p>
            )}

            {open ? (
              <div className="picked">
                <p className="small">
                  <strong>In your project folder, run:</strong>
                </p>
                <CopyLine value={commandFor[role.slug]} label="copy command" />

                {takenBy === null && (
                  <div className="row tight">
                    <input
                      type="text"
                      value={name}
                      placeholder="your name"
                      aria-label="Your name, so the team sees who took this role"
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void claim(role.slug);
                      }}
                    />
                    <button
                      className="secondary"
                      disabled={
                        claimState === "saving" || name.trim().length === 0
                      }
                      onClick={() => void claim(role.slug)}
                    >
                      {claimState === "saving" ? "saving…" : "tell the team"}
                    </button>
                  </div>
                )}
                {claimState === "failed" && (
                  <p className="muted small">
                    Couldn&apos;t save that — doesn&apos;t matter, the command
                    above still works. Just tell your host.
                  </p>
                )}

                <details>
                  <summary>No terminal? Download the zip instead</summary>
                  <p className="small">
                    Unzip it into your repo root — the folder with your{" "}
                    <code>.git</code> / <code>package.json</code>.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => void downloadZip(role.slug)}
                  >
                    Download grill-{roomKey}-{role.slug}.zip
                  </button>
                </details>
              </div>
            ) : (
              <button onClick={() => setPicked(role.slug)}>
                {takenBy ? "Take this over" : "This one's mine"}
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="error">{error}</p>}
    </>
  );
}
