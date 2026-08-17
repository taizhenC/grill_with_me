import { notFound } from "next/navigation";
import { getStore, toPublic } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Host view: who has claimed what, current pack version, and how to
 * re-publish. Read-only — republishing is an API call with the host token,
 * kept out of the browser so the token never has to be typed into a form.
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
  return (
    <>
      <h1>{pub.room.project.name} — host view</h1>
      <p className="muted">
        Pack version {pub.version} · room <span className="mono">{pub.key}</span>
      </p>

      <h2>Claims</h2>
      {pub.room.roles.map((role) => (
        <div key={role.slug} className="card">
          <p>
            <strong>{role.name}</strong>{" "}
            {pub.claims[role.slug] ? (
              <span className="ok">— {pub.claims[role.slug]}</span>
            ) : (
              <span className="muted">— unclaimed</span>
            )}
          </p>
        </div>
      ))}
      <p className="muted">
        Claims are informational — refresh to update. Chasing people is your
        job, not the app&apos;s.
      </p>

      <h2>Re-publish (v{pub.version + 1})</h2>
      <p>
        Re-run <code>grill-host</code> (or edit <code>grill-room.json</code>),
        then:
      </p>
      <p>
        <code>
          curl -X POST -H &quot;Authorization: Bearer YOUR_HOST_TOKEN&quot;
          --data-binary @grill-room.json {`{origin}`}/api/room/{pub.key}
          /republish
        </code>
      </p>
      <p className="muted">
        Members who already downloaded keep their old pack — freshly joined
        packs carry the new version in <code>grill/.room</code>, and telling
        the team to re-join is on you.
      </p>
    </>
  );
}
