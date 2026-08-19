import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore, toPublic } from "@/lib/store";
import { joinCommand } from "@/lib/commands";
import { requestOrigin } from "@/lib/origin";
import { GRILL_COMMAND } from "@/lib/pack";
import { RoleList } from "./role-list";

export const dynamic = "force-dynamic";

/**
 * The join page. A member lands here from the host's link, picks a role,
 * and either copies the npx one-liner (preferred) or downloads the zip
 * (fallback). Cold-open copy matters (P1-6): assume the reader got this
 * link from a group chat and knows nothing — including what this is.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const stored = await getStore().get(key);
  if (!stored) return { title: "Room not found" };
  const title = `${stored.room.project.name} — pick your role`;
  return {
    title,
    description: `Your team is splitting into roles on ${stored.room.project.name}. Ten minutes: pick yours, get grilled about your layer, commit the spec.`,
    openGraph: { title, type: "website" },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const stored = await getStore().get(key);
  if (!stored) notFound();

  const pub = toPublic(stored);
  const origin = await requestOrigin();
  const { project } = pub.room;
  const commandFor = Object.fromEntries(
    pub.room.roles.map((r) => [r.slug, joinCommand(pub.key, origin, r.slug)]),
  );

  return (
    <>
      <h1>{project.name}</h1>
      <p className="lede">
        Your team is about to build in parallel. Before that: ten minutes each,
        in your own editor, with your own AI — then one contract everyone codes
        against.
      </p>

      <div className="card brief">
        <p>{project.idea}</p>
        {project.demoTarget && (
          <p className="muted small">
            <strong>The demo shows:</strong> {project.demoTarget}
          </p>
        )}
        {project.mode === "hackathon" && project.hoursLeft != null && (
          <p className="muted small">
            <strong>~{project.hoursLeft} hours</strong> to the demo.
          </p>
        )}
      </div>

      <h2>1 · Pick your role</h2>
      <RoleList
        roomKey={pub.key}
        commandFor={commandFor}
        roles={pub.room.roles.map((r) => ({
          slug: r.slug,
          name: r.name,
          description: r.description,
          owns: r.owns,
          claimedBy: pub.claims[r.slug] ?? null,
        }))}
      />

      <h2>2 · Then, in your project folder</h2>
      <ol className="steps">
        <li>
          Run the command your role card gives you. It writes a few markdown
          files into your repo — nothing to install, nothing to configure.
        </li>
        <li>
          Open your AI editor there and run <code>/{GRILL_COMMAND}</code> — or
          tell your agent: <em>read grill/MY-ROLE.md and follow it</em>.
        </li>
        <li>
          Answer its questions about your layer. When you say you&apos;re done
          it writes your spec — <strong>commit it</strong>.
        </li>
      </ol>
      <p className="muted">
        Once every spec is committed, your host runs the merge and{" "}
        <code>grill/CONTRACT.md</code> lands in the repo. From then on anyone
        can run <code>check-contract</code> to find drift — it ships in your
        pack.
      </p>
      <p className="muted small">
        Room <span className="mono">{pub.key}</span> · pack v{pub.version} ·
        this app never sees your code, your specs, or your contract.
      </p>
    </>
  );
}
