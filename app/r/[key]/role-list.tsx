"use client";

import { useState } from "react";
import JSZip from "jszip";

type RoleView = {
  slug: string;
  name: string;
  description: string;
  claimedBy: string | null;
};

type PackFile = { path: string; content: string };

export function RoleList({
  roomKey,
  roles,
}: {
  roomKey: string;
  roles: RoleView[];
}) {
  const [claims, setClaims] = useState<Record<string, string | null>>(
    Object.fromEntries(roles.map((r) => [r.slug, r.claimedBy])),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim(slug: string) {
    setPicked(slug);
    setError(null);
    const displayName = window.prompt("Your name (so the team sees who took this):");
    if (!displayName) {
      setPicked(null);
      return;
    }
    try {
      const res = await fetch(`/api/room/${roomKey}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: slug, displayName }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setClaims((c) => ({ ...c, [slug]: displayName }));
    } catch {
      setError("claim didn't save — you can still join; just tell the team.");
    }
  }

  async function downloadZip(slug: string) {
    setError(null);
    try {
      const res = await fetch(`/api/room/${roomKey}?role=${slug}`);
      if (!res.ok) throw new Error(String(res.status));
      const body: { files: PackFile[] } = await res.json();
      const zip = new JSZip();
      for (const file of body.files) {
        zip.file(file.path, file.content);
      }
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
      {roles.map((role) => (
        <div key={role.slug} className="card">
          <p>
            <strong>{role.name}</strong>
            {claims[role.slug] && (
              <span className="muted"> — taken by {claims[role.slug]}</span>
            )}
          </p>
          <p className="muted">{role.description}</p>
          {picked === role.slug && claims[role.slug] ? (
            <>
              <p>
                In your project folder, run:
                <br />
                <code>npx grill-with-me join {roomKey} --role {role.slug}</code>
              </p>
              <button
                className="secondary"
                onClick={() => void downloadZip(role.slug)}
              >
                or download the zip
              </button>
              <p className="muted">
                (unzip it into your repo root — the folder with your{" "}
                <code>package.json</code> / <code>.git</code>)
              </p>
            </>
          ) : (
            <button onClick={() => void claim(role.slug)}>
              {claims[role.slug] ? "Take over this role" : "This one's mine"}
            </button>
          )}
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </>
  );
}
