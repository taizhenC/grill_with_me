"use client";

import { useRef, useState } from "react";
import { CopyLine, CopyButton } from "./copy";
import { browserErrors, browserJson } from "@/lib/browser-api";
import { MAX_ROOM_JSON_BYTES, parseGrillRoom } from "@/lib/schema";
import { republishCommand } from "@/lib/commands";
import { isRoomKey } from "../cli/room-key.mjs";

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
  const pending = useRef(false);

  async function publish(input: string | File) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setErrors([]);
    let sent = false;
    try {
      if (typeof input !== "string") {
        if (!/\.json$/i.test(input.name)) { setErrors([`${input.name} isn't a .json file — choose grill-room.json`]); return; }
        if (input.size > MAX_ROOM_JSON_BYTES) { setErrors(["Room JSON exceeds the 256 KiB upload limit."]); return; }
      }
      const raw = typeof input === "string" ? input : await input.text();
      const parsed = parseGrillRoom(raw);
      if (!parsed.ok) { setErrors(parsed.errors); return; }
      sent = true;
      const { response: res, body } = await browserJson("/api/rooms", { method: "POST", body: raw });
      if (!res.ok) {
        setErrors(browserErrors(body, res.status));
        return;
      }
      if (!isRoomKey(body.key) || typeof body.hostToken !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(body.hostToken)) throw new Error("invalid publish acknowledgement");
      setResult({ key: body.key, hostToken: body.hostToken, url: `/r/${body.key}` });
    } catch {
      setErrors([sent
        ? "Could not confirm publication. A room may have been created, but its host token was not received. Check the connection before publishing again; a new attempt can create another room."
        : "Could not read that file. Choose it again or paste the JSON below."]);
    } finally {
      setBusy(false);
      pending.current = false;
    }
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
            Save it in your password manager. To update this same room, replace
            YOUR_HOST_TOKEN below with the saved token. Browser publishing does
            not create a local CLI credential file; an explicit token is used
            for that invocation and is not saved.
          </p>
          <CopyLine value={republishCommand(origin, result.key)} label="copy republish command" />
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
          if (file) void publish(file);
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept=".json,application/json"
          disabled={busy}
          aria-label="Choose grill-room.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void publish(file);
          }}
        />
        <strong>{busy ? "publishing…" : "Drop grill-room.json here"}</strong>
        <span className="muted small">or click to choose the file</span>
      </label>

      {errors.length > 0 && (
        <p className="error" role="alert" aria-label="Publication status">
          {["Publication status:", ...errors.map((e) => `• ${e}`)].join("\n")}
        </p>
      )}

      <details className="paste">
        <summary>Can&apos;t drag a file here? Paste it instead</summary>
        <textarea
          aria-label="Room JSON"
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
