import { useEffect, useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { MOOD_LABELS } from "../../convex/questions";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useNow } from "../hooks/useNow";
import { formatUsd, timeAgo } from "../lib/format";
import { JevAnswers, replyChip } from "./JevAnswers";

type PublicMessage = FunctionReturnType<typeof api.messages.search>[number];

// Keystrokes to wait before the search query goes to the server.
const SEARCH_DELAY_MS = 200;

// Every live message, newest first. Reactive: new posts appear on their own.
// Each card carries a small dot in the color for its mood, with the mood
// word beside it so color is never the only signal. When the admin is signed
// in, each card also gets a Hide or Unhide button so moderation can happen
// right on the wall. A search pill in the intro swaps the grid for full text
// matches while it has a query.
export function Wall() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.wall,
    {},
    { initialNumItems: 24 },
  );
  const mood = useQuery(api.stats.mood);
  const now = useNow();
  const isAdmin = useIsAdmin();
  const setHidden = useMutation(api.admin.setHidden);
  const [busyId, setBusyId] = useState<Id<"messages"> | null>(null);

  // Search. `q` follows the keystrokes; `term` is what the server sees,
  // trailing the input by a beat so a fast typer does not fire a query per
  // character.
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);
  const hits = useQuery(api.messages.search, term ? { q: term } : "skip");
  const searching = term.length > 0;

  const openSearch = () => {
    setOpen(true);
    // Focus after the pill has rendered its input.
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const closeSearch = () => {
    setOpen(false);
    setQ("");
    setTerm("");
  };

  const toggle = async (messageId: Id<"messages">, hidden: boolean) => {
    setBusyId(messageId);
    try {
      await setHidden({ messageId, hidden });
    } finally {
      setBusyId(null);
    }
  };

  const card = (m: PublicMessage) => (
    <WallCard
      key={m._id}
      m={m}
      now={now}
      isAdmin={isAdmin}
      busy={busyId === m._id}
      onToggle={toggle}
    />
  );

  return (
    <section className="section" id="wall">
      <div className="wrap">
        <div className="intro">
          <p className="label">
            {searching
              ? hits === undefined
                ? "Searching"
                : `${hits.length} ${hits.length === 1 ? "match" : "matches"} · best first`
              : "Live · newest first"}
          </p>
          <h2 className="heading-lg">The wall.</h2>
          <p className="subheading muted">
            {mood?.label
              ? `Mood of the wall right now: ${mood.label.toLowerCase()}, from the last ${mood.sample}.`
              : "Everyone sees everything, the moment it lands."}
          </p>

          {/* Search pill. A ghost circle with a magnifier until opened, then
              a pill input with a clear button. Escape or the X closes it and
              puts the live grid back. */}
          <div className={"search" + (open ? " search--open" : "")}>
            <button
              type="button"
              className="search__icon"
              aria-label={open ? "Search the wall" : "Open search"}
              aria-expanded={open}
              onClick={open ? () => inputRef.current?.focus() : openSearch}
            >
              <MagnifyingGlass size={18} aria-hidden="true" />
            </button>
            <input
              ref={inputRef}
              className="search__input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search the wall"
              aria-label="Search the wall"
              tabIndex={open ? 0 : -1}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="search__clear"
              aria-label="Close search"
              onClick={closeSearch}
              tabIndex={open ? 0 : -1}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {searching ? (
          hits === undefined ? (
            <p className="body-sm muted">Searching</p>
          ) : hits.length === 0 ? (
            <div className="card empty">
              <p className="subheading">Nothing on the wall matches that.</p>
            </div>
          ) : (
            <ul
              className="wall__grid"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {hits.map(card)}
            </ul>
          )
        ) : status === "LoadingFirstPage" ? (
          <p className="body-sm muted">Loading</p>
        ) : results.length === 0 ? (
          <div className="card empty">
            <p className="subheading">
              Nothing here yet. Be the first of a million.
            </p>
          </div>
        ) : (
          <ul
            className="wall__grid"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {results.map(card)}
          </ul>
        )}

        {!searching && status === "CanLoadMore" && (
          <div className="wall__more">
            <button
              className="ghost"
              type="button"
              onClick={() => loadMore(24)}
            >
              Load more
            </button>
          </div>
        )}
        {!searching && status === "LoadingMore" && (
          <div className="wall__more body-sm muted">Loading</div>
        )}
      </div>
    </section>
  );
}

// One card. Shared by the live grid and the search results.
function WallCard({
  m,
  now,
  isAdmin,
  busy,
  onToggle,
}: {
  m: PublicMessage;
  now: number;
  isAdmin: boolean;
  busy: boolean;
  onToggle: (messageId: Id<"messages">, hidden: boolean) => Promise<void>;
}) {
  const label = typeof m.mood === "number" ? moodLabel(m.mood) : null;
  const chip = replyChip(m.reply);
  return (
    <li
      className={
        "card wallcard" +
        (label ? ` wallcard--${label.toLowerCase()}` : "") +
        (m.hidden ? " wallcard--hidden" : "")
      }
    >
      {/* Hidden rows arrive masked from the server. The blur is cosmetic;
          the words never reach the browser. Everything else on the card
          stays put so a hide reads as a blur, not a different card. */}
      <p
        className={
          "wallcard__text" +
          (m.text.split(" ").length > 8 ? " wallcard__text--long" : "") +
          (m.hidden ? " wallcard__text--hidden" : "")
        }
        aria-hidden={m.hidden || undefined}
      >
        {m.text}
      </p>
      <div className="wallcard__foot">
        <div className="wallcard__meta caption muted">
          {m.hidden && (
            <span className="wallcard__hidden">hidden by admin</span>
          )}
          {m.judged ? (
            <>
              {chip && <span className="tag">{chip}</span>}
              {label && (
                <span className="wallcard__mood">
                  <span className="dot dot--mood" aria-hidden="true" />
                  {label.toLowerCase()}
                </span>
              )}
              {m.topic && <span>{m.topic}</span>}
              {typeof m.costUsd === "number" && (
                <span>
                  {formatUsd(m.costUsd)}
                  {typeof m.latencyMs === "number" && ` · ${m.latencyMs}ms`}
                </span>
              )}
            </>
          ) : (
            <span>Jev offline</span>
          )}
          <span>{timeAgo(m._creationTime, now)}</span>
          {isAdmin && (
            <button
              className={
                "ghost ghost--small wallcard__admin" +
                (m.hidden ? "" : " ghost--danger")
              }
              type="button"
              disabled={busy}
              onClick={() => void onToggle(m._id, !m.hidden)}
            >
              {m.hidden ? "Unhide" : "Hide"}
            </button>
          )}
        </div>
        {m.answers && <JevAnswers answers={m.answers} />}
      </div>
    </li>
  );
}

function moodLabel(score: number): string {
  const index = Math.min(
    MOOD_LABELS.length - 1,
    Math.max(0, Math.round(score)),
  );
  return MOOD_LABELS[index];
}
