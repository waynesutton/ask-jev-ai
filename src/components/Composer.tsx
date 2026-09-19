import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  checkWords,
  hasBlockedText,
  MASK,
  MAX_WORDS,
  MIN_WORDS,
} from "../../convex/lib/words";

type Props = {
  sessionId: string;
};

// Asks that Jev can settle. Every word is on the safe list, each one lands
// on a different reply (yes, no, depends), and a click drops it in the box.
const EXAMPLES = [
  "is the ocean salty",
  "can pigs fly",
  "will it rain tomorrow",
] as const;

// First words that usually open a yes or no question. Used only for the
// nudge under the box; the server never sees this list.
const YES_NO_STARTERS: ReadonlySet<string> = new Set([
  "is",
  "are",
  "am",
  "was",
  "were",
  "can",
  "could",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "has",
  "have",
  "had",
  "may",
  "might",
]);

// Underline input, live word checks, one filled button. The blocklist and
// allowlist run here for instant feedback and again on the server for
// enforcement. A blocked word is shown as *** and can never be posted.
export function Composer({ sessionId }: Props) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const send = useMutation(api.messages.send);
  const inputRef = useRef<HTMLInputElement>(null);

  // Put the cursor in the box on load so the first thing anyone sees is a
  // blinking caret. Skipped on touch devices, where autofocus throws the
  // keyboard over the page, and when the URL points at another section.
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (finePointer && !window.location.hash) {
      inputRef.current?.focus({ preventScroll: true });
      // Browsers hold the focus event until the window is active, so set
      // the state from activeElement rather than waiting for onFocus.
      setFocused(document.activeElement === inputRef.current);
    }
  }, []);

  const checks = checkWords(value);
  const count = checks.length;
  const wordBlocked = checks.some((c) => c.blocked);
  // Profanity spelled out across words (f u c k). No single chip is guilty,
  // so the single letter chips get masked together.
  const spreadBlocked = !wordBlocked && hasBlockedText(value);
  const blocked = wordBlocked || spreadBlocked;
  const masked = (c: (typeof checks)[number]) =>
    c.blocked || (spreadBlocked && c.clean.length <= 1);
  const unsafe = checks.filter((c) => !c.ok).length;
  const allSafe = unsafe === 0 && !blocked;
  const inRange = count >= MIN_WORDS && count <= MAX_WORDS;
  const ready = inRange && allSafe && !busy;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await send({ text: value, sessionId });
      if (result.ok) {
        setValue("");
      } else {
        const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
        setNote(`Slow down. Try again in ${seconds}s`);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not post");
    } finally {
      setBusy(false);
    }
  };

  // Nudge toward a yes or no shape once the ask is otherwise ready. Prod
  // shows about four in ten asks come back "not a yes or no question".
  const yesNoShape = count === 0 || YES_NO_STARTERS.has(checks[0]?.clean ?? "");

  const useExample = (text: string) => {
    setValue(text);
    setNote(null);
    inputRef.current?.focus();
  };

  let countNote: string;
  if (blocked) countNote = "That word is not allowed here";
  else if (count === 0) countNote = `${MIN_WORDS} to ${MAX_WORDS} words`;
  else if (count < MIN_WORDS) countNote = `${count} / ${MIN_WORDS} words to go`;
  else if (count > MAX_WORDS)
    countNote = `${count} words. Cut ${count - MAX_WORDS}`;
  else if (!allSafe)
    countNote =
      unsafe === 1
        ? "One word is not on the safe list"
        : `${unsafe} words are not on the safe list`;
  else if (!yesNoShape)
    countNote = `Ready · ${count} of ${MAX_WORDS} · for a yes or no, start with is, can, or will`;
  else countNote = `Ready · ${count} of ${MAX_WORDS}`;

  return (
    <form className="composer" onSubmit={onSubmit}>
      <label className="label" htmlFor="ask-jev">
        Ask Jev · {MIN_WORDS} to {MAX_WORDS} words
      </label>
      <p className="composer__guide body-sm">
        Jev answers <b>yes</b>, <b>no</b>, or <b>it depends</b>. Ask something
        that can be settled that way.{" "}
        <span className="composer__try">
          Try{" "}
          {EXAMPLES.map((text, i) => (
            <span key={text}>
              <button
                type="button"
                className="composer__example"
                onClick={() => useExample(text)}
              >
                {text}
              </button>
              {i < EXAMPLES.length - 1 && " · "}
            </span>
          ))}
        </span>
      </p>
      <div className="composer__row">
        <div
          className={
            "composer__field" + (focused ? " composer__field--focused" : "")
          }
        >
          <input
            ref={inputRef}
            id="ask-jev"
            className="composer__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="ask jev anything"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            aria-describedby="composer-count"
          />
        </div>
        <button className="pill pill--accent" type="submit" disabled={!ready}>
          {busy ? "Posting" : "Ask"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="chips" aria-hidden="true">
        {checks.map((c, i) => (
          <span
            key={`${c.raw}-${i}`}
            className={
              "chip" +
              (masked(c) || !c.ok
                ? " chip--bad"
                : i >= MAX_WORDS
                  ? " chip--extra"
                  : "")
            }
          >
            {masked(c) ? MASK : c.raw}
          </span>
        ))}
      </div>
      <div className="composer__note label" id="composer-count">
        <span className={inRange && allSafe ? "label--ink" : ""}>
          {countNote}
        </span>
        {note && <span role="status"> · {note}</span>}
      </div>
    </form>
  );
}
