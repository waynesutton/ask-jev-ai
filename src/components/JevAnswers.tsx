import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import {
  BLOCK_THRESHOLD,
  MOOD_LABELS,
  REPLIES,
  TOPICS,
} from "../../convex/questions";

// The exact shape messages.ts exposes as `answers`. Kept local so this
// component does not need the generated api types.
export type Answers = {
  reply?: string;
  replyConfidence?: number;
  unkind: number;
  adult: number;
  targetsPerson: number;
  mood: number;
  moodConfidence: number;
  topic: string;
  topicConfidence: number;
};

type Props = {
  answers: Answers;
  defaultOpen?: boolean;
};

// Jev's answers for one message in plain language, open by default on the
// wall and closed under the composer where space is tight. Mood and topic
// show with how sure Jev is. The three safety probes (unkind, adult, targets
// a person) fold into one "Fits the wall?" row so nobody reads a list of
// hazard names next to a harmless post. A held message shows why in words.
export function JevAnswers({ answers, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const wall = wallCheck(answers);

  return (
    <div className="answers">
      <button
        className="answers__toggle caption"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide Jev's answers" : "Show Jev's answers"}
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
          <Row
            q="How does it feel?"
            a={moodLevel(answers.mood)}
            p={answers.moodConfidence}
          />
          <Row
            q="What is it about?"
            a={topicLabel(answers.topic)}
            p={answers.topicConfidence}
          />
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
}: {
  q: string;
  a: string;
  p?: number;
  hot?: boolean;
}) {
  return (
    <div className={"answers__row" + (hot ? " answers__row--hot" : "")}>
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

// Score comes back as a weighted position across the five mood levels.
function moodLevel(score: number): string {
  const index = Math.min(
    MOOD_LABELS.length - 1,
    Math.max(0, Math.round(score)),
  );
  return MOOD_LABELS[index].toLowerCase();
}

function topicLabel(topic: string): string {
  return topic in TOPICS ? topic : "other";
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

// Short chip for wall cards. Only the answers worth a headline.
export function replyChip(reply: string | undefined): string | null {
  if (reply === "yes" || reply === "no") return `Jev: ${reply}`;
  if (reply === "depends") return "Jev: depends";
  return null;
}

// One answer from three probes. The highest hazard decides. A clear message
// bars how sure Jev is that it belongs; a held one says why and bars how
// sure Jev is that it does not.
function wallCheck(a: Answers): { text: string; p: number; held: boolean } {
  const hazards = [
    { p: a.unkind, why: "sounded unkind" },
    { p: a.adult, why: "not for a public wall" },
    { p: a.targetsPerson, why: "aimed at someone" },
  ];
  const top = hazards.reduce((m, h) => (h.p > m.p ? h : m));
  if (top.p >= BLOCK_THRESHOLD) {
    return { text: `no · ${top.why}`, p: top.p, held: true };
  }
  return { text: "yes", p: 1 - top.p, held: false };
}
