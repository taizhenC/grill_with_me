"use client";

import { useState } from "react";
import { CopyLine, CopyButton } from "./copy";

type PublishResult = { key: string; hostToken: string; url: string };

/**
 * Publishing is the host's only visit to a browser, and it happens while
 * four people wait. So: drop the file, or paste it, and leave with every
 * string you need already copyable — link, one-liner, token, host view.
 */
export function PublishPanel({
  origin,
  baseFlag,
}: {
  origin: string;
  baseFlag: string;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");

  async function publish(raw: string) {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch("/api/rooms", { method: "POST", body: raw });
      const body = await res.json();
      if (!res.ok) {
        setErrors(
          body.errors ?? [body.error ?? `upload failed (${res.status})`],
        );
        return;
      }
      setResult(body);
    } catch {
      setErrors(["network error — the room was not created; try again"]);
    } finally {
      setBusy(false);
    }
  }

  async function publishFile(file: File) {
    if (!/\.json$/i.test(file.name)) {
      setErrors([
        `${file.name} isn't a .json file — the grill-host skill writes grill-room.json`,
      ]);
      return;
    }
    await publish(await file.text());
  }

  if (result) {
    const roomUrl = `${origin}${result.url}`;
    return (
      <section aria-live="polite">
        <h2 className="ok">✓ Room published</h2>

        <div className="card">
          <p>
            <strong>Send this to your team.</strong> Everything they need is
            behind it.
          </p>
          <CopyLine value={roomUrl} label="copy link" />
          <p className="muted small">
            Prefer the terminal? They can run this from their repo instead:
          </p>
          <CopyLine value={`npx grill-with-me join ${result.key}${baseFlag}`} />
        </div>

        <div className="card">
          <p>
            <strong>Your host token</strong> — the only way to re-publish this
            room. Shown once.
          </p>
          <CopyLine value={result.hostToken} label="copy token" />
          <p className="muted small">
            Save it in your password manager, or publish from the CLI next
            time (<code>npx grill-with-me publish</code>) — it writes the token
            to <code>.grill-with-me.json</code> and gitignores it for you.
          </p>
        </div>

        <h2>Next</h2>
        <ol className="steps">
          <li>
            Share the link. Each member picks a role and gets grilled in their
            own editor.
          </li>
          <li>
            Watch who has joined on your{" "}
            <a href={`${result.url}/host`}>host view</a> — bookmark it.
          </li>
          <li>
            Once every spec is committed, run the <code>merge-contract</code>{" "}
            skill. <code>grill/CONTRACT.md</code> lands in the repo.
          </li>
        </ol>
        <p className="muted small">
          Rooms expire after 30 days. Nothing your team writes ever comes back
          here — specs and the contract live in your repo.
        </p>
      </section>
    );
  }

  return (
    <section>
      <label
        className={`drop${dragging ? " dragging" : ""}${busy ? " busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void publishFile(file);
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void publishFile(file);
          }}
        />
        <strong>{busy ? "publishing…" : "Drop grill-room.json here"}</strong>
        <span className="muted small">or click to choose the file</span>
      </label>

      {errors.length > 0 && (
        <p className="error" role="alert">
          {["Not published:", ...errors.map((e) => `• ${e}`)].join("\n")}
        </p>
      )}

      <details className="paste">
        <summary>Can&apos;t drag a file here? Paste it instead</summary>
        <textarea
          value={pasted}
          spellCheck={false}
          onChange={(e) => setPasted(e.target.value)}
          placeholder='{ "schemaVersion": 1, "project": { … }, "roles": [ … ] }'
          rows={6}
        />
        <button
          disabled={busy || pasted.trim().length === 0}
          onClick={() => void publish(pasted)}
        >
          Publish this
        </button>
      </details>

      <p className="muted small">
        Working over SSH or hate browsers? Publish from the terminal:{" "}
        <CopyButton
          value={`npx grill-with-me publish grill-room.json${baseFlag}`}
          label="copy command"
        />
      </p>
    </section>
  );
}
