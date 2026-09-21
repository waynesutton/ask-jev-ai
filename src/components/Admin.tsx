import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNow } from "../hooks/useNow";
import { formatCount, timeAgo } from "../lib/format";
import { AdminUsers } from "./AdminUsers";
import { AuthForm } from "./AuthForm";
import { Link } from "./Link";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "./Tooltip";

// /admin. Not linked anywhere, noindex, and every function it calls checks
// the signed in username against ADMIN_USERNAME on the deployment. The
// admin is a normal account with one extra role: same sign in form, same
// session, more buttons.
export function Admin() {
  // Belt and braces with robots.txt: tell crawlers that do land here to skip it.
  useEffect(() => {
    document.title = "Admin";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.admin.me);

  let body: ReactNode;
  if (isLoading || (isAuthenticated && me === undefined)) {
    body = <p className="label">Checking session</p>;
  } else if (!isAuthenticated) {
    body = (
      <AuthForm
        providers={false}
        mode="in"
        eyebrow="Admin"
        heading="Sign in."
        note={
          <>
            {me && !me.configured && (
              <p className="label" role="alert">
                ADMIN_USERNAME is not set on the deployment. Nobody is admin.
              </p>
            )}
            {me?.signupOpen && (
              <p className="label">
                The admin sign up window is open. Create the account at /sign-up
                with the admin email, then remove ADMIN_SIGNUP_OPEN.
              </p>
            )}
          </>
        }
        other={
          me?.signupOpen
            ? { href: "/sign-up", label: "Create the admin account" }
            : undefined
        }
      />
    );
  } else if (!me?.admin) {
    body = <NotAuthorized username={me?.username ?? null} />;
  } else {
    body = <Dashboard username={me.username ?? ""} />;
  }

  return (
    <main className="admin">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">{body}</section>
    </main>
  );
}

function NotAuthorized({ username }: { username: string | null }) {
  const { signOut } = useAuthActions();
  return (
    <div className="auth card">
      <p className="label">Admin</p>
      <h1 className="heading-lg">Not authorized.</h1>
      <p className="body">
        {username ? `${username} is signed in, but ` : "This session "}
        does not match ADMIN_USERNAME on the deployment.
      </p>
      <div className="auth__actions">
        <Link className="ghost" href="/">
          Back to the wall
        </Link>
        <button className="ghost" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

type AdminFilter = FunctionArgs<typeof api.admin.list>["filter"];
export type AdminMessage = FunctionReturnType<typeof api.admin.search>[number];

// Filter labels. "Held" is the public word for blocked, same as the wall.
const FILTERS: Array<{ id: AdminFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "private", label: "Private" },
  { id: "blocked", label: "Held" },
  { id: "hidden", label: "Hidden" },
];

// Keystrokes to wait before the search query goes to the server.
const SEARCH_DELAY_MS = 200;

type Tab = "asks" | "users";

// Counts, then two tabs: every ask with hide toggles, and every account
// with pause and block.
function Dashboard({ username }: { username: string }) {
  const { signOut } = useAuthActions();
  const counts = useQuery(api.stats.counts);
  const userTotals = useQuery(api.admin.userTotals);
  const [tab, setTab] = useState<Tab>("asks");

  return (
    <>
      <div className="admin__head">
        <div>
          <p className="label">Admin · {username}</p>
          <h1 className="heading-lg">
            {tab === "asks" ? "Every ask, every row." : "Every account."}
          </h1>
        </div>
        <div className="admin__headActions">
          <Link className="ghost" href="/me">
            My account
          </Link>
          <button
            className="ghost"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>

      {counts && (
        <div className="admin__counts">
          <Count label="Live" value={formatCount(counts.live)} />
          <Count label="Held back" value={formatCount(counts.blocked)} />
          <Count label="Submitted" value={formatCount(counts.submitted)} />
          {userTotals && (
            <Count
              label="Accounts"
              value={formatCount(userTotals.accounts)}
              sub={
                userTotals.paused + userTotals.blocked > 0
                  ? `${userTotals.paused} paused · ${userTotals.blocked} blocked`
                  : undefined
              }
            />
          )}
        </div>
      )}

      <div className="seg admin__tabs" role="tablist" aria-label="Admin tabs">
        <button
          type="button"
          role="tab"
          className={"seg__btn" + (tab === "asks" ? " seg__btn--on" : "")}
          aria-selected={tab === "asks"}
          onClick={() => setTab("asks")}
        >
          Asks
        </button>
        <button
          type="button"
          role="tab"
          className={"seg__btn" + (tab === "users" ? " seg__btn--on" : "")}
          aria-selected={tab === "users"}
          onClick={() => setTab("users")}
        >
          Users
        </button>
      </div>

      {tab === "asks" ? <Asks /> : <AdminUsers />}
    </>
  );
}

// A filter and search row, then every matching message with hide toggles.
// Hidden rows stay on the wall with the text blurred and labeled "hidden
// by admin" the moment the toggle lands. Private asks show here too, since
// moderation covers everything that reaches a model.
function Asks() {
  const setHidden = useMutation(api.admin.setHidden);
  const setAnswerHidden = useMutation(api.admin.setAnswerHidden);
  const [filter, setFilter] = useState<AdminFilter>("all");
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.list,
    { filter },
    { initialNumItems: 30 },
  );
  const now = useNow();
  const [busyId, setBusyId] = useState<Id<"messages"> | null>(null);

  // Search. `q` follows the keystrokes; `term` trails by a beat so a fast
  // typer does not fire a query per character. Results replace the list.
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);
  const hits = useQuery(api.admin.search, term ? { q: term, filter } : "skip");
  const searching = term.length > 0;
  const clearSearch = () => {
    setQ("");
    setTerm("");
    inputRef.current?.focus();
  };

  const toggle = async (messageId: Id<"messages">, hidden: boolean) => {
    setBusyId(messageId);
    try {
      await setHidden({ messageId, hidden });
    } finally {
      setBusyId(null);
    }
  };

  const toggleAnswer = async (messageId: Id<"messages">, hidden: boolean) => {
    setBusyId(messageId);
    try {
      await setAnswerHidden({ messageId, hidden });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* Tools. Segmented filter on the left, search pill on the right. The
          filter applies to the list and to search hits alike. */}
      <div className="admin__tools">
        <div className="seg" role="group" aria-label="Filter rows">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={"seg__btn" + (filter === f.id ? " seg__btn--on" : "")}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="search search--open search--static">
          <span className="search__icon" aria-hidden="true">
            <MagnifyingGlass size={18} />
          </span>
          <input
            ref={inputRef}
            className="search__input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") clearSearch();
            }}
            placeholder="Search every row"
            aria-label="Search every row"
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button
              type="button"
              className="search__clear"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <p className="label">
        {searching
          ? hits === undefined
            ? "Searching"
            : `${hits.length}${hits.length === 30 ? "+" : ""} ${hits.length === 1 ? "match" : "matches"} · best first`
          : `${FILTERS.find((f) => f.id === filter)?.label ?? ""} · newest first`}
      </p>

      {searching ? (
        hits === undefined ? (
          <p className="label">Searching</p>
        ) : hits.length === 0 ? (
          <div className="card empty">
            <p className="subheading">No row matches that.</p>
          </div>
        ) : (
          <ul className="admin__list">{hits.map(row)}</ul>
        )
      ) : status === "LoadingFirstPage" ? (
        <p className="label">Loading</p>
      ) : results.length === 0 ? (
        <div className="card empty">
          <p className="subheading">
            {filter === "all" ? "Nothing posted yet." : "Nothing here."}
          </p>
        </div>
      ) : (
        <ul className="admin__list">{results.map(row)}</ul>
      )}

      {!searching && status === "CanLoadMore" && (
        <div className="wall__more">
          <button className="ghost" type="button" onClick={() => loadMore(30)}>
            Load more
          </button>
        </div>
      )}
      {!searching && status === "LoadingMore" && (
        <div className="wall__more label">Loading</div>
      )}
    </>
  );

  // One row. Shared by the paginated list and the search hits.
  function row(m: AdminMessage) {
    const busy = busyId === m._id;
    return (
      <li
        key={m._id}
        className={"admin__row" + (m.hidden ? " admin__row--hidden" : "")}
      >
        <div className="admin__main">
          <p className="admin__text">
            <Link href={`/a/${m._id}`}>{m.text}</Link>
          </p>
          <div className="admin__meta label">
            <span className={`tag tag--${m.status}`}>{m.status}</span>
            {m.visibility === "private" && <span className="tag">private</span>}
            {m.hidden && <span className="tag">hidden</span>}
            {m.handle ? (
              <Tooltip tip={m.email ?? "Signed in account"}>
                <Link href={`/${m.handle}`}>@{m.handle}</Link>
              </Tooltip>
            ) : (
              <span>anonymous</span>
            )}
            {m.reply && <span>{m.reply}</span>}
            {m.topic && <span>{m.topic}</span>}
            {typeof m.harm === "number" && (
              <span>harm {m.harm.toFixed(2)}</span>
            )}
            {m.answerModel && (
              <span>
                {m.route ? `${m.route} · ` : ""}
                {m.answerModel}
                {m.answerStatus && m.answerStatus !== "done"
                  ? ` · ${m.answerStatus}`
                  : ""}
              </span>
            )}
            {!m.judged && <span>unjudged</span>}
            <span>{timeAgo(m._creationTime, now)}</span>
          </div>
          {m.answerText && (
            <p
              className={
                "admin__answer body-sm" +
                (m.answerHidden ? " admin__answer--hidden" : "")
              }
            >
              {m.answerText}
            </p>
          )}
        </div>
        <div className="admin__rowActions">
          <Tooltip
            tip={
              m.hidden
                ? "Show this ask on the wall again"
                : "Blur this ask on the wall and mark it hidden by admin"
            }
          >
            <button
              className={
                "ghost ghost--small" + (m.hidden ? "" : " ghost--danger")
              }
              type="button"
              disabled={busy}
              onClick={() => void toggle(m._id, !m.hidden)}
            >
              {m.hidden ? "Unhide" : "Hide"}
            </button>
          </Tooltip>
          {m.answerText && (
            <Tooltip
              tip={
                m.answerHidden
                  ? "Show the model answer to everyone again"
                  : "Hide the model answer from everyone but the owner and admin"
              }
            >
              <button
                className={
                  "ghost ghost--small" +
                  (m.answerHidden ? "" : " ghost--danger")
                }
                type="button"
                disabled={busy}
                onClick={() => void toggleAnswer(m._id, !m.answerHidden)}
              >
                {m.answerHidden ? "Unhide answer" : "Hide answer"}
              </button>
            </Tooltip>
          )}
        </div>
      </li>
    );
  }
}

export function Count({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card admin__count">
      <span className="label">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="label">{sub}</span>}
    </div>
  );
}
