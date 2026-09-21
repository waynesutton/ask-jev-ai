import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNow } from "../hooks/useNow";
import { formatCount, formatUsd, timeAgo } from "../lib/format";
import { Link } from "./Link";
import { Tooltip } from "./Tooltip";

type UserFilter = FunctionArgs<typeof api.admin.users>["filter"];
type AdminUser = FunctionReturnType<typeof api.admin.findUsers>[number];
type UserStatus = AdminUser["status"];

const FILTERS: Array<{ id: UserFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "blocked", label: "Blocked" },
];

const SEARCH_DELAY_MS = 200;

// Users tab. Every account with usage, a status filter, prefix search on
// email or handle, and a drawer per row with pause, block, and activate.
// Pause keeps the account and its content but stops new asks. Block hides
// every ask and stops the email from signing up again.
export function AdminUsers() {
  const [filter, setFilter] = useState<UserFilter>("all");
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.users,
    { filter },
    { initialNumItems: 30 },
  );

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);
  const hits = useQuery(api.admin.findUsers, term ? { q: term } : "skip");
  const searching = term.length > 0;
  const clearSearch = () => {
    setQ("");
    setTerm("");
    inputRef.current?.focus();
  };

  const [openId, setOpenId] = useState<Id<"users"> | null>(null);

  const rows = searching ? hits : results;

  return (
    <>
      <div className="admin__tools">
        <div className="seg" role="group" aria-label="Filter accounts">
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
            placeholder="Email or handle"
            aria-label="Search accounts by email or handle"
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
            : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`
          : `${FILTERS.find((f) => f.id === filter)?.label ?? ""} · newest first`}
      </p>

      {rows === undefined || status === "LoadingFirstPage" ? (
        <p className="label">Loading</p>
      ) : rows.length === 0 ? (
        <div className="card empty">
          <p className="subheading">
            {searching ? "No account matches that." : "No accounts here."}
          </p>
        </div>
      ) : (
        <ul className="admin__list">
          {rows.map((u) => (
            <UserRow
              key={u._id}
              user={u}
              open={openId === u._id}
              onToggle={() => setOpenId(openId === u._id ? null : u._id)}
            />
          ))}
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
}

function UserRow({
  user,
  open,
  onToggle,
}: {
  user: AdminUser;
  open: boolean;
  onToggle: () => void;
}) {
  const now = useNow();
  const u = user.usage;
  return (
    <li
      className={
        "admin__row admin__row--user" +
        (user.status === "blocked" ? " admin__row--hidden" : "")
      }
    >
      <div className="admin__main">
        <p className="admin__text">
          <button
            type="button"
            className="admin__userBtn"
            onClick={onToggle}
            aria-expanded={open}
          >
            {user.email}
          </button>
          {user.admin && <span className="tag">admin</span>}
        </p>
        <div className="admin__meta label">
          <span className={`tag tag--${statusTone(user.status)}`}>
            {user.status}
          </span>
          {user.handle && (
            <Link href={`/${user.handle}`}>@{user.handle}</Link>
          )}
          {typeof user.userNumber === "number" && (
            <span>user #{user.userNumber}</span>
          )}
          <Tooltip tip="Asks sent while signed in: public and private">
            <span>
              {formatCount(u.asks)} asks · {formatCount(u.privateAsks)} private
            </span>
          </Tooltip>
          <Tooltip tip="Model answers completed for this account">
            <span>{formatCount(u.answers)} answers</span>
          </Tooltip>
          <Tooltip tip="Answer tokens in and out through the AI Gateway">
            <span>
              {formatCount(u.answerInputTokens + u.answerOutputTokens)} tokens
            </span>
          </Tooltip>
          <Tooltip tip="Model answer spend at list price, before Jev">
            <span>{formatUsd(u.answerUsd)}</span>
          </Tooltip>
          <span>
            {u.lastAskAt ? `last ask ${timeAgo(u.lastAskAt, now)}` : "no asks"}
          </span>
          <span>joined {timeAgo(user._creationTime, now)}</span>
        </div>
        {user.statusReason && (
          <p className="body-sm muted">Reason: {user.statusReason}</p>
        )}
        {open && <UserDrawer userId={user._id} status={user.status} />}
      </div>
      <div className="admin__rowActions">
        <button
          className="ghost ghost--small"
          type="button"
          onClick={onToggle}
          aria-expanded={open}
        >
          {open ? "Close" : "Manage"}
        </button>
      </div>
    </li>
  );
}

function statusTone(status: UserStatus): string {
  if (status === "active") return "live";
  if (status === "paused") return "pending";
  return "blocked";
}

// Recent asks and the three moderation verbs. The admin account itself has
// no verbs; the server refuses them too.
function UserDrawer({
  userId,
  status,
}: {
  userId: Id<"users">;
  status: UserStatus;
}) {
  const detail = useQuery(api.admin.userDetail, { userId });
  const setUserStatus = useMutation(api.admin.setUserStatus);
  const now = useNow();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (next: UserStatus) => {
    setBusy(true);
    setError(null);
    try {
      await setUserStatus({
        userId,
        status: next,
        reason: reason.trim() || undefined,
      });
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  if (detail === undefined) return <p className="label">Loading</p>;
  if (detail === null) return <p className="label">Account not found</p>;

  return (
    <div className="admin__drawer">
      {!detail.user.admin && (
        <div className="admin__verbs">
          <input
            className="composer__input auth__input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (kept on the account, not shown to them)"
            aria-label="Reason"
            maxLength={200}
            disabled={busy}
          />
          <div className="auth__actions">
            {status !== "active" && (
              <Tooltip tip="Restore asks. Unblock also puts hidden asks back">
                <button
                  className="pill pill--accent"
                  type="button"
                  disabled={busy}
                  onClick={() => void apply("active")}
                >
                  {status === "blocked" ? "Unblock" : "Unpause"}
                </button>
              </Tooltip>
            )}
            {status !== "paused" && (
              <Tooltip tip="Keep the account and its asks, stop new ones">
                <button
                  className="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void apply("paused")}
                >
                  Pause
                </button>
              </Tooltip>
            )}
            {status !== "blocked" && (
              <Tooltip tip="Sign them out, hide every ask, and bar the email from signing up again">
                <button
                  className="ghost ghost--danger"
                  type="button"
                  disabled={busy}
                  onClick={() => void apply("blocked")}
                >
                  Block
                </button>
              </Tooltip>
            )}
          </div>
          {error && (
            <p className="label label--ink" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      <p className="label">Recent asks</p>
      {detail.recent.length === 0 ? (
        <p className="body-sm muted">None yet.</p>
      ) : (
        <ul className="admin__recent">
          {detail.recent.map((m) => (
            <li key={m._id} className="body-sm">
              <Link href={`/a/${m._id}`}>{m.text}</Link>
              <span className="label">
                {" "}
                · {m.visibility} · {m.status}
                {m.hidden ? " · hidden" : ""} · {timeAgo(m._creationTime, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
