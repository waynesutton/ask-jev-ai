import type { ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { MAX_OPEN_WORDS, MAX_WORDS, MIN_WORDS } from "../../convex/lib/words";
import {
  ANON_POSTS_PER_MINUTE,
  USER_POSTS_PER_MINUTE,
} from "../../convex/lib/limits";
import { INPUT_USD_PER_MTOK } from "../../convex/lib/pricing";
import { ROUTES, ROUTE_KEYS } from "../../convex/questions";
import { Link } from "./Link";

type Props = {
  jev: boolean;
  provider: "typesafe" | "gateway" | null;
  // "home" is the section under the wall. "about" opens /about: the heading
  // is the page's h1, the pill scrolls to the docs band under it, and the
  // rule above the section goes since the top row already opens the page.
  variant?: "home" | "about";
};

// Every outbound link the section uses, in one place.
const DOCS = {
  gateway: "https://docs.convex.dev/ai-gateway/overview",
  decisions: "https://docs.convex.dev/ai-gateway/setup#decisions-with-jev",
  typesafe: "https://docs.typesafe.ai/introduction",
  realtime: "https://docs.convex.dev/realtime",
  agent: "https://www.convex.dev/components/agent",
  auth: "https://auth-v2.previews.convex.dev/getting-started",
  rateLimiter: "https://www.convex.dev/components/rate-limiter",
  counter: "https://www.convex.dev/components/sharded-counter",
  hosting: "https://www.convex.dev/components/static-hosting",
  convex: "https://convex.dev",
} as const;

// The lane the example ask lands in. `explain` is the one most open asks
// take, so it is the honest pick for the stage.
const PICKED = "explain" as const;

// Head on the left, three step cards on the right, then two ruled rows:
// the stack as link chips, and the numbers the server enforces.
export function HowItWorks({ jev, provider, variant = "home" }: Props) {
  const about = variant === "about";
  // Heading levels follow the page: h2 and h3 under the home h1, h1 and h2
  // on /about where this section is the top of the page.
  const Heading = about ? "h1" : "h2";
  const titleTag = about ? "h2" : "h3";
  const routeCount = ROUTE_KEYS.length;
  // "google/gemini..." → "google". Counted so the copy tracks the table.
  const providerCount = new Set(
    Object.values(ROUTES).map((r) => r.model.split("/")[0]),
  ).size;
  // Where the judge runs. TypeSafe direct only when pinned by env.
  const direct = jev && provider === "typesafe";

  return (
    <section className={"section how" + (about ? " how--page" : "")} id="how">
      <div className="wrap">
        <div className="how__grid">
          <div className="how__head">
            <p className="label">A demo of Jev and Convex</p>
            <Heading className="heading-lg">How it works.</Heading>
            <p className="subheading muted">
              Type a question. Jev reads it and answers yes, no, or it depends
              in about 100 milliseconds. Sign in and Jev also picks a model; the
              answer streams through the Convex AI Gateway into every open tab.
            </p>
            <div className="how__cta">
              {/* On /about the docs sit under this section, so the pill is a
                  plain anchor and the browser scrolls. On home it routes. */}
              {about ? (
                <a className="pill" href="#docs">
                  Read the full docs
                </a>
              ) : (
                <Link className="pill" href="/about#docs">
                  Read the docs
                </Link>
              )}
              <a
                className="ghost"
                href={DOCS.gateway}
                target="_blank"
                rel="noreferrer"
              >
                AI Gateway docs <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>

          <ol className="how__steps">
            <Step
              n="01"
              titleTag={titleTag}
              title="Ask. Jev judges."
              href={direct ? DOCS.typesafe : DOCS.decisions}
              linkText={direct ? "Jev at TypeSafe" : "Decisions with Jev"}
              body={
                <>
                  Visitors type {MIN_WORDS} to {MAX_WORDS} plain words, accounts
                  up to {MAX_OPEN_WORDS}. Jev is not a chatbot and never writes
                  a reply. It answers seven typed questions about the ask: yes,
                  no, or it depends, how sure, the mood, the topic, and whether
                  it fits the wall.
                </>
              }
            >
              <StageAsk />
            </Step>
            <Step
              n="02"
              titleTag={titleTag}
              title="Jev picks the lane."
              href={DOCS.gateway}
              linkText="Models on the gateway"
              body={
                <>
                  Signed in, one more question sorts the ask into one of{" "}
                  {routeCount} lanes: a quick fact, an explanation, some
                  reasoning, or something recent. Each lane names a model on the
                  Convex AI Gateway. Convex holds the provider keys; this app
                  holds none.
                </>
              }
            >
              <StageLanes />
            </Step>
            <Step
              n="03"
              titleTag={titleTag}
              title="The answer streams to every tab."
              href={DOCS.realtime}
              linkText="Realtime in Convex"
              body={
                <>
                  A Convex action takes a short lived token scoped to this
                  deployment, calls the model Jev named, and writes the answer
                  into the database as it streams. Every open tab is subscribed,
                  so the wall moves at once. Keep it private or put it on the
                  wall.
                </>
              }
            >
              <StageStream />
            </Step>
          </ol>
        </div>

        {/* The stack, as link chips. One row, wraps on narrow screens. */}
        <div className="how__row">
          <p className="label how__row-label">Built on</p>
          <ul className="how__links">
            <Out href={DOCS.gateway}>Convex AI Gateway</Out>
            <Out href={direct ? DOCS.typesafe : DOCS.decisions}>
              {direct ? "Jev via TypeSafe" : "Decisions with Jev"}
            </Out>
            <Out href={DOCS.agent}>Agent component</Out>
            <Out href={DOCS.auth}>Convex Auth</Out>
            <Out href={DOCS.rateLimiter}>Rate limiter</Out>
            <Out href={DOCS.counter}>Sharded counter</Out>
            <Out href={DOCS.hosting}>Static hosting</Out>
            <Out href={DOCS.convex}>Convex</Out>
          </ul>
        </div>

        {/* The numbers, each from the constant the server enforces. */}
        <dl className="how__row how__numbers">
          <Num
            label="Length"
            value={`${MIN_WORDS} to ${MAX_WORDS} words · ${MAX_OPEN_WORDS} signed in`}
          />
          <Num
            label="Rate"
            value={`${ANON_POSTS_PER_MINUTE} asks a minute · ${USER_POSTS_PER_MINUTE} signed in`}
          />
          <Num
            label="Answers"
            value={`${routeCount} models · ${providerCount} providers · Jev picks`}
          />
          <Num
            label="Jev price"
            value={`$${INPUT_USD_PER_MTOK} per million tokens in · out free`}
          />
        </dl>
      </div>
    </section>
  );
}

type StepProps = {
  n: string;
  title: string;
  titleTag: "h2" | "h3";
  body: ReactNode;
  href: string;
  linkText: string;
  children: ReactNode;
};

// One card: the stage on top, then number, title, copy, and one link out.
function Step({
  n,
  title,
  titleTag: Title,
  body,
  href,
  linkText,
  children,
}: StepProps) {
  return (
    <li className="card how__step">
      <div className="how__stage" aria-hidden="true">
        {children}
      </div>
      <div className="how__copy">
        <p className="label">{n}</p>
        <Title className="body how__title">{title}</Title>
        <p className="body-sm muted">{body}</p>
        <a
          className="label how__out"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {linkText} <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

// Stage 01. A wall card in miniature: the ask, the verdict chip with its
// percent, the quiet lean, the topic, latency, then the two sureness bars.
function StageAsk() {
  return (
    <div className="how__mini">
      <p className="how__mini-ask">is coffee good for you</p>
      <div className="how__mini-meta">
        <span className="tag">
          Jev: depends<span className="tag__pct">· 71%</span>
        </span>
        <span className="tag tag--quiet">leaning yes</span>
        <span className="chip">food</span>
        <span className="label">212ms</span>
      </div>
      <dl className="answers__list caption how__mini-answers">
        <Bar q="Jev says" a="it depends" p={0.71} />
        <Bar q="Fits the wall?" a="yes" p={0.98} />
      </dl>
    </div>
  );
}

// One "How sure was Jev" row, same classes as the real fold.
function Bar({ q, a, p }: { q: string; a: string; p: number }) {
  return (
    <div className="answers__row">
      <dt className="answers__q muted">{q}</dt>
      <dd className="answers__a">{a}</dd>
      <dd className="answers__bar">
        <span className="answers__track">
          <span className="answers__fill" style={{ width: `${p * 100}%` }} />
        </span>
        <span className="answers__pct">{Math.round(p * 100)}%</span>
      </dd>
    </div>
  );
}

// Stage 02. The four lanes from ROUTES, one lit. Names and model labels
// are the real ones, so a lane change shows up here without a copy edit.
function StageLanes() {
  return (
    <ul className="how__lanes">
      {ROUTE_KEYS.map((key) => {
        const on = key === PICKED;
        return (
          <li key={key} className={"how__lane" + (on ? " how__lane--on" : "")}>
            <span className="how__lane-dot" />
            <span className="how__lane-name">{key}</span>
            {on && <span className="tag how__lane-tag">picked</span>}
            <span className="how__lane-model label">{ROUTES[key].label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Stage 03. The model line with its live dot, a streamed sentence with the
// caret still going, and three tabs that light up one after another.
function StageStream() {
  const route = ROUTES[PICKED];
  return (
    <div className="how__mini how__mini--stream">
      <p className="label how__model">
        <span className="dot dot--pulse" />
        <span className="how__model-name">{route.label}</span>
        <span>· {route.why}</span>
      </p>
      <p className="how__stream body-sm">
        For most adults, yes in moderation. A few cups a day is fine; past that,
        sleep and
        <span className="how__caret" />
      </p>
      <div className="how__tabs">
        <span className="how__tab" />
        <span className="how__tab" />
        <span className="how__tab" />
      </div>
    </div>
  );
}

// A mono chip that opens a doc in a new tab.
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a
        className="how__link label"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {children} <ArrowUpRight size={11} aria-hidden="true" />
      </a>
    </li>
  );
}

// One number in the ruled row.
function Num({ label, value }: { label: string; value: string }) {
  return (
    <div className="how__num">
      <dt className="label">{label}</dt>
      <dd className="body-sm">{value}</dd>
    </div>
  );
}
