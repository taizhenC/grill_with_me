import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore, toPublic, ROOM_TTL_DAYS } from "@/lib/store";
import {
  joinCommand,
  republishCommand,
  statusCommand,
} from "@/lib/commands";
import { requestOrigin } from "@/lib/origin";
import { CopyLine } from "@/app/copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Host view", robots: { index: false } };

/**
 * Host view: who has claimed what, and the two commands the host needs after
 * publishing. Read-only — republishing stays an authenticated CLI call, so
 * the host token never has to be typed into a form on a page anyone with the
 * room key can open.
 */
export default async function HostPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const stored = await getStore().get(key);
  if (!stored) notFound();

  const pub = toPublic(stored);
  const origin = await requestOrigin();
  const roomUrl = `${origin}/r/${pub.key}`;
  const claimed = pub.room.roles.filter((r) => pub.claims[r.slug]);
  const daysLeft = Math.max(
    0,
    Math.round(
      (new Date(pub.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  );

  return (
    <>
      <h1>{pub.room.project.name}</h1>
      <p className="lede">Host view</p>
      <p className="muted small">
        Room <span className="mono">{pub.key}</span> · pack v{pub.version} ·
        expires in {daysLeft} days
      </p>

      <h2>Share</h2>
      <CopyLine value={roomUrl} label="copy link" />
      <p className="muted small">Or, for the terminal-inclined:</p>
      <CopyLine value={joinCommand(pub.key, origin)} />

      <h2>
        Claims{" "}
        <span className="badge">
          {claimed.length} of {pub.room.roles.length}
        </span>
      </h2>
      {pub.room.roles.map((role) => (
        <div key={role.slug} className="card role">
          <p className="role-head">
            <strong>{role.name}</strong>
            {pub.claims[role.slug] ? (
              <span className="badge ok-badge">{pub.claims[role.slug]}</span>
            ) : (
              <span className="badge">unclaimed</span>
            )}
          </p>
          <p className="muted small">{role.description}</p>
        </div>
      ))}
      <p className="muted small">
        Claims are informational and this page does not live-update —{" "}
        <a href={`/r/${pub.key}/host`}>refresh</a>, or check from a terminal:
      </p>
      <CopyLine value={statusCommand(pub.key, origin)} />
      <p className="muted small">
        Someone may be working without claiming. Chasing people is your job,
        not the app&apos;s.
      </p>

      <h2>Re-publish (would become v{pub.version + 1})</h2>
      <p>
        Re-run <code>grill-host</code> or edit <code>grill-room.json</code>,
        then, from the folder you published in:
      </p>
      <CopyLine value={republishCommand(origin)} />
      <p className="muted small">
        That reads your host token from <code>.grill-with-me.json</code>. If
        you published in the browser instead, add{" "}
        <code>--token YOUR_HOST_TOKEN</code> the first time and it saves it.
      </p>
      <details>
        <summary>No Node.js? The equivalent curl</summary>
        <pre className="mono small">
          {`curl -X POST "${origin}/api/room/${pub.key}/republish" \\
  -H "Authorization: Bearer YOUR_HOST_TOKEN" \\
  --data-binary @grill-room.json`}
        </pre>
      </details>
      <p className="muted small">
        Members keep the pack they already downloaded. Re-joining is safe and
        updates in place ({joinCommand(pub.key, origin)}) — but telling the
        team to do it is on you.
      </p>

      <h2>When every spec is committed</h2>
      <p className="muted">
        Tell your agent: <em>run the merge-contract skill</em>. It reads every{" "}
        <code>grill/*-spec.md</code>, writes <code>grill/CONTRACT.md</code>{" "}
        (plus <code>contract.ts</code> on TypeScript stacks), and refuses to
        merge a spec that came back malformed rather than guessing at it.
      </p>
      <p className="muted small">
        Rooms are deleted {ROOM_TTL_DAYS} days after publishing. Nothing your
        team writes is stored here.
      </p>
    </>
  );
}
