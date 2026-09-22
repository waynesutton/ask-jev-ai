import { useState, type AnimationEvent } from "react";
import { X } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useMe } from "../hooks/useMe";
import { AnswerBlock } from "./AnswerBlock";
import { FollowUp } from "./FollowUp";
import { JevAnswers, VerdictChip } from "./JevAnswers";
import { Link } from "./Link";
import { OpenAskNote } from "./OpenAsk";
import { Tooltip } from "./Tooltip";

type Props = {
  sessionId: string;
};

type Mine = FunctionReturnType<typeof api.messages.mine>[number];

// How long a visitor's live ask sits under the box before the card leaves
// for the wall. Hover or focus holds the clock.
const FADE_MS = 4000;

// The id of the last card closed or faded, so a reload does not bring it
// back. One key per browser; the next ask overwrites it.
const DISMISSED_KEY = "jev:yours-dismissed";

function storedDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function rememberDismissed(id: Id<"messages">) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, id);
  } catch {
    // Storage blocked. State still hides the card for this page.
  }
}

// Your newest ask, under the composer. One card, every status. Watch
// judging flip to live and Jev's headline answer land as a chip. Full
// answers stay one click away so the hero keeps its shape.
//
// The card clears itself. A new ask replaces it, and the X closes it. Signed
// in, it waits for one of those and the note points at /me, where every ask
// lives. A visitor's live ask is already on the wall, so after four seconds
// the block slides a step toward the wall and fades; held and failed asks
// stay put, since one never reaches the wall and the other has Retry.
//
// For visitors, Jev's `reply` Choice doubles as the sign in prompt. When
// it comes back `open` (what, why, how) `OpenAskNote` says so and points
// at sign in, where the same ask would get a model answer. No extra call:
// the detection is one of the seven questions Jev already answered.
export function Yours({ sessionId }: Props) {
  const me = useMe();
  const mine = useQuery(api.messages.mine, { sessionId });
  const retry = useMutation(api.messages.retry);
  const [dismissed, setDismissed] = useState<string | null>(storedDismissed);

  const latest = mine?.[0];
  if (!latest || latest._id === dismissed) return null;

  const dismiss = () => {
    rememberDismissed(latest._id);
    setDismissed(latest._id);
  };

  // Keyed on the id so a new ask mounts fresh: no leftover leave state, and
  // the drain starts from full.
  return (
    <Latest
      key={latest._id}
      m={latest}
      signedIn={me !== null && me !== undefined}
      fades={me === null && latest.status === "live"}
      onDismiss={dismiss}
      onRetry={() => void retry({ messageId: latest._id, sessionId })}
    />
  );
}

function Latest({
  m,
  signedIn,
  fades,
  onDismiss,
  onRetry,
}: {
  m: Mine;
  signedIn: boolean;
  fades: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  // Bars and dots inside the card end their own animations and those events
  // bubble here, so each handler checks the name before acting.
  const onDrained = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.animationName === "yours-drain") setLeaving(true);
  };
  const onLeft = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.animationName.startsWith("yours-leave")) onDismiss();
  };

  return (
    <div
      className={"yours" + (leaving ? " yours--leaving" : "")}
      onAnimationEnd={onLeft}
    >
      <div className="yours__head">
        <span className="label">Yours</span>
        <button
          type="button"
          className="yours__close"
          aria-label="Close this card"
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className={`yours__item yours__item--${m.status}`}>
        <div className="yours__row">
          <span
            className={"yours__text" + (m.masked ? " yours__text--hidden" : "")}
            aria-hidden={m.masked || undefined}
          >
            {m.text}
          </span>
          {m.hidden && <span className="label">hidden by admin</span>}
          {m.wallHidden && !m.hidden && (
            <Tooltip tip="A word here is one the wall does not show. You and the admin see it in full; everyone else sees a blur. The answer is yours as usual.">
              <span className="tag">blurred on the wall</span>
            </Tooltip>
          )}
          {m.visibility === "private" && (
            <Tooltip tip="Only you and the admin can see this ask">
              <span className="tag">private</span>
            </Tooltip>
          )}
          <VerdictChip reply={m.answers?.reply} answers={m.answers} />
          <StatusLabel status={m.status} judged={m.judged} />
          {m.status === "failed" && (
            <button
              className="ghost ghost--small"
              type="button"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
          <FollowUp m={m} />
        </div>
        <AnswerBlock message={m} compact />
        <OpenAskNote m={m} />
        {m.answers && <JevAnswers answers={m.answers} defaultOpen={false} />}
      </div>

      {/* Under the card: where the ask lives now. Accounts get the history
          link. A visitor's live ask gets the draining rule, then the
          block leaves on its own. */}
      {signedIn ? (
        <p className="yours__note label">
          Kept in <Link href="/me#me-asks">your history</Link> with every ask
          before it.
        </p>
      ) : fades ? (
        <div className="yours__toWall">
          <span className="yours__drain" aria-hidden="true">
            <span
              className="yours__drainFill"
              style={{ animationDuration: `${FADE_MS}ms` }}
              onAnimationEnd={onDrained}
            />
          </span>
          <p className="yours__note label">
            Now on <a href="#wall">the wall</a>.
            <span className="yours__hold"> Hover to hold this card.</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StatusLabel({ status, judged }: { status: string; judged: boolean }) {
  if (status === "judging") {
    return (
      <span className="label label--ink">
        <span className="dot dot--pulse" /> Judging
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="label label--ink">
        {judged ? "Live" : "Live · Jev offline"}
      </span>
    );
  }
  if (status === "blocked") {
    return <span className="label">Held back by Jev</span>;
  }
  return <span className="label">Judge unreachable</span>;
}
