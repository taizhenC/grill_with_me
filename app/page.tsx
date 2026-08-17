"use client";

import { useState } from "react";

type PublishResult = { key: string; hostToken: string; url: string };

export default function Home() {
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        body: await file.text(),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrors(body.errors ?? [body.error ?? `upload failed (${res.status})`]);
        return;
      }
      setResult(body);
    } catch {
      setErrors(["network error — the room was not created; try again"]);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return (
      <>
        <h1>Room published</h1>
        <div className="card">
          <p>
            Share this with the team:
            <br />
            <strong className="mono">
              {origin}
              {result.url}
            </strong>
          </p>
        </div>
        <div className="card">
          <p>
            <strong>Host token</strong> — needed to re-publish. Shown once;
            save it now.
          </p>
          <p className="mono">{result.hostToken}</p>
        </div>
        <p className="muted">
          Members can also join from a terminal:{" "}
          <code>npx grill-with-me join {result.key}</code>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>grill-with-me</h1>
      <p className="muted">
        Grill the whole team, one role each — then hold everyone to the
        contract.
      </p>

      <h2>Host: publish your room</h2>
      <p>
        Run the <code>grill-host</code> skill in your own agent. It grills you
        about the project, proposes roles, and writes{" "}
        <code>grill-room.json</code>. Upload it here.
      </p>
      <div className="card">
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {busy && <p className="muted">publishing…</p>}
        {errors.length > 0 && (
          <p className="error">
            {["Not published:", ...errors.map((e) => `• ${e}`)].join("\n")}
          </p>
        )}
      </div>

      <h2>Member?</h2>
      <p className="muted">
        Ask your host for the room link — everything you need is behind it.
      </p>
    </>
  );
}
