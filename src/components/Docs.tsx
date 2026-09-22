import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import {
  MAX_OPEN_CHARS,
  MAX_OPEN_WORDS,
  MAX_WORDS,
  MIN_WORDS,
} from "../../convex/lib/words";
import {
  ANON_POSTS_PER_MINUTE,
  ANSWERS_PER_DAY,
  USER_POSTS_PER_MINUTE,
} from "../../convex/lib/limits";
import { INPUT_USD_PER_MTOK, MODEL_PRICES } from "../../convex/lib/pricing";
import { GOAL } from "../../convex/lib/counters";
import { JEV_GATEWAY_MODEL } from "../../convex/lib/typesafe";
import {
  BLOCK_THRESHOLD,
  MAX_JUDGE_ATTEMPTS,
  MOOD_LABELS,
  REPLIES,
  ROUTES,
  TOPICS,
} from "../../convex/questions";
import { formatCount } from "../lib/format";
import { CLOSE_CALL } from "./JevAnswers";
import { Link } from "./Link";
import { ThemeToggle } from "./ThemeToggle";

// /docs. The long version of How it works, for a person who wants every
// rule and every number. Every figure on this page is imported from the
// module that enforces it, so the docs cannot drift from the code. Nothing
// here describes moderation tooling; that is not part of using the app.

const UPDATED = "September 19, 2026";
const REPO = "https://github.com/waynesutton/ask-jev-ai";

type Section = { id: string; title: string; body: ReactNode };

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <ArrowUpRight size={11} aria-hidden="true" />
    </a>
  );
}

