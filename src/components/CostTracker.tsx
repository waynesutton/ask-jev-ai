import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNow } from "../hooks/useNow";
import {
  formatCount,
  formatUsd,
  roughDuration,
  stopwatch,
} from "../lib/format";

// Realtime Jev spend as rows inside the count panel, split by dotted rules,
// then the clock: how long the run has been going and, at the pace so far,
// how long is left to one million. Cost updates the moment a verdict lands
// because every judged message adds to a sharded counter.
export function CostTracker() {
  const cost = useQuery(api.stats.cost);
  const counts = useQuery(api.stats.counts);
  const now = useNow(1000);

  if (!cost) return null;

  const metered = cost.judged > 0;

  return (
    <>
      <div className="stats">
        <Stat label="Jev spend" value={formatUsd(cost.totalUsd)} />
        <Stat
          label="Per message"
          value={
            cost.perMessageUsd === null
              ? "Waiting"
              : formatUsd(cost.perMessageUsd)
          }
        />
        <Stat
          label="To one million"
          value={
            cost.projectedUsd === null
              ? "Waiting"
              : formatUsd(cost.projectedUsd)
          }
        />
        <Stat
          label={metered ? "Tokens in" : "Price"}
          value={
            metered
              ? formatCount(cost.inputTokens)
              : `$${cost.inputUsdPerMtok} per million`
          }
        />
        {counts && (
          <>
            <Stat
              label="On the clock"
              value={stopwatch(now - counts.startedAt)}
            />
            <Stat
              label="At this pace"
              value={paceLeft(counts.live, counts.goal, now - counts.startedAt)}
            />
          </>
        )}
      </div>
      {counts && (
        <p className="label panel__foot">
          Clock started 12:31 AM PDT · Sep 17, 2026
        </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}
