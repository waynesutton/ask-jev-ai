import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { BLOCK_THRESHOLD, REPLIES } from "../../convex/questions";
import { Tooltip } from "./Tooltip";

// The exact shape messages.ts exposes as `answers`. Kept local so this
// component does not need the generated api types.
export type Answers = {
  reply?: string;
  replyConfidence?: number;
  replyRunnerUp?: string;
  replyRunnerUpP?: number;
  unkind: number;
  adult: number;
  targetsPerson: number;
  mood: number;
  moodConfidence: number;
  topic: string;
  topicConfidence: number;
};

// Under this, a yes or no is a close call and the chip says so.
export const CLOSE_CALL = 0.6;
// A live ask whose top hazard sits between here and BLOCK_THRESHOLD gets a
// quiet "close to the line" tag. Below it the card says nothing.
export const EDGE_FLOOR = 0.3;
// The runner up row shows when the second choice carried at least this.
const RUNNER_UP_FLOOR = 0.15;

// Remembered per browser, like the count panel. Someone who opened the
// numbers once keeps them open on every card.
const OPEN_KEY = "jev:answers-open";

function readOpen(): boolean | null {
  try {
    const v = localStorage.getItem(OPEN_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

type Props = {
  answers: Answers;
  // Where the browser has no saved preference. Closed on the wall, open on
  // /a/:id where the page is about one ask.
  defaultOpen?: boolean;
};

// How sure Jev was, folded under each card. Two rows: the verdict with its
// confidence, and whether the ask fits the wall. Mood and topic are chips
// in the card foot already, so they do not repeat here. A shaky verdict
// gets a third row with the runner up, so `depends 61%` reads with
// `leaning yes 28%` under it.
export function JevAnswers({ answers, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(() => readOpen() ?? defaultOpen);
  const wall = wallCheck(answers);
  const runnerUp = runnerUpRow(answers);

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
    <div className="answers">
      <button
        className="answers__toggle caption"
        type="button"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? "Hide how sure Jev was" : "How sure was Jev"}
        <CaretDown
          size={12}
          aria-hidden="true"
          className={"answers__caret" + (open ? " answers__caret--open" : "")}
        />
      </button>

      {open && (
        <dl className="answers__list caption">
          {answers.reply !== undefined && (
            <Row
              q="Jev says"
              a={replyWord(answers.reply)}
              p={answers.replyConfidence}
            />
          )}
          {runnerUp && (
            <Row q="Runner up" a={runnerUp.word} p={runnerUp.p} sub />
          )}
          <Row q="Fits the wall?" a={wall.text} p={wall.p} hot={wall.held} />
        </dl>
      )}
    </div>
  );
}

// One question, one answer, one bar. The bar is a horizontal band from a
// common left baseline, so every row in the card lines up and the eye can
// compare how sure Jev was across answers. The percent sits outside the bar
// in a fixed width column, which is what keeps the tracks the same length.
function Row({
  q,
  a,
  p,
  hot = false,
  sub = false,
}: {
  q: string;
  a: string;
  p?: number;
  hot?: boolean;
  sub?: boolean;
}) {
  return (
    <div
      className={
        "answers__row" +
        (hot ? " answers__row--hot" : "") +
        (sub ? " answers__row--sub" : "")
      }
    >
      <dt className="answers__q muted">{q}</dt>
      <dd className="answers__a">{a}</dd>
      {typeof p === "number" && (
        <dd className="answers__bar">
          <span className="answers__track" aria-hidden="true">
            <span
              className="answers__fill"
              style={{ width: `${clamp(p) * 100}%` }}
            />
          </span>
          <span className="answers__pct">{pct(p)}</span>
          <span className="sr-only"> sure</span>
        </dd>
      )}
    </div>
  );
}

function clamp(p: number): number {
  return Math.min(1, Math.max(0, p));
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// Jev's answer to the ask, in words. How sure Jev was rides on the bar.
function replyWord(reply: string): string {
  switch (reply as keyof typeof REPLIES) {
    case "yes":
      return "yes";
    case "no":
      return "no";
    case "depends":
      return "it depends";
    case "open":
      return "not a yes or no question";
    default:
      return "that is not a question";
  }
}

// The runner up earns a row on a `depends`, where the lean is the whole
// story, or when the verdict itself was under CLOSE_CALL.
function runnerUpRow(a: Answers): { word: string; p: number } | null {
  if (!a.replyRunnerUp || typeof a.replyRunnerUpP !== "number") return null;
  if (a.replyRunnerUpP < RUNNER_UP_FLOOR) return null;
  const shaky =
    a.reply === "depends" ||
    (typeof a.replyConfidence === "number" && a.replyConfidence < CLOSE_CALL);
  if (!shaky) return null;
  return { word: replyWord(a.replyRunnerUp), p: a.replyRunnerUpP };
}

// Verdicts with a headline. "open" and "statement" get no chip because the
// model answer above (or the lack of one) already says it.
const CHIP_REPLIES = new Set(["yes", "no", "depends"]);

export type Verdict = {
  // "Jev: yes", "Jev: depends"
  label: string;
  // "94%" when confidence is known. Rows judged before it existed have none.
  pct?: string;
  // A yes or no under CLOSE_CALL.
  closeCall: boolean;
  // "leaning yes" on a depends, or the runner up on a close call.
  lean?: string;
};

// The one number a yes or no asker wants, ready for a chip. Callers pass
// the row's `reply` (present on rows older than `answers`) and whatever
// else they have.
export function verdict(
  reply: string | undefined,
  confidence?: number,
  runnerUp?: string,
  runnerUpP?: number,
): Verdict | null {
  if (!reply || !CHIP_REPLIES.has(reply)) return null;
  const known = typeof confidence === "number";
  const closeCall = known && reply !== "depends" && confidence < CLOSE_CALL;
  const showLean =
    runnerUp !== undefined &&
    CHIP_REPLIES.has(runnerUp) &&
    typeof runnerUpP === "number" &&
    runnerUpP >= RUNNER_UP_FLOOR &&
    (reply === "depends" || closeCall);
  return {
    label: `Jev: ${reply}`,
    pct: known ? pct(confidence) : undefined,
    closeCall,
    lean: showLean ? `leaning ${runnerUp}` : undefined,
  };
}

// Short chip text for places that only want the words.
export function replyChip(reply: string | undefined): string | null {
  return verdict(reply)?.label ?? null;
}

// The verdict chip, one look everywhere a card shows up: wall, ask page,
// profile rows, /me history, the Yours strip. The percent rides on the
// chip; a close call gets a second quiet tag. The tip explains the number.
export function VerdictChip({
  reply,
  answers,
}: {
  reply: string | undefined;
  answers?: Answers;
}) {
  const v = verdict(
    reply,
    answers?.replyConfidence,
    answers?.replyRunnerUp,
    answers?.replyRunnerUpP,
  );
  if (!v) return null;
  const tip = v.pct
    ? v.lean
      ? `Jev put ${v.pct} on ${reply}, ${v.lean}. Open "How sure was Jev" for the split.`
      : `Jev put ${v.pct} on ${reply}. The rest went to the other answers.`
    : "Jev's verdict on the ask";
  return (
    <>
      <Tooltip tip={tip}>
        <span className="tag">
          {v.label}
          {v.pct && <span className="tag__pct">· {v.pct}</span>}
        </span>
      </Tooltip>
      {v.closeCall && (
        <Tooltip
          tip={`Under ${Math.round(CLOSE_CALL * 100)}%. Jev could have gone the other way.`}
        >
          <span className="tag tag--quiet">close call</span>
        </Tooltip>
      )}
      {!v.closeCall && v.lean && (
        <span className="tag tag--quiet">{v.lean}</span>
      )}
    </>
  );
}

// One answer from three probes. The highest hazard decides. A clear message
// bars how sure Jev is that it belongs; a held one says why and bars how
// sure Jev is that it does not.
function hazards(a: Answers) {
  return [
    { p: a.unkind, why: "sounded unkind" },
    { p: a.adult, why: "not for a public wall" },
    { p: a.targetsPerson, why: "aimed at someone" },
  ];
}

function wallCheck(a: Answers): { text: string; p: number; held: boolean } {
  const top = hazards(a).reduce((m, h) => (h.p > m.p ? h : m));
  if (top.p >= BLOCK_THRESHOLD) {
    return { text: `no · ${top.why}`, p: top.p, held: true };
  }
  return { text: "yes", p: 1 - top.p, held: false };
}

// A live ask that came close to being held. Null for the harmless
// majority, so most cards say nothing about the gate at all.
export function wallEdge(a: Answers): { why: string; p: number } | null {
  const top = hazards(a).reduce((m, h) => (h.p > m.p ? h : m));
  if (top.p >= EDGE_FLOOR && top.p < BLOCK_THRESHOLD) {
    return { why: top.why, p: top.p };
  }
  return null;
}

// The quiet tag for a close to the line ask. Renders nothing otherwise.
export function EdgeTag({ answers }: { answers: Answers }) {
  const edge = wallEdge(answers);
  if (!edge) return null;
  return (
    <Tooltip
      tip={`Jev put this at ${pct(edge.p)} for ${edge.why}. The wall holds at ${Math.round(BLOCK_THRESHOLD * 100)}%.`}
    >
      <span className="tag tag--quiet">close to the line</span>
    </Tooltip>
  );
}
