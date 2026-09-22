import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import { getSessionId } from "./lib/session";
import { navigate, useRoute } from "./lib/router";
import { useMe } from "./hooks/useMe";
import { ThemeToggle } from "./components/ThemeToggle";
import { Counter } from "./components/Counter";
import { CostTracker } from "./components/CostTracker";
import { Composer } from "./components/Composer";
import { Lanes } from "./components/Lanes";
import { Yours } from "./components/Yours";
import { Wall } from "./components/Wall";
import { HowItWorks } from "./components/HowItWorks";
import { Avatar } from "./components/Avatar";
import { Link } from "./components/Link";
import { ScrollArrows } from "./components/ScrollArrows";
import { Tooltip } from "./components/Tooltip";

// Every page but the wall loads on demand, so the first paint of the home
// page does not carry the admin, the thread view, or the legal text.
const Admin = lazy(() =>
  import("./components/Admin").then((m) => ({ default: m.Admin })),
);
const AskPage = lazy(() =>
  import("./components/AskPage").then((m) => ({ default: m.AskPage })),
);
const Me = lazy(() =>
  import("./components/Me").then((m) => ({ default: m.Me })),
);
const Profile = lazy(() =>
  import("./components/Profile").then((m) => ({ default: m.Profile })),
);
const SignIn = lazy(() =>
  import("./components/SignIn").then((m) => ({ default: m.SignIn })),
);
const Docs = lazy(() =>
  import("./components/Docs").then((m) => ({ default: m.Docs })),
);
const Terms = lazy(() =>
  import("./components/Legal").then((m) => ({ default: m.Terms })),
);
const Privacy = lazy(() =>
  import("./components/Legal").then((m) => ({ default: m.Privacy })),
);

// Client side routes. Static hosting serves index.html for every path, so
// the pathname decides what renders. /admin is only linked for the admin;
// /terms and /privacy are linked from the colophon.
export default function App() {
  const route = useRoute();
  if (route.name === "home") return <Home />;
  if (route.name === "notFound") return <NotFound />;
  return (
    <Suspense fallback={<PageLoading />}>
      {route.name === "admin" && <Admin />}
      {route.name === "docs" && <Docs />}
      {route.name === "terms" && <Terms />}
      {route.name === "privacy" && <Privacy />}
      {route.name === "signIn" && <SignIn mode="in" />}
      {route.name === "signUp" && <SignIn mode="up" />}
      {route.name === "me" && <Me />}
      {route.name === "profile" && <Profile handle={route.handle} />}
      {route.name === "ask" && <AskPage id={route.id} />}
    </Suspense>
  );
}

function PageLoading() {
  return (
    <main className="admin">
      <div className="wrap hero__top label">
        <span className="admin__back">Loading</span>
      </div>
    </main>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = "Not found · Ask Jev";
  }, []);
  return (
    <main className="admin">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">
        <div className="card empty">
          <p className="subheading">Nothing at this address.</p>
        </div>
      </section>
    </main>
  );
}

