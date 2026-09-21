import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  checkWords,
  countOpenWords,
  hasBlockedText,
  hasProfanity,
  MASK,
  MAX_OPEN_CHARS,
  MAX_OPEN_WORDS,
  MAX_WORDS,
  MIN_WORDS,
} from "../../convex/lib/words";
import { useMe } from "../hooks/useMe";
import { Link } from "./Link";
import { Tooltip } from "./Tooltip";

type Props = {
  sessionId: string;
};

type Visibility = "public" | "private";

// The box grows with the text up to this many pixels, then scrolls inside.
// About eight lines at the body size.
const MAX_BOX_HEIGHT = 220;

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

const STORAGE_KEY = "ask-jev:visibility";

function storedVisibility(): Visibility {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "private"
      ? "private"
      : "public";
  } catch {
    return "public";
  }
}

// One box, like a chat composer. The textarea grows with the text, and a
// bar inside the box holds the word count on the left and the one filled
// button on the right, so the button never stretches with the field.
//
// For visitors the blocklist and allowlist run here for instant feedback
// and again on the server for enforcement. A blocked word is shown as ***
// and can never be posted.
//
// Signed in, the head gains a Wall | Private toggle and both word lists
// step aside: up to sixty words of anything, on the wall or private. A
// blocklist word does not stop the ask; the note says the wall will blur it
// for others, and the server sets the flag.
export function Composer({ sessionId }: Props) {
  const me = useMe();
  const signedIn = me !== null && me !== undefined;
  const paused = me?.status === "paused";
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>(storedVisibility);
  const send = useMutation(api.messages.send);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Grow the textarea to fit, up to a cap, then let it scroll. Reset to
  // auto first so it also shrinks when text is deleted or cleared.
  const fit = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_BOX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_BOX_HEIGHT ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [value, fit]);

  // Remember the toggle per browser so a private asker stays private.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, visibility);
    } catch {
      // Storage blocked. The toggle still works for this page.
    }
  }, [visibility]);

  const privateMode = signedIn && visibility === "private";

  // Visitor path: chips, allowlist, blocklist as a hard stop.
  const checks = checkWords(value);
  const wordBlocked = checks.some((c) => c.blocked);
  // Profanity spelled out across words (f u c k). No single chip is guilty,
  // so the single letter chips get masked together.
  const spreadBlocked = !wordBlocked && hasBlockedText(value);
  const blocked = wordBlocked || spreadBlocked;
  const masked = (c: (typeof checks)[number]) =>
    c.blocked || (spreadBlocked && c.clean.length <= 1);
  const unsafe = signedIn ? 0 : checks.filter((c) => !c.ok).length;

  // Signed in path: the same count the server uses, no list can say no.
  // `willBlur` is the one thing worth telling the asker before they post.
  const count = signedIn ? countOpenWords(value) : checks.length;
  const willBlur = signedIn && count > 0 && hasProfanity(value);
  const allSafe = signedIn ? true : unsafe === 0 && !blocked;
  const maxWords = signedIn ? MAX_OPEN_WORDS : MAX_WORDS;
  const minWords = signedIn ? 1 : MIN_WORDS;
  const inRange = count >= minWords && count <= maxWords;
  const ready = inRange && allSafe && !busy && !paused;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await send({
        text: value,
        sessionId,
        visibility: signedIn ? visibility : undefined,
      });
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

  // Keyboard hint only while the box is empty and signed in. Hidden on
  // phones by CSS, where Enter on the soft keyboard is not a send key.
  const keyHint = signedIn && count === 0 && !paused;

  let countNote: string;
  if (paused) countNote = "Your account is paused";
  else if (!signedIn && blocked) countNote = "That word is not allowed here";
  else if (count === 0)
    countNote = signedIn
      ? `Up to ${maxWords} words`
      : `${MIN_WORDS} to ${MAX_WORDS} words · yes, no, or it depends`;
  else if (count < minWords) countNote = `${count} / ${minWords} words to go`;
  else if (count > maxWords)
    countNote = `${count} words. Cut ${count - maxWords}`;
  else if (!allSafe)
    countNote =
      unsafe === 1
        ? "One word is not on the safe list"
        : `${unsafe} words are not on the safe list`;
  else if (willBlur && !privateMode)
    countNote = `Ready · ${count} of ${maxWords} · a word here gets blurred on the wall. You still get the answer`;
  else if (!signedIn && !yesNoShape)
    countNote = `Ready · ${count} of ${MAX_WORDS} · for a yes or no, start with is, can, or will`;
  else countNote = `Ready · ${count} of ${maxWords}`;

  return (
    <form className="composer" onSubmit={onSubmit}>
      <div className="composer__head">
        <label className="label" htmlFor="ask-jev">
          {signedIn ? "Ask Jev anything" : "Ask Jev"}
        </label>
        {signedIn ? (
          <div
            className="seg seg--small"
            role="group"
            aria-label="Where this ask goes"
          >
            <Tooltip tip="Anyone can see it. A word the wall does not show gets blurred for others; you and the answer are not affected.">
              <button
                type="button"
                className={
                  "seg__btn" + (visibility === "public" ? " seg__btn--on" : "")
                }
                aria-pressed={visibility === "public"}
                onClick={() => setVisibility("public")}
              >
                Wall
              </button>
            </Tooltip>
            <Tooltip tip="Only you and the admin see it. It lives in your history.">
              <button
                type="button"
                className={
                  "seg__btn" + (visibility === "private" ? " seg__btn--on" : "")
                }
                aria-pressed={visibility === "private"}
                onClick={() => setVisibility("private")}
              >
                Private
              </button>
            </Tooltip>
          </div>
        ) : (
          <span className="label composer__headNote">
            <Link href="/sign-in">Sign in</Link> to ask anything
          </span>
        )}
      </div>

      {/* The box. Field on top, bar underneath, one border around both.
          Focus moves the border to the accent, driven by React so it holds
          when the window itself is not focused. */}
      <div
        className={"composer__box" + (focused ? " composer__box--focused" : "")}
      >
        <div className="composer__field">
          <textarea
            ref={inputRef}
            id="ask-jev"
            className="composer__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              // Enter sends. Shift+Enter makes a new line for longer asks.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e);
              }
            }}
            placeholder={
              signedIn
                ? "Ask anything, for real"
                : "Ask something Jev can settle"
            }
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={signedIn}
            maxLength={signedIn ? MAX_OPEN_CHARS : 200}
            rows={1}
            disabled={paused}
            aria-describedby="composer-count"
          />
        </div>
        <div className="composer__bar">
          <span
            className={
              "label composer__count" +
              (inRange && allSafe && !paused ? " label--ink" : "")
            }
            id="composer-count"
          >
            {countNote}
            {keyHint && (
              <span className="composer__keyHint">
                {" "}
                · Enter sends, Shift Enter for a new line
              </span>
            )}
            {note && <span role="status"> · {note}</span>}
          </span>
          <button
            className="pill pill--accent composer__send"
            type="submit"
            disabled={!ready}
          >
            {busy ? "Posting" : "Ask"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Chips are the visitor's word by word feedback. Signed in, nothing
          can be rejected, so the chips only appear to point at a word the
          wall will blur. Hidden while the box is empty so the block stays
          quiet until someone types. */}
      {(!signedIn || willBlur) && count > 0 && (
        <div className="chips" aria-hidden="true">
          {checks.slice(0, maxWords + 5).map((c, i) => (
            <span
              key={`${c.raw}-${i}`}
              className={
                "chip" +
                (masked(c) || (!signedIn && !c.ok)
                  ? " chip--bad"
                  : i >= maxWords
                    ? " chip--extra"
                    : "")
              }
            >
              {masked(c) && !signedIn ? MASK : c.raw}
            </span>
          ))}
        </div>
      )}
      {signedIn && privateMode && (
        <p className="composer__note label">
          Private asks stay in <Link href="/me">your history</Link>. Nothing
          reaches the wall.
        </p>
      )}
    </form>
  );
}
