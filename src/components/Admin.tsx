import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import {
  useSignInWithPassword,
  useSignUpWithPassword,
  type SignInWithPasswordResult,
  type SignUpWithPasswordResult,
} from "@convex-dev/auth/providers/password/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNow } from "../hooks/useNow";
import { formatCount, timeAgo } from "../lib/format";
import { ThemeToggle } from "./ThemeToggle";

// /admin. Not linked anywhere, noindex, and every function it calls checks
// the signed in username against ADMIN_USERNAME on the deployment.
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
    body = <SignIn configured={me?.configured ?? true} />;
  } else if (!me?.admin) {
    body = <NotAuthorized username={me?.username ?? null} />;
  } else {
    body = <Dashboard username={me.username ?? ""} />;
  }

  return (
    <main className="admin">
      <div className="wrap hero__top label">
        <a className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </a>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">{body}</section>
    </main>
  );
}

// One form, two verbs. Sign in is the default. "Create the admin account"
// flips to sign up, which the server refuses for any other username.
function SignIn({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { signIn, pending: signingIn } = useSignInWithPassword(
    api.auth.signInWithPassword,
  );
  const { signUp, pending: signingUp } = useSignUpWithPassword(
    api.auth.signUpWithPassword,
  );
  const pending = signingIn || signingUp;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const credentials = { username: username.trim(), password };
    if (mode === "in") {
      const result = await signIn(credentials);
      if (result.status === "error") setError(signInMessage(result.userError));
    } else {
      const result = await signUp(credentials);
      if (result.status === "error") setError(signUpMessage(result.userError));
    }
  };

  return (
    <form className="auth card" onSubmit={onSubmit}>
      <p className="label">Admin</p>
      <h1 className="heading-lg">
        {mode === "in" ? "Sign in." : "Create the admin account."}
      </h1>
      {!configured && (
        <p className="label" role="alert">
          ADMIN_USERNAME is not set on the deployment. Nobody can sign up.
        </p>
      )}
      <label className="label" htmlFor="admin-username">
        Email
      </label>
      <input
        id="admin-username"
        className="composer__input auth__input"
        type="email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        disabled={pending}
      />
      <label className="label" htmlFor="admin-password">
        Password
      </label>
      <input
        id="admin-password"
        className="composer__input auth__input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        required
        disabled={pending}
      />
      {error && (
        <p className="label label--ink" role="alert">
          {error}
        </p>
      )}
      <div className="auth__actions">
        <button className="pill pill--accent" type="submit" disabled={pending}>
          {pending ? "Working" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button
          className="ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMode(mode === "in" ? "up" : "in");
          }}
        >
          {mode === "in" ? "Create the admin account" : "I have an account"}
        </button>
      </div>
    </form>
  );
}

type SignInError = Extract<
  SignInWithPasswordResult,
  { status: "error" }
>["userError"];

type SignUpError = Extract<
  SignUpWithPasswordResult,
  { status: "error" }
>["userError"];

function signInMessage(userError: SignInError): string {
  switch (userError.error) {
    case "USER_NOT_FOUND":
      return "No account with that email";
    case "INVALID_CREDENTIALS":
      return "Wrong email or password";
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${userError.minimumLength} characters`;
    case "PASSWORD_TOO_LONG":
      return `Password must be at most ${userError.maximumLength} characters`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password cannot start or end with a space";
    case "RATE_LIMITED":
      return `Too many tries. Wait ${Math.ceil(userError.retryAfterMs / 1000)}s`;
    case "OTHER_ERROR":
      console.error("Sign in failed", userError.cause);
      return "Something went wrong";
  }
}

function signUpMessage(userError: SignUpError): string {
  switch (userError.error) {
    case "USERNAME_TAKEN":
      return "That account already exists. Sign in instead";
    case "USERNAME_TOO_SHORT":
      return "Email is required";
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "That email has characters that are not allowed";
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${userError.minimumLength} characters`;
    case "PASSWORD_TOO_LONG":
      return `Password must be at most ${userError.maximumLength} characters`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password cannot start or end with a space";
    case "PASSWORD_TOO_COMMON":
      return "That password is too common";
    case "OTHER_ERROR":
      // createUser threw: the username is not ADMIN_USERNAME.
      return "Sign up is closed. Only the admin email can create an account";
  }
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
        <button className="ghost" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

type AdminFilter = FunctionArgs<typeof api.admin.list>["filter"];
type AdminMessage = FunctionReturnType<typeof api.admin.search>[number];

// Filter labels. "Held" is the public word for blocked, same as the wall.
const FILTERS: Array<{ id: AdminFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "blocked", label: "Held" },
  { id: "hidden", label: "Hidden" },
];

// Keystrokes to wait before the search query goes to the server.
const SEARCH_DELAY_MS = 200;

// Counts, a filter and search row, then every matching message with a hide
// toggle. Hidden rows stay on the wall with the text blurred and labeled
// "hidden by admin" the moment the toggle lands.
function Dashboard({ username }: { username: string }) {
  const { signOut } = useAuthActions();
  const counts = useQuery(api.stats.counts);
  const setHidden = useMutation(api.admin.setHidden);
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

  return (
    <>
      <div className="admin__head">
        <div>
          <p className="label">Admin · {username}</p>
          <h1 className="heading-lg">The wall, every row.</h1>
        </div>
        <button className="ghost" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      {counts && (
        <div className="admin__counts">
          <Count label="Live" value={formatCount(counts.live)} />
          <Count label="Held back" value={formatCount(counts.blocked)} />
          <Count label="Submitted" value={formatCount(counts.submitted)} />
        </div>
      )}

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
          <ul
            className="admin__list"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {hits.map(row)}
          </ul>
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
        <ul
          className="admin__list"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {results.map(row)}
        </ul>
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
    return (
      <li
        key={m._id}
        className={"admin__row" + (m.hidden ? " admin__row--hidden" : "")}
      >
        <div className="admin__main">
          <p className="admin__text">{m.text}</p>
          <div className="admin__meta label">
            <span className={`tag tag--${m.status}`}>{m.status}</span>
            {m.hidden && <span className="tag">hidden</span>}
            {m.reply && <span>{m.reply}</span>}
            {m.topic && <span>{m.topic}</span>}
            {typeof m.harm === "number" && (
              <span>harm {m.harm.toFixed(2)}</span>
            )}
            {!m.judged && <span>unjudged</span>}
            <span>{timeAgo(m._creationTime, now)}</span>
          </div>
        </div>
        <button
          className={"ghost ghost--small" + (m.hidden ? "" : " ghost--danger")}
          type="button"
          disabled={busyId === m._id}
          onClick={() => void toggle(m._id, !m.hidden)}
        >
          {m.hidden ? "Unhide" : "Hide"}
        </button>
      </li>
    );
  }
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="card admin__count">
      <span className="label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}
