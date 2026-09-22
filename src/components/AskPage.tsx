import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ChatCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { modelLabel } from "../../convex/questions";
import { MAX_OPEN_WORDS } from "../../convex/lib/words";
import { useMe } from "../hooks/useMe";
import { useNow } from "../hooks/useNow";
import { useSmoothText } from "../hooks/useSmoothText";
import { userMessage } from "../lib/errors";
import { timeAgo } from "../lib/format";
import { AnswerBlock } from "./AnswerBlock";
import { CopyLink } from "./CopyLink";
import { signInHref } from "./FollowUp";
import { EdgeTag, JevAnswers, VerdictChip } from "./JevAnswers";
import { Link } from "./Link";
import { OpenAskNote } from "./OpenAsk";
import { ThemeToggle } from "./ThemeToggle";
import { Hint, Tooltip } from "./Tooltip";
import { VoteButtons } from "./Vote";

type Ask = NonNullable<FunctionReturnType<typeof api.messages.get>>;

// /a/:id. One ask, Jev's verdict, the model's answer, and the threads
// under it. Two lanes: the asker's thread, which anyone can read on a
// public ask, and the viewer's own lane, where their follow ups go. For
// the asker the two are the same thread. For anyone else signed in the
// lane is a private side thread on this ask. A visitor gets a sign in
// card. Follow ups stream in token by token either way.
export function AskPage({ id }: { id: string }) {
  const messageId = id as Id<"messages">;
  const ask = useQuery(api.messages.get, { messageId });
  const me = useMe();
  const now = useNow();

  useEffect(() => {
    document.title = ask ? `${ask.text} · Ask Jev` : "Ask Jev";
  }, [ask]);

  return (
    <main className="admin page">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">
        {ask === undefined ? (
          <p className="label">Loading</p>
        ) : ask === null ? (
          <div className="card empty">
            <p className="subheading">This ask is private or does not exist.</p>
            {me === null && (
              <p className="body-sm muted">
                If it is yours, <Link href="/sign-in">sign in</Link> to see it.
              </p>
            )}
          </div>
        ) : (
          <>
            <article className="card ask">
              <div className="ask__meta label">
                {ask.author ? (
                  ask.author.publicProfile ? (
                    <Link href={`/${ask.author.handle}`}>
                      @{ask.author.handle}
                    </Link>
                  ) : (
                    <span>@{ask.author.handle}</span>
                  )
                ) : (
                  <span>anonymous</span>
                )}
                <span>{timeAgo(ask._creationTime, now)}</span>
                <Tooltip
                  tip={
                    ask.visibility === "private"
                      ? "Only you and the admin can see this ask"
                      : "Anyone can see this ask on the wall"
                  }
                >
                  <span className="tag">{ask.visibility}</span>
                </Tooltip>
                {ask.hidden && <span className="tag">hidden by admin</span>}
                {ask.wallHidden && !ask.hidden && (
                  <Tooltip
                    tip={
                      ask.masked
                        ? "This ask uses a word the wall does not show. The asker still has it, and its answer, in full."
                        : "This ask uses a word the wall does not show. You see it in full; the wall blurs it for others."
                    }
                  >
                    <span className="tag">
                      {ask.masked ? "held words" : "blurred for others"}
                    </span>
                  </Tooltip>
                )}
                <CopyLink messageId={ask._id} />
              </div>
              <h1
                className={
                  "heading-lg ask__text" +
                  (ask.masked ? " wallcard__text--hidden" : "")
                }
                aria-hidden={ask.masked || undefined}
              >
                {ask.text}
              </h1>
              {/* The verdict line: chip with its percent, a close to the
                  line tag when the gate was near, and the thumbs. */}
              {ask.judged && !ask.masked && (
                <div className="ask__verdict caption">
                  <VerdictChip reply={ask.reply} answers={ask.answers} />
                  {ask.answers && ask.status === "live" && (
                    <EdgeTag answers={ask.answers} />
                  )}
                  {ask.status === "live" &&
                    (ask.reply === "yes" ||
                      ask.reply === "no" ||
                      ask.reply === "depends") && (
                      <VoteButtons
                        messageId={ask._id}
                        agree={ask.agree}
                        disagree={ask.disagree}
                        disabled={me?.status === "paused"}
                      />
                    )}
                </div>
              )}
              {ask.answers && <JevAnswers answers={ask.answers} defaultOpen />}
              {!ask.answers && ask.status === "judging" && (
                <p className="label label--ink">
                  <span className="dot dot--pulse" /> Jev is judging
                </p>
              )}
              {ask.status === "blocked" && (
                <p className="body-sm muted">
                  Jev held this ask back, so no model answered it.
                </p>
              )}
              {/* Anonymous open ask: why there is no answer, and the way in. */}
              <OpenAskNote m={ask} />
              <AnswerBlock message={ask} />
            </article>

            <Threads ask={ask} me={me} />
          </>
        )}
      </section>
    </main>
  );
}

