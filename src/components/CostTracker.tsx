import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { CaretDown } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { useNow } from "../hooks/useNow";
import {
  formatCount,
  formatUsd,
  roughDuration,
  stopwatch,
} from "../lib/format";
import { Tooltip } from "./Tooltip";

// Remembered per browser so someone who opened the numbers once keeps them.
const OPEN_KEY = "jev:numbers-open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Realtime spend as rows inside the count panel, split by dotted rules.
// Three rows always show, the ones people quote: what Jev has cost, what a
// million would cost, and how long a million will take at this pace. The
// rest (per message, tokens, model answers, the stopwatch) sit behind a
// closed toggle so the panel ends near the box beside it and the wall
// header lands above the fold. Cost updates the moment a verdict lands
// because every judged message adds to a sharded counter.
export function CostTracker() {
  const cost = useQuery(api.stats.cost);
  const counts = useQuery(api.stats.counts);
  const agreement = useQuery(api.stats.agreement);
  const now = useNow(1000);
  const [open, setOpen] = useState(readOpen);

  if (!cost) return null;

  const metered = cost.judged > 0;
  const elapsed = counts ? now - counts.startedAt : 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // Private mode or storage off. The toggle still works for this visit.
    }
  };

  return (
    <>
      <div className="stats">
        <Stat
          label="Jev spend"
          value={formatUsd(cost.totalUsd)}
          tip="Every Jev judgment so far, at list price. Jev bills tokens in; output is free."
        />
        <Stat
          label="To one million"
          value={
            cost.projectedUsd === null
              ? "Waiting"
              : formatUsd(cost.projectedUsd)
          }
          tip="Per message cost times one million"
        />
        {counts && (
          <Stat
            label="At this pace"
            value={paceLeft(counts.live, counts.goal, elapsed)}
            tip="Rough time left to one million at the rate so far"
          />
        )}
      </div>

      <button
        type="button"
        className="label panel__toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="panel-more"
      >
        {open ? "Fewer numbers" : "More numbers"}
        <CaretDown
          size={12}
          aria-hidden="true"
          className={"answers__caret" + (open ? " answers__caret--open" : "")}
        />
      </button>

      {open && (
        <div id="panel-more" className="panel__more">
          <div className="stats">
            <Stat
              label="Per message"
              value={
                cost.perMessageUsd === null
                  ? "Waiting"
                  : formatUsd(cost.perMessageUsd)
              }
              tip="Jev spend divided by judged messages"
            />
            <Stat
              label={metered ? "Tokens in" : "Price"}
              value={
                metered
                  ? formatCount(cost.inputTokens)
                  : `$${cost.inputUsdPerMtok} per million`
              }
              tip={
                metered
                  ? "Input tokens Jev has read across every judgment"
                  : "Jev's list price per million input tokens"
              }
            />
            {cost.answers > 0 && (
              <>
                <Stat
                  label="Model answers"
                  value={formatCount(cost.answers)}
                  tip="Short answers written for signed in asks through the Convex AI Gateway"
                />
                <Stat
                  label="Answer spend"
                  value={formatUsd(cost.answerUsd)}
                  tip={`Tokens in and out at each model's list price. ${formatCount(cost.answerInputTokens + cost.answerOutputTokens)} tokens so far.`}
                />
                <Stat
                  label="Per answer"
                  value={
                    cost.perAnswerUsd === null
                      ? "Waiting"
                      : formatUsd(cost.perAnswerUsd)
                  }
                  tip="Answer spend divided by answers"
                />
              </>
            )}
            {agreement && agreement.rate !== null && (
              <Stat
                label="Agreed with Jev"
                value={`${Math.round(agreement.rate * 100)}%`}
                tip={`${formatCount(agreement.agree)} of ${formatCount(agreement.total)} thumbs said Jev got the verdict right. Votes measure Jev, they never change a verdict.`}
              />
            )}
            {counts && (
              <Stat
                label="On the clock"
                value={stopwatch(elapsed)}
                tip="Time since the counter started"
              />
            )}
          </div>
          {counts && (
            <p className="label panel__foot">
              Clock started 12:31 AM PDT · Sep 17, 2026
            </p>
          )}
        </div>
      )}
    </>
  );
}

// remaining / (live per ms). Needs at least one live message and a minute
// on the clock before the rate means anything.
function paceLeft(live: number, goal: number, elapsedMs: number): string {
  if (live >= goal) return "Done";
  if (live === 0 || elapsedMs < 60_000) return "Waiting";
  const perMs = live / elapsedMs;
  return `${roughDuration((goal - live) / perMs)} left`;
}

function Stat({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip: ReactNode;
}) {
  return (
    <Tooltip tip={tip} side="left">
      <div className="stat" tabIndex={0}>
        <span className="label">{label}</span>
        <span className="stat__value">{value}</span>
      </div>
    </Tooltip>
  );
}
