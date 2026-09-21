import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMe } from "../hooks/useMe";
import { AnswerBlock } from "./AnswerBlock";
import { FollowUp, signInHref } from "./FollowUp";
import { JevAnswers, VerdictChip } from "./JevAnswers";
import { Link } from "./Link";
import { Tooltip } from "./Tooltip";

type Props = {
  sessionId: string;
};

// How many of your own posts sit under the composer. The rest are on the wall.
const SHOWN = 3;

// Your latest posts, every status. Watch judging flip to live, and Jev's
// headline answer land as a chip. Full answers stay one click away so the
// hero card keeps its shape.
//
// For visitors, Jev's `reply` Choice doubles as the sign in prompt. When
// it comes back `open` (what, why, how) the card says so and points at
// sign in, where the same ask would get a model answer. No extra call: the
// detection is one of the seven questions Jev already answered.
export function Yours({ sessionId }: Props) {
  const mine = useQuery(api.messages.mine, { sessionId });
  const retry = useMutation(api.messages.retry);
  const me = useMe();
  const visitor = me === null;

  if (!mine || mine.length === 0) return null;

  return (
    <div className="yours">
      <span className="label">Yours</span>
      <ul
        className="yours__list"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {mine.slice(0, SHOWN).map((m) => (
          <li key={m._id} className={`yours__item yours__item--${m.status}`}>
            <div className="yours__row">
              <span
                className={
                  "yours__text" + (m.masked ? " yours__text--hidden" : "")
                }
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
                  onClick={() => void retry({ messageId: m._id, sessionId })}
                >
                  Retry
                </button>
              )}
              <FollowUp m={m} />
            </div>
            <AnswerBlock message={m} compact />
            {visitor && m.status === "live" && m.answers?.reply === "open" && (
              <p className="yours__nudge body-sm">
                Jev read this as an open question, not a yes or no.{" "}
                <Link href={signInHref(`/a/${m._id}`)}>Sign in</Link> and a
                model Jev picks writes the answer.
              </p>
            )}
            {m.answers && (
              <JevAnswers answers={m.answers} defaultOpen={false} />
            )}
          </li>
        ))}
      </ul>
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