function Table({
  head,
  rows,
}: {
  head: Array<string>;
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="docs__tableWrap">
      <table className="docs__table body-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="label">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Docs() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Docs · Ask Jev";
    return () => {
      document.title = previous;
    };
  }, []);

  const routeCount = Object.keys(ROUTES).length;
  const providerCount = new Set(
    Object.values(ROUTES).map((r) => r.model.split("/")[0]),
  ).size;
  const perMillion = `$${INPUT_USD_PER_MTOK}`;

  const sections: Array<Section> = [
    {
      id: "what",
      title: "What this is",
      body: (
        <>
          <p className="body">
            Ask Jev is a public wall. Anyone types a short question and Jev,
            TypeSafe's judgment model, answers yes, no, or it depends in about
            100 milliseconds. Every judged ask lands on the wall in realtime
            with a running count toward {formatCount(GOAL)} and the exact cost
            of getting there.
          </p>
          <p className="body">
            Jev is not a chatbot. It does not write. It reads a sentence and
            returns typed answers with probabilities: a choice from a list, a
            score on a scale, a true or false. Code decides what to do with each
            answer. Signed in, one more of those typed answers picks which
            language model should write a short reply, and that reply streams in
            under your ask through the Convex AI Gateway.
          </p>
          <p className="body">
            This page is the long version of{" "}
            <Link href="/#how">How it works</Link>. Every number on it is read
            from the same constants the server enforces.
          </p>
        </>
      ),
    },
    {
      id: "ask",
      title: "What happens when you ask",
      body: (
        <>
          <ol className="body docs__steps">
            <li>
              You type an ask. The browser checks it before the Ask button turns
              on, so most mistakes never leave your tab.
            </li>
            <li>
              A Convex mutation runs the same checks on the server, applies the
              rate limits, stores the ask as <code>judging</code>, and schedules
              the judge. Your tab sees the row appear at once under Yours.
            </li>
            <li>
              A Convex action sends <code>{"{ message }"}</code> to Jev with
              every question below in one request. Jev evaluates each one in
              parallel against the same text. Adding a question barely changes
              the response time.
            </li>
            <li>
              A mutation records the answers, the token count, and the latency.
              Any safety probability at or above <code>{BLOCK_THRESHOLD}</code>{" "}
              marks the ask <code>held</code>. Otherwise it goes{" "}
              <code>live</code> and the wall, the counter, and the cost box move
              in every open tab.
            </li>
            <li>
              Signed in and live, an action opens a thread and streams a short
              answer from the model Jev picked. The card shows the model's name,
              the one line reason, latency, and cost as it arrives.
            </li>
          </ol>
          <p className="body">
            If Jev cannot be reached the judge retries up to{" "}
            {MAX_JUDGE_ATTEMPTS} times, then the row reads <code>failed</code>{" "}
            with a retry button for whoever posted it.
          </p>
        </>
      ),
    },
    {
      id: "questions",
      title: "The questions Jev answers",
      body: (
        <>
          <p className="body">
            Seven typed questions ride in one request. Six run for every ask.
            The seventh, the route, only matters when someone is signed in.
          </p>
          <Table
            head={["Question", "Type", "What it decides"]}
            rows={[
              [
                "Reply",
                "Choice",
                <>
                  How Jev answers the ask itself. One of{" "}
                  {Object.keys(REPLIES)
                    .map((k) => (k === "depends" ? "it depends" : k))
                    .join(", ")}
                  . This is the chip on the card.
                </>,
              ],
              [
                "Is it unkind",
                "Noul",
                "Whether the ask puts someone down, sneers, or threatens, with every single word ordinary.",
              ],
              [
                "Is it adult",
                "Noul",
                "Sexual, violent, or otherwise adult content, including innuendo and coded slang.",
              ],
              [
                "Targets a person",
                "Noul",
                "Whether it attacks or demeans a specific real person or a group for who they are.",
              ],
              [
                "Mood",
                "Score",
                <>
                  Emotional tone on a five step scale:{" "}
                  {MOOD_LABELS.map((m) => m.toLowerCase()).join(", ")}. This is
                  the dot on the card.
                </>,
              ],
              [
                "Topic",
                "Choice",
                <>
                  What the ask is mostly about: {Object.keys(TOPICS).join(", ")}
                  .
                </>,
              ],
              [
                "Route",
                "Choice",
                <>
                  If a language model had to write a short answer, which of{" "}
                  {routeCount} kinds fits best. See how Jev picks the model.
                </>,
              ],
            ]}
          />
          <p className="body">
            A Noul is a probability that a statement is true. A Choice returns
            the pick plus a probability for every option. A Score returns a
            position on the scale plus how sure Jev is. TypeSafe documents the
            three primitives at{" "}
            <Out href="https://docs.typesafe.ai/introduction">
              docs.typesafe.ai
            </Out>
            .
          </p>
          <p className="body">
            The verdict chip on every card carries that probability, so{" "}
            <code>Jev: yes · 94%</code> is one read. Under{" "}
            {Math.round(CLOSE_CALL * 100)}% the chip adds a quiet{" "}
            <code>close call</code>. Under each card, <b>How sure was Jev</b>{" "}
            folds open to two rows: the verdict with its bar, and whether the
            ask fits the wall. When Jev says depends, or the verdict was a close
            call, a third row shows the runner up, the option that carried the
            second most probability. That comes from the same Choice answer, so
            it costs nothing extra. An ask that came near the hold line without
            crossing it gets a <code>close to the line</code> tag with the
            number. The browser remembers whether you left the fold open.
          </p>
          <p className="body">
            <b>Was Jev right?</b> Two thumbs under every yes, no, or depends.
            One vote per person per ask, signed in or not, and you can flip or
            take it back. Votes measure Jev and never change a verdict. The
            count panel shows the running agreement rate once the first vote
            lands. Each card also has a <b>Link</b> button that copies its
            permanent address.
          </p>
        </>
      ),
    },
    {
      id: "visitors",
      title: "Rules for visitors",
      body: (
        <>
          <p className="body">
            Without an account the wall is a small, safe surface. Four rules
            keep it that way.
          </p>
          <ul className="body legal__list">
            <li>
              <b>
                {MIN_WORDS} to {MAX_WORDS} words.
              </b>{" "}
              Short enough that Jev can judge it as a single thought.
            </li>
            <li>
              <b>Plain words only.</b> Every word has to appear on a human
              verified allowlist of common English words. The browser shows each
              word as a chip and marks the ones that are not on the list.
            </li>
            <li>
              <b>No profanity.</b> A blocklist masks a blocked word as{" "}
              <code>***</code> and disables Ask.
            </li>
            <li>
              <b>Some topics are held.</b> A short server side list of terms the
              wall does not host. An ask that matches is stored as held without
              calling Jev. The list is never in the browser.
            </li>
          </ul>
          <p className="body">
            Jev then decides. If any of the three safety questions comes back at
            or above {BLOCK_THRESHOLD}, the ask is held and only you see it,
            with the reason, under Yours. Visitor asks are always public and
            always on the wall.
          </p>
          <p className="body">
            When Jev reads a visitor ask as an open question, one that wants
            more than yes or no, the card under Yours says so and offers sign
            in. No extra call is made; the verdict was already in the same
            response.
          </p>
        </>
      ),
    },
    {
      id: "accounts",
      title: "Sign in and ask anything",
      body: (
        <>
          <p className="body">
            Sign in with Google, GitHub, or email and password through Convex
            Auth. A verified provider email links to your existing account and
            keeps your asks and handle. Each account gets a sequential user
            number, a handle made from the email, and a profile. Signed in, the
            word rules change.
          </p>
          <ul className="body legal__list">
            <li>
              <b>Up to {MAX_OPEN_WORDS} words</b>, or {MAX_OPEN_CHARS}{" "}
              characters, any question.
            </li>
            <li>
              <b>No allowlist.</b> Any word goes to Jev.
            </li>
            <li>
              <b>Wall or private.</b> A toggle on the composer. Wall asks show
              up on the wall under your handle. Private asks never appear on the
              wall, in search, or on your profile. Either way you keep the ask,
              its verdict, and its answer in your history.
            </li>
            <li>
              <b>A held word does not stop you.</b> If an ask carries a
              blocklist word or a held term, it is still judged and still
              answered. On the wall it shows blurred to everyone but you, with a{" "}
              <code>held words</code> tag. On your own pages you read it in
              full. The composer tells you before you post.
            </li>
          </ul>
          <p className="body">
            Jev's own three safety questions still apply to every ask. A held
            verdict is held for everyone.
          </p>
        </>
      ),
    },
    {
      id: "routing",
      title: "How Jev picks the model",
      body: (
        <>
          <p className="body">
            Jev never writes the answer. It sorts the ask into one of{" "}
            {routeCount} lanes as a Choice question, in the same request as
            everything else, so routing adds no latency. Each lane names one
            model on the Convex AI Gateway. The card shows the model and the
            lane's one line reason.
          </p>
          <Table
            head={["Lane", "Model", "Jev picks it when the ask"]}
            rows={Object.entries(ROUTES).map(([key, r]) => [
              <code key={key}>{key}</code>,
              r.label,
              r.criteria.replace(/\. Example:.*$/, "").toLowerCase(),
            ])}
          />
          <p className="body">
            The whole policy lives in one file, <code>convex/questions.ts</code>
            . Change a lane's model or its criteria there and every new ask
            follows.
          </p>
          <p className="body">
            <b>Why the Convex AI Gateway.</b> {routeCount} models from{" "}
            {providerCount} providers would normally mean {providerCount} API
            keys, {providerCount} SDKs, and {providerCount} billing pages. Here
            there is one endpoint and no provider key anywhere in the repo. The
            Convex action that writes the answer asks for a short lived token
            scoped to this deployment, names the model Jev picked, and streams
            the reply. Convex holds the credentials and the bill. The gateway
            speaks the OpenAI chat and responses shapes and the Anthropic
            messages shape, so the same code path serves every lane. That is
            what makes "Jev picks the model" a one line change instead of a new
            integration.{" "}
            <Out href="https://docs.convex.dev/ai-gateway/overview">
              AI Gateway overview
            </Out>
          </p>
          <p className="body">
            <b>Jev goes through the same door.</b> The gateway has a Decisions
            endpoint for Jev, listed as <code>{JEV_GATEWAY_MODEL}</code>. The
            judge action mints the same short lived token, posts the seven
            questions there, and gets the same typed answers back. No TypeSafe
            key is needed. If the gateway fails and a key is present, the call
            falls back to TypeSafe directly and the row records which door
            answered. <code>JEV_PROVIDER=typesafe</code> pins the direct path.{" "}
            <Out href="https://docs.convex.dev/ai-gateway/setup#decisions-with-jev">
              Decisions with Jev
            </Out>
          </p>
        </>
      ),
    },
    {
      id: "answers",
      title: "Answers and follow ups",
      body: (
        <>
          <p className="body">
            The answer is one to three plain sentences, capped at 240 output
            tokens, streamed. The wall card mirrors the text as it arrives. The
            ask's own page at <code>/a/:id</code> streams for real and holds a
            thread: ask a follow up and the same model replies with the last few
            turns as context. Follow ups count as asks against your rate limit.
          </p>
          <p className="body">
            Every ask on the wall, on a profile, or in your history carries an{" "}
            <b>Ask a follow up</b> link. Signed out, it reads{" "}
            <b>Sign in to ask follow up questions</b> and brings you back to the
            ask once you are in. Follow ups on someone else's ask, or on a
            visitor's yes or no ask, open a thread only you and the admin can
            read. The asker never sees it. The model Jev picked for that ask
            answers, with the ask and Jev's verdict as context. Those threads
            list under Follow ups on <Link href="/me">/me</Link>.
          </p>
          <p className="body">
            Who can read a thread follows one rule:{" "}
            <b>a thread follows its ask</b>. Your follow ups on your own wall
            ask are public, like the ask; once you have sent one, the wall card
            grows a <b>Read the thread</b> link. Your follow ups on a private
            ask are private. Make a wall ask private on{" "}
            <Link href="/me">/me</Link> and its thread goes with it. Everyone
            else's follow ups on your ask are private to them. There is no
            public option for those: follow ups skip Jev's judging and the
            wall's word gate, so they stay off the wall. The composer and the
            tooltip on every <b>Ask a follow up</b> link say which case applies
            before you type.
          </p>
          <p className="body">
            Answers cost real money, so every account carries an answer budget
            of twelve a minute and {ANSWERS_PER_DAY} a day. Asks past the budget
            still get Jev's verdict; the answer reads as skipped.
          </p>
          <p className="body">
            Held asks, visitor asks, and asks Jev could not judge do not get an
            answer.
          </p>
        </>
      ),
    },
    {
      id: "me",
      title: "Your account page",
      body: (
        <>
          <p className="body">
            <Link href="/me">/me</Link> is your history and your settings.
          </p>
          <ul className="body legal__list">
            <li>
              <b>History</b> with All, Private, On the wall, and Archived
              filters. Every ask, every status, newest first, with the answer
              and a link to its thread.
            </li>
            <li>
              <b>Per ask</b>: Show on wall or Make private, Archive or
              Unarchive, Delete. Deleting removes the ask, its thread, and any
              follow up threads other people opened on it. The big counter does
              not go down, since Jev did answer it.
            </li>
            <li>
              <b>Follow ups</b>: the threads you opened on other people's asks,
              newest activity first, with the model that answered and a Continue
              link.
            </li>
            <li>
              <b>Profile</b>: handle, display name, bio, GitHub, LinkedIn, X, a
              photo up to 2 MB, and the public profile switch.
            </li>
            <li>
              <b>Account</b>: change password, export everything as JSON, or
              delete the account with a typed confirmation. Deletion removes
              private asks and their threads, detaches public asks from you so
              the wall count stays honest, and frees the email.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "profile",
      title: "Your profile page",
      body: (
        <>
          <p className="body">
            Every account has a page at <code>askjev.ai/your_handle</code>. It
            is private by default: only you can open it. Flip the pill next to
            your handle, or the switch on /me, and anyone with the link can see
            it. Flip it back any time.
          </p>
          <p className="body">The page shows your usage, not your words.</p>
          <ul className="body legal__list">
            <li>
              Asks, answers, longest streak, and current streak. A streak is
              consecutive days with at least one ask, in UTC.
            </li>
            <li>
              A year of activity as dots, one per day, shaded by how many asks
              that day had relative to your busiest day.
            </li>
            <li>
              What Jev said: the share of your asks that came back yes, no, it
              depends, open, or a statement, plus Jev's average latency on your
              asks.
            </li>
            <li>Which models answered, ranked by count.</li>
            <li>
              Tokens over the last thirty days, Jev's and the models', with what
              the answers cost.
            </li>
            <li>Asks over the last thirty days and your three top topics.</li>
            <li>Then your asks that are on the wall, with their answers.</li>
          </ul>
          <p className="body">
            Private asks are counted in your totals but the wall versus private
            split is shown only to you. Private ask text never appears on a
            profile. The page carries your join date, user number, and the links
            you added.
          </p>
        </>
      ),
    },
    {
      id: "cost",
      title: "The counter and the cost box",
      body: (
        <>
          <p className="body">
            The big number is asks Jev has judged and let through, toward{" "}
            {formatCount(GOAL)}. Held asks are counted separately under it. Both
            are sharded counters in Convex, so a burst of posts does not
            serialize on one document.
          </p>
          <p className="body">
            Jev's list price is {perMillion} per million input tokens, and
            output is free: there is no text to decode. Each ask stores its own
            token count, so the spend, the per message cost, and the projection
            to {formatCount(GOAL)} are arithmetic, not estimates. The clock
            started when the first ask was judged and the pace uses everything
            since.
          </p>
          <p className="body">
            Model answers are priced per model from a table of provider list
            prices, in whole micro dollars per call so the sums stay exact. Once
            the first answer lands the cost box gains Model answers, Answer
            spend, and Per answer rows.
          </p>
          <p className="body">
            The panel shows three rows by default: Jev spend, To one million,
            and At this pace. More numbers opens the rest: per message, tokens
            in, the model answer rows, and the stopwatch. Your choice is
            remembered in this browser.
          </p>
          <Table
            head={["Model", "In, per million", "Out, per million"]}
            rows={Object.entries(MODEL_PRICES).map(([id, p]) => [
              <code key={id}>{id}</code>,
              `$${p.input.toFixed(2)}`,
              `$${p.output.toFixed(2)}`,
            ])}
          />
        </>
      ),
    },
    {
      id: "limits",
      title: "Rate limits",
      body: (
        <>
          <p className="body">
            Two layers on every post: one per IP address so a script minting
            fresh sessions buys nothing, one per browser session or per account.
          </p>
          <Table
            head={["Who", "Posts", "Burst", "Answers"]}
            rows={[
              ["Visitor", `${ANON_POSTS_PER_MINUTE} a minute`, "3", "none"],
              [
                "Signed in",
                `${USER_POSTS_PER_MINUTE} a minute`,
                "10",
                `12 a minute, ${ANSWERS_PER_DAY} a day`,
              ],
            ]}
          />
          <p className="body">
            When a limit is hit the composer says how long to wait and counts
            down. Nothing is stored for a post that was turned away.
          </p>
        </>
      ),
    },
    {
      id: "data",
      title: "What is stored and where it goes",
      body: (
        <>
          <p className="body">
            A visitor ask stores the words, an anonymous session id from the
            browser, Jev's answers, the token count, and the latency. The IP
            address is read for the one minute rate limit window and is not
            stored on the ask. The ask text alone goes to Jev, through the
            Convex AI Gateway by default, or straight to TypeSafe when the
            gateway is down or pinned off.
          </p>
          <p className="body">
            A signed in ask stores, on top of that, who posted it and whether it
            is on the wall or private. The ask text, and any follow ups, go to
            the model Jev picked through the Convex AI Gateway. No ids or emails
            travel with it. A follow up thread on someone else's ask stores who
            opened it, which ask, the model, and the turns. The asker never sees
            it, and it never shows on the wall or a profile.
          </p>
          <p className="body">
            Profile usage is a per day tally of counts: asks, verdicts, topics,
            models, tokens. It holds no text. The full policy is in{" "}
            <Link href="/privacy">Privacy</Link> and the rules of use in{" "}
            <Link href="/terms">Terms</Link>.
          </p>
        </>
      ),
    },
    {
      id: "stack",
      title: "Built with",
      body: (
        <>
          <Table
            head={["Layer", "What"]}
            rows={[
              [
                "Judge",
                <>
                  Jev, TypeSafe's judgment model, through the Convex AI Gateway
                  Decisions endpoint, TypeSafe direct as the fallback.{" "}
                  <Out href="https://docs.typesafe.ai">docs.typesafe.ai</Out>
                </>,
              ],
              [
                "Answers",
                <>
                  Convex AI Gateway, {routeCount} models, Jev picks.{" "}
                  <Out href="https://docs.convex.dev/ai-gateway/overview">
                    AI Gateway
                  </Out>
                </>,
              ],
              [
                "Threads",
                <>
                  Convex Agent for threads, streaming, and usage.{" "}
                  <Out href="https://www.convex.dev/components/agent">
                    Agent
                  </Out>
                </>,
              ],
              [
                "Backend",
                <>
                  Convex: database, functions, scheduler, file storage, search.{" "}
                  <Out href="https://convex.dev">convex.dev</Out>
                </>,
              ],
              [
                "Counters and limits",
                <>
                  Sharded Counter and Rate Limiter components.{" "}
                  <Out href="https://www.convex.dev/components">Components</Out>
                </>,
              ],
              [
                "Auth",
                <>
                  Convex Auth v2, email and password.{" "}
                  <Out href="https://auth-v2.previews.convex.dev/getting-started">
                    Convex Auth
                  </Out>
                </>,
              ],
              [
                "Frontend",
                "React 19, Vite, TypeScript, plain CSS with two skins on one set of tokens.",
              ],
              [
                "Hosting",
                <>
                  Convex static hosting, Cloudflare DNS.{" "}
                  <Out href="https://www.convex.dev/components/static-hosting">
                    Static Hosting
                  </Out>
                </>,
              ],
            ]}
          />
          <p className="body">
            The code is public at <Out href={REPO}>GitHub</Out>. This is a demo
            app and is not associated with TypeSafe AI.
          </p>
        </>
      ),
    },
  ];

  return (
    <main className="legal docs">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>

      <div className="wrap docs__layout">
        <nav className="docs__toc label" aria-label="On this page">
          <p className="muted">On this page</p>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>

        <article className="legal__body docs__body">
          <header className="legal__head">
            <p className="label">Ask Jev</p>
            <h1 className="heading-lg">How it works, in full.</h1>
            <p className="label">Last updated {UPDATED}</p>
            <p className="subheading muted">
              What happens between the Ask button and the wall, every rule that
              applies, and every number the app runs on. Read top to bottom or
              jump to a section.
            </p>
          </header>

          {sections.map((s) => (
            <section className="legal__section" key={s.id} id={s.id}>
              <h2 className="heading-sm">{s.title}</h2>
              {s.body}
            </section>
          ))}

          <footer className="legal__foot label">
            <Link href="/">The wall</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Out href={REPO}>Source</Out>
          </footer>
        </article>
      </div>
    </main>
  );
}
