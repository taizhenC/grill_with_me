import { PublishPanel } from "./publish-panel";
import { JoinBox } from "./join-box";
import { CopyLine } from "./copy";
import { baseFlag, hostInstallCommand } from "@/lib/commands";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const origin = await requestOrigin();

  return (
    <>
      <h1>grill-with-me</h1>
      <p className="lede">
        Grill the whole team, one role each — then hold everyone to the
        contract that comes out of it.
      </p>
      <p className="muted">
        Frontend expects <code>user.name</code>, backend returns{" "}
        <code>first_name</code>, and nobody finds out until integration at hour
        20. This interviews each person about their layer, merges the answers
        into one <code>CONTRACT.md</code>, and reports drift by role — so you
        know who to go talk to.
      </p>

      <h2>Host — about ten minutes, once</h2>
      <ol className="steps">
        <li>
          Install the host skills in your repo:
          <CopyLine value={hostInstallCommand(origin)} />
        </li>
        <li>
          Tell your agent: <em>run the grill-host skill</em>. It grills you
          about the project, proposes roles, and writes{" "}
          <code>grill-room.json</code>.
        </li>
        <li>Publish that file below and share the link.</li>
      </ol>

      <PublishPanel origin={origin} baseFlag={baseFlag(origin)} />

      <h2>Member — got a key?</h2>
      <p className="muted">
        Paste the room key or the link your host sent you.
      </p>
      <JoinBox />

      <footer className="foot">
        <p className="muted small">
          No accounts. No API keys. Every model call runs on a team member&apos;s
          own agent — this app only hands out packs, and never sees your specs
          or your contract. Rooms expire after 30 days.
        </p>
      </footer>
    </>
  );
}
