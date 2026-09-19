import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import { getSessionId } from "./lib/session";
import { ThemeToggle } from "./components/ThemeToggle";
import { Counter } from "./components/Counter";
import { CostTracker } from "./components/CostTracker";
import { Composer } from "./components/Composer";
import { Yours } from "./components/Yours";
import { Wall } from "./components/Wall";
import { HowItWorks } from "./components/HowItWorks";
import { Admin } from "./components/Admin";
import { Privacy, Terms } from "./components/Legal";
import { ScrollArrows } from "./components/ScrollArrows";
import { useIsAdmin } from "./hooks/useIsAdmin";

// Client side routes. Static hosting serves index.html for every path, so
// the pathname decides what renders. /admin is never linked from the public
// page; /terms and /privacy are linked from the colophon.
const route = window.location.pathname.replace(/\/+$/, "");

export default function App() {
  if (route === "/admin") return <Admin />;
  if (route === "/terms") return <Terms />;
  if (route === "/privacy") return <Privacy />;
  return <Home />;
}

function Home() {
  const sessionId = useMemo(() => getSessionId(), []);
  const counts = useQuery(api.stats.counts);
  const gate = useQuery(api.stats.gate);
  const jev = gate?.jev ?? false;
  const isAdmin = useIsAdmin();

  return (
    <main id="top">
      {/* Hero. No header, no footer. A mono row carries the credits and the
          theme toggle. The display headline sits centered, then three
          columns like a poster: the copy, the ask, the count. Crop marks
          frame the first screen. */}
      <section className="hero">
        <span className="mark mark--tl" aria-hidden="true" />
        <span className="mark mark--tr" aria-hidden="true" />
        <span className="mark mark--bl" aria-hidden="true" />
        <span className="mark mark--br" aria-hidden="true" />

        <div className="wrap hero__top label">
          <span className="hero__left">
            {/* Anchor nav to the two sections below the fold. */}
            <nav className="hero__nav" aria-label="Sections">
              <a href="#wall">The wall</a>
              <a href="#how">How it works</a>
              {/* Only rendered for the signed in admin. Visitors never see it. */}
              {isAdmin && <a href="/admin">Admin</a>}
            </nav>
            <span>
              Powered by{" "}
              <a href="https://convex.dev" target="_blank" rel="noreferrer">
                <b>Convex</b> <ArrowUpRight size={11} aria-hidden="true" />
              </a>{" "}
              and{" "}
              <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
                <b>TypeSafe</b> <ArrowUpRight size={11} aria-hidden="true" />
              </a>
            </span>
          </span>
          <ThemeToggle />
        </div>

        <div className="wrap hero__body">
          <h1 className="display">Ask Jev anything.</h1>

          <div className="hero__grid">
            <div className="col col--copy">
              <p className="label">Not a chatbot</p>
              <p className="body">
                Three to fifteen words. Jev does not write replies. It judges
                each ask in about 100 milliseconds: yes, no, or it depends, plus
                mood, topic, and whether it fits the wall. Up to a million
                times.
              </p>
              <p className="label">
                {gate === undefined
                  ? "Jev connecting"
                  : jev
                    ? "Jev online"
                    : "Jev offline · add TYPESAFE_API_KEY"}
              </p>
            </div>

            <div className="col col--ask">
              <Composer sessionId={sessionId} />
              <Yours sessionId={sessionId} />
            </div>

            <div className="col col--count panel" id="count">
              {counts ? (
                <Counter
                  live={counts.live}
                  blocked={counts.blocked}
                  goal={counts.goal}
                />
              ) : (
                <>
                  <p className="label">Jev asked, so far</p>
                  <p className="counter" aria-hidden="true">
                    <span className="counter__dim">0,000,000</span>
                  </p>
                </>
              )}
              <CostTracker />
            </div>
          </div>
        </div>
      </section>

      <Wall />
      <HowItWorks jev={jev} />

      {/* Colophon. Three centered mono lines at the end of the page: the
          builder credit, the disclaimer, then terms, privacy, and source. */}
      <div className="wrap colophon label">
        <a href="https://waynesutton.ai" target="_blank" rel="noreferrer">
          Demo app built by waynesutton.ai{" "}
          <ArrowUpRight size={11} aria-hidden="true" />
        </a>
        <span>Demo app not associated with TypeSafe AI</span>
        <nav className="colophon__links" aria-label="Legal">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a
            href="https://github.com/waynesutton/ask-jev-ai"
            target="_blank"
            rel="noreferrer"
          >
            Source <ArrowUpRight size={11} aria-hidden="true" />
          </a>
        </nav>
      </div>

      <ScrollArrows />
    </main>
  );
}
