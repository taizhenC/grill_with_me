"use client";

import { useEffect, useRef, useState } from "react";
import { CopyLine, CopyButton } from "./copy";
import { browserErrors, browserJson } from "@/lib/browser-api";
import { MAX_ROOM_JSON_BYTES, parseGrillRoom } from "@/lib/schema";
import { republishCommand } from "@/lib/commands";
import { isRoomKey } from "../cli/room-key.mjs";
import { discardPublication, loadPublication, publicationExpiry, savePublication, type BrowserPublication } from "@/lib/browser-publication";

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
  const [attempt, setAttempt] = useState<BrowserPublication | null>(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    try {
      const previous = loadPublication(window.sessionStorage, origin);
      setAttempt(previous);
      setSaved(previous !== null);
    } catch {
      setSaved(true);
      setErrors(["Could not read this tab's saved publication. Enable session storage or discard the saved attempt before publishing."]);
    } finally { setReady(true); }
  }, [origin]);

  function forgetPublication() {
    if (pending.current) return;
    try {
      discardPublication(window.sessionStorage);
      setAttempt(null);
      setSaved(false);
      setErrors([]);
    } catch {
      setErrors(["Could not clear this tab's saved publication. Enable session storage before trying again."]);
    }
  }

  async function publish(input?: string | File) {
    if (pending.current || !ready || (input !== undefined && saved)) return;
    pending.current = true;
    setBusy(true);
    setErrors([]);
    let phase: "read" | "save" | "send" = "read";
    try {
      let current = attempt;
      if (input !== undefined) {
        if (typeof input !== "string") {
          if (!/\.json$/i.test(input.name)) { setErrors([`${input.name} isn't a .json file — choose grill-room.json`]); return; }
          if (input.size > MAX_ROOM_JSON_BYTES) { setErrors(["Room JSON exceeds the 256 KiB upload limit."]); return; }
        }
        const raw = typeof input === "string" ? input : await input.text();
        const parsed = parseGrillRoom(raw);
        if (!parsed.ok) { setErrors(parsed.errors); return; }
        phase = "save";
        current = savePublication(window.sessionStorage, origin, raw);
        setAttempt(current);
        setSaved(true);
      }
      if (!current) return;
      let expiresAt;
      try { expiresAt = new Date(publicationExpiry(current)).toISOString(); }
      catch {
        setErrors(["Publication recovery has expired or cannot be used. Check the original outcome before discarding this attempt and creating another room."]);
        return;
      }
      phase = "send";
      const { response: res, body } = await browserJson("/api/rooms", { method: "POST", body: current.body,
        headers: { "Content-Type": "application/json", "Idempotency-Key": current.capability } });
      if (!res.ok) {
        setErrors(browserErrors(body, res.status).map((message) => message.replaceAll(current.capability, "[redacted]")));
        return;
      }
      const recovery = body.recovery;
      if (!isRoomKey(body.key) || typeof body.hostToken !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(body.hostToken)
        || !recovery || typeof recovery !== "object" || !("expiresAt" in recovery) || recovery.expiresAt !== expiresAt
        || !("replayed" in recovery) || typeof recovery.replayed !== "boolean") throw new Error("invalid publish acknowledgement");
      setResult({ key: body.key, hostToken: body.hostToken, url: `/r/${body.key}` });
    } catch {
      setErrors([phase === "send"
        ? "Could not confirm publication. A room may have been created. Recover the saved publication below to retrieve the same room and host token."
        : phase === "save" ? "Could not save publication recovery in this tab. Enable session storage before publishing. No request was sent."
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
            room or delete it.
          </p>
          <CopyLine value={result.hostToken} label="copy token" />
          <p className="muted small">
            Save it in your password manager. To update this same room, replace
            YOUR_HOST_TOKEN below with the saved token. Browser publishing does
            not create a local CLI credential file; an explicit token is used
            for that invocation and is not saved.
          </p>
          <CopyLine value={republishCommand(origin, result.key)} label="copy republish command" />
          <p className="muted small">
            Recovery is available for 24 hours, including across reloads. The
            brief and private capability stay in this tab until cleared or the
            browser discards the session. Closing the tab can lose recovery.
            Clear it here after saving your host token.
          </p>
          {saved ? <button onClick={forgetPublication}>I saved my host token</button>
            : <p className="muted small">Recovery cleared from this tab.</p>}
          {errors.length > 0 && <p className="error" role="alert" aria-label="Publication status">{errors.join("\n")}</p>}
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
      {saved && <div className="card">
        <h3>Saved publication</h3>
        <p>Recover this attempt to receive the same room and host token. The brief and
          private recovery capability stay in this tab until cleared or the browser
          discards the session. Recovery expires after 24 hours. Closing the tab can
          lose it. Keep this browser session private.</p>
        {attempt && <button disabled={busy} onClick={() => void publish()}>Recover saved publication</button>}
        <p className="muted small">Discarding recovery does not delete a room. Check
          the original outcome first; a new publication can create another room.</p>
        <button disabled={busy} onClick={forgetPublication}>Discard saved attempt</button>
      </div>}
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
          disabled={busy || saved || !ready}
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
          disabled={busy || saved || !ready || pasted.trim().length === 0}
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
