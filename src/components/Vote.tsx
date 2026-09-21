import { useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getSessionId } from "../lib/session";
import { formatCount } from "../lib/format";
import { Tooltip } from "./Tooltip";

// "Was Jev right?" Two thumbs under a verdict. Anyone can tap, once per
// ask, signed in or not. The vote never changes the verdict; it measures
// it, and feeds the agreement rate in the count panel.

// The viewer's own votes. Every card calls this with the same session id,
// so Convex keeps one subscription and hands each card the same array.
function useMyVotes(): Map<Id<"messages">, boolean> | undefined {
  const sessionId = useMemo(() => getSessionId(), []);
  const rows = useQuery(api.votes.mine, { sessionId });
  return useMemo(() => {
    if (!rows) return undefined;
    const map = new Map<Id<"messages">, boolean>();
    for (const r of rows) map.set(r.messageId, r.agree);
    return map;
  }, [rows]);
}

type Props = {
  messageId: Id<"messages">;
  agree: number;
  disagree: number;
  // Off for a paused account, matching the composer.
  disabled?: boolean;
};

export function VoteButtons({
  messageId,
  agree,
  disagree,
  disabled = false,
}: Props) {
  const mine = useMyVotes();
  const cast = useMutation(api.votes.cast);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const my = mine?.get(messageId);

  const tap = async (value: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      const result = await cast({
        messageId,
        sessionId: getSessionId(),
        agree: value,
      });
      if (!result.ok) {
        setNote(`Slow down, ${Math.ceil(result.retryAfterMs / 1000)}s`);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not vote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vote caption" role="group" aria-label="Was Jev right?">
      <Tooltip
        tip={
          my === true
            ? "You agreed. Tap to take it back."
            : "Jev got this right"
        }
      >
        <button
          type="button"
          className={"vote__btn" + (my === true ? " vote__btn--on" : "")}
          aria-pressed={my === true}
          aria-label="Agree with Jev"
          disabled={busy || disabled}
          onClick={() => void tap(true)}
        >
          <ThumbsUp
            size={13}
            weight={my === true ? "fill" : "regular"}
            aria-hidden="true"
          />
          {agree > 0 && <span className="vote__n">{formatCount(agree)}</span>}
        </button>
      </Tooltip>
      <Tooltip
        tip={
          my === false
            ? "You disagreed. Tap to take it back."
            : "Jev got this wrong"
        }
      >
        <button
          type="button"
          className={"vote__btn" + (my === false ? " vote__btn--on" : "")}
          aria-pressed={my === false}
          aria-label="Disagree with Jev"
          disabled={busy || disabled}
          onClick={() => void tap(false)}
        >
          <ThumbsDown
            size={13}
            weight={my === false ? "fill" : "regular"}
            aria-hidden="true"
          />
          {disagree > 0 && (
            <span className="vote__n">{formatCount(disagree)}</span>
          )}
        </button>
      </Tooltip>
      {note && (
        <span className="vote__note muted" role="status">
          {note}
        </span>
      )}
    </div>
  );
}

// Read only tally for dense lists (profile rows, /me history) where two
// buttons per row would be noise. Renders nothing until someone votes.
export function AgreedNote({
  agree,
  disagree,
}: {
  agree: number;
  disagree: number;
}) {
  const total = agree + disagree;
  if (total === 0) return null;
  return (
    <Tooltip tip="People who tapped whether Jev got this right">
      <span>
        {formatCount(agree)} of {formatCount(total)} agreed
      </span>
    </Tooltip>
  );
}
