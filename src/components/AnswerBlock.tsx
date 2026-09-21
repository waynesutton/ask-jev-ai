import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { ROUTES, isRoute } from "../../convex/questions";
import { useSmoothText } from "../hooks/useSmoothText";
import { formatUsd } from "../lib/format";
import { Tooltip } from "./Tooltip";

// The wall row shape, as the client sees it.
export type PublicMessage = FunctionReturnType<
  typeof api.messages.wall
>["page"][number];

type Props = {
  message: PublicMessage;
  // Compact for wall cards; full on the ask page.
  compact?: boolean;
};

// The model's short answer under an ask, with the model name and the one
// line reason Jev picked it. Text arrives in chunks while the model
// streams; useSmoothText paces it so the card reads rather than jumps.
export function AnswerBlock({ message: m, compact = false }: Props) {
  const status = m.answerStatus;
  const streaming = status === "streaming";
  const text = useSmoothText(m.answerText ?? "", { streaming });

  if (!status || status === "skipped") return null;
  if (m.answerHidden) {
    return (
      <div className="answer answer--hidden">
        <span className="label">Answer hidden by admin</span>
      </div>
    );
  }

  const route = m.route && isRoute(m.route) ? ROUTES[m.route] : null;
  const modelLabel = route?.label ?? m.answerModel ?? "a model";
  const why = route
    ? `Jev read this as a question that ${route.why}`
    : "Jev picked a model for this ask";

  return (
    <div className={"answer" + (compact ? " answer--compact" : "")}>
      <div className="answer__head label">
        <Tooltip tip={`${why}. Routed through the Convex AI Gateway.`}>
          <span className="answer__model">
            <span className={"dot" + (streaming ? " dot--pulse" : "")} />
            {modelLabel}
          </span>
        </Tooltip>
        <span className="answer__why">{why}</span>
        {status === "done" && typeof m.answerLatencyMs === "number" && (
          <Tooltip
            tip={
              typeof m.answerCostUsd === "number"
                ? `${formatUsd(m.answerCostUsd)} at list price for this answer`
                : "Time from Jev's verdict to the last token"
            }
          >
            <span>{(m.answerLatencyMs / 1000).toFixed(1)}s</span>
          </Tooltip>
        )}
      </div>
      {status === "pending" && (
        <p className="answer__text body-sm muted">Thinking</p>
      )}
      {(status === "streaming" || status === "done") && (
        <p className="answer__text body-sm">
          {text || (streaming ? "\u2026" : "")}
        </p>
      )}
      {status === "failed" && (
        <p className="answer__text body-sm muted">
          The model did not answer. Jev's verdict above still stands.
        </p>
      )}
    </div>
  );
}