// The lanes under the card. See the note on AskPage for who gets which.
function Threads({ ask, me }: { ask: Ask; me: ReturnType<typeof useMe> }) {
  const lane = ask.followUp;
  const paused = me?.status === "paused";
  const open = ask.status === "live" && !ask.masked && !ask.hidden;

  return (
    <>
      {/* The asker's thread. The model's first answer is on the card, so
          the list starts at the first follow up. For the asker this is
          also where their composer sits. The head says who can read it:
          the thread follows the ask, so a wall ask has a public thread
          and a private ask a private one. Said here, before the asker
          types, not after. */}
      {ask.threadId && (
        <section className="thread" aria-labelledby="asker-thread-title">
          <div className="thread__head">
            <h2 className="subheading" id="asker-thread-title">
              {lane?.kind === "own" ? "Your thread" : "The asker's thread"}
            </h2>
            <Tooltip
              tip={
                ask.visibility === "private"
                  ? "Private, like the ask. Only you and the admin can read this thread."
                  : lane?.kind === "own"
                    ? "Public, like your ask. Anyone reading it can read your follow ups. Make the ask private on /me and the thread goes with it."
                    : "The asker's follow ups with the model. Public, like the ask."
              }
            >
              <span className="tag">{ask.visibility} thread</span>
            </Tooltip>
          </div>
          <ThreadList
            messageId={ask._id}
            threadId={ask.threadId}
            skip={2}
            empty={
              lane?.kind === "own" ? (
                <p className="label">
                  Keep going. {modelLabel(lane.model)} has the context.
                </p>
              ) : null
            }
          />
          {lane?.kind === "own" && (
            <FollowUpForm
              messageId={ask._id}
              paused={paused}
              note={
                ask.visibility === "private"
                  ? "Private thread, like your ask. Follow ups count toward your asks."
                  : "Public thread, like your ask. Follow ups count toward your asks."
              }
            />
          )}
        </section>
      )}

      {/* Your own lane on someone else's ask. Private: the asker never sees
          it, and it never shows on the wall. */}
      {lane?.kind === "side" && (
        <section
          className="thread thread--side"
          aria-labelledby="follow-up-title"
        >
          <div className="thread__head">
            <h2 className="subheading" id="follow-up-title">
              Your follow ups{" "}
              <Hint tip="A private thread on this ask. The asker never sees it, and it never shows on the wall. The admin can read it for moderation." />
            </h2>
            <Tooltip tip="Jev routed the original ask to this model. Follow ups stay with it.">
              <span className="label">{modelLabel(lane.model)}</span>
            </Tooltip>
          </div>
          {lane.threadId ? (
            <ThreadList
              messageId={ask._id}
              threadId={lane.threadId}
              skip={0}
              empty={null}
            />
          ) : (
            <p className="body-sm muted">
              Ask why, ask what next. {modelLabel(lane.model)} answers with this
              ask and Jev's verdict as context. Only you and the admin can read
              this thread.
            </p>
          )}
          <FollowUpForm
            messageId={ask._id}
            paused={paused}
            note="Private thread. Follow ups count toward your asks."
          />
        </section>
      )}

      {/* A visitor on a live ask: what signing in gets them, then back here. */}
      {me === null && open && (
        <section className="card thread__signin">
          <p className="label">
            <ChatCircle size={12} aria-hidden="true" /> Follow ups
          </p>
          <p className="body-sm">
            Ask why, or what next. A model Jev picks answers with this ask as
            context, in a thread only you and the admin can read.
          </p>
          <Link
            className="pill pill--accent"
            href={signInHref(`/a/${ask._id}`)}
          >
            Sign in to ask follow up questions
          </Link>
        </section>
      )}

      {/* Signed in, nothing to write to: paused, or the asker before the
          first answer lands. */}
      {me && !lane && open && (
        <p className="label">
          {paused
            ? "Your account is paused, so follow ups are off"
            : "Follow ups open once the first answer lands"}
        </p>
      )}
    </>
  );
}

