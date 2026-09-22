import type { MouseEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useMe } from "../hooks/useMe";
import { usePath } from "../lib/router";
import { signInHref } from "./FollowUp";
import { Link } from "./Link";

// The line under an anonymous open ask. Jev's `reply` Choice says `open`
// when an ask wants more than yes or no (what, why, who). A signed in ask
// like that gets a model answer in this slot. A visitor's does not, and
// until now the card said nothing about why. This fills the slot with the
// reason and the two ways forward: sign in, or ask a yes or no.
//
// Shows on live, judged, unmasked rows where Jev said `open` and no model
// answer exists or is coming. `answerStatus` is set on every signed in row
// the moment Jev finishes (pending, then streaming or done, or skipped on
// a hold), so an undefined status is the exact test for an anonymous ask.
// No extra query: everything here is already on the row.
type Props = {
  m: {
    _id: Id<"messages">;
    status: string;
    judged: boolean;
    masked: boolean;
    reply?: string;
    answerStatus?: string;
  };
};

// The composer's textarea id. On the home page the link is a plain hash
// jump that also puts the caret in the box. Anywhere else it goes home.
const COMPOSER_ID = "ask-jev";

export function OpenAskNote({ m }: Props) {
  const me = useMe();
  if (m.status !== "live" || !m.judged || m.masked) return null;
  if (m.reply !== "open" || m.answerStatus !== undefined) return null;
  // Session still settling: say nothing rather than flash the wrong copy.
  if (me === undefined) return null;

  if (me === null) {
    return (
      <p className="nudge body-sm">
        Jev read this as an open question, not a yes or no.{" "}
        <Link href={signInHref(`/a/${m._id}`)}>Sign in</Link> and a model Jev
        picks answers it, or{" "}
        <AskAgainLink>ask something Jev can settle</AskAgainLink> with yes or
        no.
      </p>
    );
  }

  return (
    <p className="nudge body-sm muted">
      Jev read this as an open question, not a yes or no. It was asked signed
      out, so no model answered it.
    </p>
  );
}

// "Ask a yes or no" goes to the composer. On the home page that is the box
// at the top of the same page, so a hash anchor and a focus call do it
// without a route change. From /a/:id it is a route push home.
function AskAgainLink({ children }: { children: string }) {
  const path = usePath();
  if (path !== "/") return <Link href="/">{children}</Link>;
  const focus = (event: MouseEvent<HTMLAnchorElement>) => {
    const box = document.getElementById(COMPOSER_ID);
    if (!(box instanceof HTMLTextAreaElement)) return;
    event.preventDefault();
    box.scrollIntoView({ block: "center" });
    box.focus({ preventScroll: true });
  };
  return (
    <a href={`#${COMPOSER_ID}`} onClick={focus}>
      {children}
    </a>
  );
}
