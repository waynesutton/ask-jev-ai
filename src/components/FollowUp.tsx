import { ChatCircle } from "@phosphor-icons/react";
import type { Id } from "../../convex/_generated/dataModel";
import { useMe } from "../hooks/useMe";
import { Link } from "./Link";
import { Tooltip } from "./Tooltip";

// The one door into a thread, on every card that can take one: wall,
// Yours strip, profile rows, /me rows. A visitor is told what signing in
// gets them and comes back to this ask after. A signed in person goes
// straight to the composer on /a/:id. The thread itself is the ask
// owner's when it is their ask, and a private side thread otherwise;
// the page sorts that out.
//
// Who sees a thread follows one rule: a thread follows its ask. The
// asker's thread on a wall ask is public, like the ask. Everyone else's
// follow ups are private to them and the admin. The tooltip says which
// applies before the person clicks, so nobody types into a public thread
// thinking it is private.
type Props = {
  m: {
    _id: Id<"messages">;
    status: string;
    masked: boolean;
    hidden: boolean;
    hasThread: boolean;
    visibility: "public" | "private";
    // Present on signed in asks. Matched against the viewer's handle to
    // tell the owner from everyone else without another query.
    author?: { handle: string };
  };
};

// The tooltip for a signed in viewer. Owner and visitor lanes differ in
// who can read the thread, so the verb "Ask a follow up" stays the same
// and the tip carries the visibility.
function laneTip(m: Props["m"], viewerHandle: string): string {
  const owner = m.author !== undefined && m.author.handle === viewerHandle;
  if (!owner) {
    return "Private. Only you and the admin can read your thread. The model Jev picked for this ask answers with it as context.";
  }
  if (m.visibility === "private") {
    return "Private, like your ask. Only you and the admin can read this thread.";
  }
  return "Public, like your ask. Anyone reading it can read your follow ups. Make the ask private and the thread goes with it.";
}

// Where sign in sends you after. Kept as a path so the router can push it.
export function signInHref(next: string): string {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}

export function FollowUp({ m }: Props) {
  const me = useMe();
  // Held, hidden, and blurred asks take no follow ups; the reader cannot
  // see what they would be following up on.
  if (m.status !== "live" || m.masked || m.hidden) return null;
  // Session still settling: say nothing rather than flash the wrong verb.
  if (me === undefined) return null;

  const askHref = `/a/${m._id}`;

  if (me === null) {
    return (
      <span className="followup">
        {m.hasThread && (
          <Tooltip tip="The asker's thread with the model is public">
            <Link className="followup__link" href={askHref}>
              Read the thread
            </Link>
          </Tooltip>
        )}
        <Tooltip tip="Ask why, ask what next. A model Jev picks answers with this ask as context, in a thread only you can read. Free with an account.">
          <Link className="followup__link" href={signInHref(askHref)}>
            <ChatCircle size={12} aria-hidden="true" />
            Sign in to ask follow up questions
          </Link>
        </Tooltip>
      </span>
    );
  }

  return (
    <Tooltip
      tip={
        me.status === "paused"
          ? "Your account is paused, so follow ups are off"
          : laneTip(m, me.profile.handle)
      }
    >
      <Link className="followup__link" href={`${askHref}#follow-up`}>
        <ChatCircle size={12} aria-hidden="true" />
        Ask a follow up
      </Link>
    </Tooltip>
  );
}