// One thread's messages, streaming. `skip` drops the leading turns that
// the card already shows.
function ThreadList({
  messageId,
  threadId,
  skip,
  empty,
}: {
  messageId: Id<"messages">;
  threadId: string;
  skip: number;
  empty: ReactNode;
}) {
  const { results, status } = useUIMessages(
    api.answer.listMessages,
    { threadId, messageId },
    { initialNumItems: 50, stream: true },
  );
  const rest = results.slice(skip);
  if (status === "LoadingFirstPage") {
    return <p className="label">Loading thread</p>;
  }
  if (rest.length === 0) return <>{empty}</>;
  return (
    <ul className="thread__list">
      {rest.map((m) => (
        <ThreadMessage key={m.key} message={m} />
      ))}
    </ul>
  );
}

// The composer for a follow up. One per lane. The server decides which
// thread the text lands in; this only sends. A `#follow-up` hash, from an
// "Ask a follow up" link elsewhere, lands focus here on mount.
function FollowUpForm({
  messageId,
  paused,
  note,
}: {
  messageId: Id<"messages">;
  paused: boolean;
  note: string;
}) {
  const followUp = useMutation(api.answer.followUp);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (window.location.hash !== "#follow-up") return;
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await followUp({ messageId, text: trimmed });
      if (!result.ok) {
        setError(
          `Slow down. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s`,
        );
      } else {
        setText("");
      }
    } catch (e) {
      setError(userMessage(e, "Could not send. Try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="thread__form" id="follow-up" onSubmit={onSubmit}>
      <textarea
        ref={inputRef}
        className="composer__input composer__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void onSubmit(e);
          }
        }}
        placeholder={
          paused
            ? "Your account is paused"
            : `Ask a follow up, up to ${MAX_OPEN_WORDS} words`
        }
        aria-label="Follow up"
        rows={2}
        disabled={busy || paused}
      />
      <div className="thread__formRow">
        {error ? (
          <span className="label label--ink" role="alert">
            {error}
          </span>
        ) : (
          <span className="label">{note}</span>
        )}
        <button
          className="pill pill--accent"
          type="submit"
          disabled={busy || paused || !text.trim()}
        >
          Send
        </button>
      </div>
    </form>
  );
}

function ThreadMessage({ message }: { message: UIMessage }) {
  const visible = useSmoothText(message.text, {
    streaming: message.status === "streaming",
  });
  const mine = message.role === "user";
  return (
    <li className={"thread__msg" + (mine ? " thread__msg--me" : "")}>
      <span className="label">
        {mine ? "You" : "Model"}
        {message.status === "streaming" && (
          <>
            {" "}
            <span className="dot dot--pulse" />
          </>
        )}
        {message.status === "failed" && " · failed"}
      </span>
      <p className="body-sm">{visible || (mine ? "" : "\u2026")}</p>
    </li>
  );
}