function Home() {
  const sessionId = useMemo(() => getSessionId(), []);
  const counts = useQuery(api.stats.counts);
  const gate = useQuery(api.stats.gate);
  const jev = gate?.jev ?? false;
  const me = useMe();

  useEffect(() => {
    document.title = "Ask Jev anything, for real";
  }, []);

  return (
    <main id="top">
      {/* Hero. No header, no footer. A mono row carries the credits, the
          account, and the theme toggle. The display headline sits centered,
          then three columns like a poster: the copy, the ask, the count.
          Crop marks frame the first screen. */}
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
              <Link href="/docs">Docs</Link>
              {/* Only rendered for the signed in admin. Visitors never see it. */}
              {me?.admin && <Link href="/admin">Admin</Link>}
            </nav>
            <span className="hero__credit">
              Powered by{" "}
              <a href="https://convex.dev" target="_blank" rel="noreferrer">
                <b>Convex</b> <ArrowUpRight size={11} aria-hidden="true" />
              </a>
              ,{" "}
              <a
                href="https://docs.convex.dev/ai-gateway/overview"
                target="_blank"
                rel="noreferrer"
              >
                <b>AI Gateway</b> <ArrowUpRight size={11} aria-hidden="true" />
              </a>
              , and{" "}
              <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
                <b>TypeSafe</b> <ArrowUpRight size={11} aria-hidden="true" />
              </a>
            </span>
          </span>
          <span className="hero__right">
            <AccountMenu />
            <ThemeToggle />
          </span>
        </div>

        {me?.status === "paused" && (
          <div className="wrap">
            <div className="card notice" role="status">
              <p className="label">Account paused</p>
              <p className="body-sm">
                An admin paused new asks on this account. Your history is intact
                on <Link href="/me">your account page</Link>.
              </p>
            </div>
          </div>
        )}

        <div className="wrap hero__body">
          {/* The comma is the joke: the headline promises, the small line
              under it on the right delivers. One h1, so the title reads
              "Ask Jev anything, for real" to a screen reader. */}
          <h1 className="display">
            Ask Jev anything,
            {/* Visitors see the condition and a way in. Accounts see the
                plain promise. Same face and size either way. */}
            {me === null ? (
              <Link className="display__tag display__tag--link" href="/sign-up">
                for real after login
              </Link>
            ) : (
              <span className="display__tag">for real</span>
            )}
          </h1>

          <div className="hero__grid">
            {/* Left: the two ways to ask, as a short dotted list. Right of
                it the box, then the count panel. Visitors read the lanes,
                pick one, and the box is right there. */}
            <div className="col col--copy">
              <Lanes
                signedIn={me !== null && me !== undefined}
                status={
                  gate === undefined
                    ? "Jev connecting"
                    : jev
                      ? `Jev online · ${gate.provider === "gateway" ? "Convex AI Gateway" : "TypeSafe"}`
                      : "Jev offline · add TYPESAFE_API_KEY or unset JEV_PROVIDER"
                }
              />
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
      <HowItWorks jev={jev} provider={gate?.provider ?? null} />

      {/* Colophon. Three centered mono lines at the end of the page: the
          builder credit, the disclaimer, then terms, privacy, and source. */}
      <div className="wrap colophon label">
        <a href="https://waynesutton.ai" target="_blank" rel="noreferrer">
          Demo app built by waynesutton.ai{" "}
          <ArrowUpRight size={11} aria-hidden="true" />
        </a>
        <span>Demo app not associated with TypeSafe AI</span>
        <nav className="colophon__links" aria-label="Legal">
          <Link href="/docs">Docs</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a
            href="https://github.com/waynesutton/ask-jev-ai"
            target="_blank"
            rel="noreferrer"
          >
            Source <ArrowUpRight size={11} aria-hidden="true" />
          </a>
          {/* Support goes to the repo's issue tracker. */}
          <a
            href="https://github.com/waynesutton/ask-jev-ai/issues"
            target="_blank"
            rel="noreferrer"
          >
            Support <ArrowUpRight size={11} aria-hidden="true" />
          </a>
        </nav>
      </div>

      <ScrollArrows />
    </main>
  );
}

// Top right: "Sign in" for visitors, the avatar with a small menu for
// accounts. Closes on outside click and escape.
function AccountMenu() {
  const me = useMe();
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (me === undefined) return <span className="account" />;
  if (me === null) {
    return (
      <span className="account__auth">
        <Tooltip tip="Google, GitHub, or email. Free. 20 asks a minute, model answers, a profile">
          <Link className="ghost account__signup" href="/sign-up">Sign up</Link>
        </Tooltip>
        <Tooltip tip="Ask longer questions, get model answers, keep a history">
          <Link className="pill pill--small account__signin" href="/sign-in">Sign in</Link>
        </Tooltip>
      </span>
    );
  }

  return (
    <span className="account" ref={ref}>
      <button
        type="button"
        className="account__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen(!open)}
      >
        <Avatar photoUrl={me.profile.photoUrl} handle={me.profile.handle} />
      </button>
      {open && (
        <div className="account__menu card" role="menu">
          <p className="label account__who">
            @{me.profile.handle}
            {me.profile.userNumber !== null && ` · #${me.profile.userNumber}`}
          </p>
          <Link role="menuitem" href="/me" onClick={() => setOpen(false)}>
            Your asks and settings
          </Link>
          <Link
            role="menuitem"
            href={`/${me.profile.handle}`}
            onClick={() => setOpen(false)}
          >
            {me.profile.publicProfile ? "Your public profile" : "Your profile"}
          </Link>
          {me.admin && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => navigate("/"));
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </span>
  );
}
