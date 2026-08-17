import { notFound } from "next/navigation";
import { getStore, toPublic } from "@/lib/store";
import { RoleList } from "./role-list";

export const dynamic = "force-dynamic";

/**
 * The join page. A member lands here from the host's link, picks a role,
 * and either copies the npx one-liner (preferred) or downloads the zip
 * (fallback). Cold-open copy matters (P1-6): assume the reader got this
 * link from a group chat and knows nothing.
 */
export default async function RoomPage({
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
      <h1>{pub.room.project.name}</h1>
      <p className="muted">
        Your team is about to split into roles and build in parallel.
        grill-with-me interviews each of you about your part — in your own
        editor, with your own AI — then merges the answers into one contract
        everyone codes against. Takes about ten minutes.
      </p>

      <h2>1 · Pick your role</h2>
      <RoleList
        roomKey={pub.key}
        roles={pub.room.roles.map((r) => ({
          slug: r.slug,
          name: r.name,
          description: r.description,
          claimedBy: pub.claims[r.slug] ?? null,
        }))}
      />

      <h2>2 · Then, in your project folder</h2>
      <ol className="steps">
        <li>
          Run the command the role card gives you — it writes a few files
          into your repo.
        </li>
        <li>
          Open your AI editor and run <code>/grill-me</code> (or tell your
          agent: <em>read grill/MY-ROLE.md and follow it</em>).
        </li>
        <li>
          Answer its questions about your part. When you say you&apos;re
          done, it writes your spec — commit it.
        </li>
      </ol>
      <p className="muted">
        Once every spec is committed, your host runs the merge and the
        contract lands in the repo.
      </p>
    </>
  );
}
