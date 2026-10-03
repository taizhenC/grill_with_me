"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import { CopyLine } from "@/app/copy";
import { browserJson } from "@/lib/browser-api";

type RoleView = {
  slug: string;
  name: string;
  description: string;
  owns: string[];
  claimedBy: string | null;
};

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
  const claiming = useRef(false);

  async function claim(slug: string) {
    const displayName = name.trim();
    if (!displayName || claiming.current) return;
    claiming.current = true;
    setClaimState("saving");
    try {
      const { response: res, body } = await browserJson(`/api/room/${roomKey}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: slug, displayName }),
      });
      if (!res.ok || body.ok !== true) throw new Error(String(res.status));
      setClaims((c) => ({ ...c, [slug]: displayName }));
      setClaimState("idle");
    } catch {
      setClaimState("failed");
    } finally {
      claiming.current = false;
    }
  }

  async function downloadZip(slug: string) {
    setError(null);
    try {
      const { response: res, body } = await browserJson(`/api/room/${roomKey}?role=${slug}`);
      if (!res.ok) throw new Error(String(res.status));
      if (body.key !== roomKey || body.role !== slug || !Number.isSafeInteger(body.version) || Number(body.version) < 1) throw new Error("invalid pack identity");
      if (!Array.isArray(body.files) || !body.files.every((file) => file && typeof file.path === "string" && typeof file.content === "string")) throw new Error("invalid pack");
      const zip = new JSZip();
      // Extraction produces data and instructions, never destination paths that
      // overwrite a checkout's AGENTS.md, role selectors, or edited skills.
      zip.file("grill-with-me-pack/pack.json", JSON.stringify({ ...body, origin: window.location.origin, roomKey, role: slug }, null, 2));
      zip.file("grill-with-me-pack/IMPORT.md", `# Import this pack safely\n\nThis ZIP stages pack.json only. Do not extract file entries from its JSON directly over an existing checkout.\n\nPreferred: run the join command from the room page; it validates paths and preserves local edits.\n\nWithout a terminal, ask your local agent to read pack.json and prepare a proposed import. Review every file before accepting it. Merge only the grill-with-me fenced section into existing AGENTS.md, preserving everything outside it. Keep edited skills and role instructions unless you explicitly approve their replacement. Never overwrite specs, contracts, amendment history, or host credentials. Keep member role selectors local and ignored by Git. If any path is linked, unexpected, or conflicts with local edits, stop and resolve it before writing.\n\nOrigin: ${window.location.origin}\nRoom: ${roomKey}\nRole: ${slug}\n`);
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

                  <div className="row tight">
                    <input
                      type="text"
                      maxLength={60}
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
                      {claimState === "saving" ? "saving…" : takenBy ? "update claim" : "tell the team"}
                    </button>
                  </div>
                {claimState === "failed" && (
                  <p className="muted small">
                    Couldn&apos;t confirm that claim. Refresh to check whether
                    it was recorded, or tell your host. The join command still works.
                  </p>
                )}

                <details>
                  <summary>No terminal? Download the zip instead</summary>
                  <p className="small">
                    Extract the staging folder and read <code>IMPORT.md</code>.
                    It contains the pack as JSON for a reviewed import; extracting
                    this ZIP does not install or replace your repo&apos;s files.
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
