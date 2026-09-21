import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  GithubLogo,
  Globe,
  LinkSimple,
  LinkedinLogo,
  Lock,
  PencilSimple,
  XLogo,
} from "@phosphor-icons/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { REPLIES, ROUTES, TOPICS } from "../../convex/questions";
import { microToUsd } from "../../convex/lib/pricing";
import { useNow } from "../hooks/useNow";
import { formatCount, formatUsd, timeAgo } from "../lib/format";
import { AnswerBlock } from "./AnswerBlock";
import { Avatar } from "./Avatar";
import { CopyLink } from "./CopyLink";
import { FollowUp } from "./FollowUp";
import { VerdictChip } from "./JevAnswers";
import { AgreedNote } from "./Vote";
import { Link } from "./Link";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "./Tooltip";

// askjev.ai/:handle. A profile with the person's usage: asks, answers,
// streaks, a year of activity, what Jev said, which models answered,
// tokens and asks over the last thirty days, top topics, then their asks
// on the wall. Private profiles show to the owner and the admin only; the
// owner flips public or private from the pill next to the handle.

type Stats = NonNullable<FunctionReturnType<typeof api.profile.stats>>;
type Day = Stats["days"][number];

const DAY_MS = 86_400_000;
const CHART_DAYS = 30;

// UTC day keys, the same shape the server writes.
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function keyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

const MONTH = "JFMAMJJASOND";

function shortDate(key: string): string {
  return new Date(keyToMs(key)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Longest and current runs of days with at least one ask. Today counts
// toward the current run only once something is posted, but yesterday's
// run is still alive until midnight.
function streaks(
  days: Array<Day>,
  todayKey: string,
): { longest: number; current: number } {
  const active = new Set(days.filter((d) => d.asks > 0).map((d) => d.day));
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of [...active].sort()) {
    const ms = keyToMs(key);
    run = previous !== null && ms - previous === DAY_MS ? run + 1 : 1;
    previous = ms;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let cursor = keyToMs(todayKey);
  if (!active.has(todayKey)) cursor -= DAY_MS;
  while (active.has(dayKey(cursor))) {
    current++;
    cursor -= DAY_MS;
  }
  return { longest, current };
}

function modelLabel(id: string): string {
  for (const route of Object.values(ROUTES)) {
    if (route.model === id) return route.label;
  }
  return id.split("/").pop() ?? id;
}

function modelWhy(id: string): string | null {
  for (const route of Object.values(ROUTES)) {
    if (route.model === id) return route.why;
  }
  return null;
}

export function Profile({ handle }: { handle: string }) {
  const result = useQuery(api.profile.byHandle, { handle });
  const stats = useQuery(api.profile.stats, { handle });
  const { results, status, loadMore } = usePaginatedQuery(
    api.profile.publicAsks,
    { handle },
    { initialNumItems: 20 },
  );
  const now = useNow();

  useEffect(() => {
    document.title = result
      ? `${result.profile.displayName ?? `@${result.profile.handle}`} · Ask Jev`
      : "Ask Jev";
  }, [result]);

  return (
    <main className="admin page">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">
        {result === undefined ? (
          <p className="label">Loading</p>
        ) : result === null ? (
          <div className="card empty">
            <p className="subheading">No public profile at @{handle}.</p>
            <p className="body-sm muted">
              Either it does not exist or its owner keeps it private.
            </p>
          </div>
        ) : (
          <div className="pf">
            <ProfileHead profile={result.profile} own={result.own} />
            <aside className="pf__rail label">
              <Tooltip
                tip={new Date(result.profile.joinedAt).toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "long", day: "numeric" },
                )}
              >
                <span>Joined {timeAgo(result.profile.joinedAt, now)}</span>
              </Tooltip>
              {result.profile.userNumber !== null && (
                <Tooltip tip="Accounts are numbered in the order they signed up">
                  <span>User #{result.profile.userNumber}</span>
                </Tooltip>
              )}
              {result.profile.x && (
                <a
                  href={`https://x.com/${result.profile.x}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <XLogo size={13} aria-hidden="true" /> @{result.profile.x}
                </a>
              )}
              {result.profile.github && (
                <a
                  href={`https://github.com/${result.profile.github}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GithubLogo size={13} aria-hidden="true" />{" "}
                  {result.profile.github}
                </a>
              )}
              {result.profile.linkedin && (
                <a
                  href={`https://www.linkedin.com/in/${result.profile.linkedin}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LinkedinLogo size={13} aria-hidden="true" />{" "}
                  {result.profile.linkedin}
                </a>
              )}
              {result.profile.bio && (
                <p className="body-sm pf__bio">{result.profile.bio}</p>
              )}
            </aside>

            <div className="pf__main">
              {stats === undefined ? (
                <p className="label">Loading usage</p>
              ) : stats === null ? null : (
                <Usage stats={stats} now={now} />
              )}

              <section className="pf__block">
                <p className="label">
                  On the wall{" "}
                  {status !== "LoadingFirstPage" && (
                    <span className="muted">
                      {formatCount(results.length)}
                      {status === "Exhausted" ? "" : "+"}
                    </span>
                  )}
                </p>
                {status === "LoadingFirstPage" ? (
                  <p className="label">Loading</p>
                ) : results.length === 0 ? (
                  <div className="card empty">
                    <p className="subheading">Nothing on the wall yet.</p>
                  </div>
                ) : (
                  <ul className="admin__list">
                    {results.map((m) => {
                      return (
                        <li key={m._id} className="admin__row">
                          <div className="admin__main">
                            <p className="admin__text">
                              <Link href={`/a/${m._id}`}>{m.text}</Link>
                            </p>
                            <div className="admin__meta label">
                              <VerdictChip
                                reply={m.answers?.reply}
                                answers={m.answers}
                              />
                              <AgreedNote
                                agree={m.agree}
                                disagree={m.disagree}
                              />
                              {m.answers?.topic && (
                                <span>{m.answers.topic}</span>
                              )}
                              <span>{timeAgo(m._creationTime, now)}</span>
                              <CopyLink messageId={m._id} />
                              <FollowUp m={m} />
                            </div>
                            <AnswerBlock message={m} compact />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {status === "CanLoadMore" && (
                  <div className="wall__more">
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => loadMore(20)}
                    >
                      Load more
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

type ProfileRow = NonNullable<
  FunctionReturnType<typeof api.profile.byHandle>
>["profile"];

// Avatar, name, handle, the visibility pill, Share and Edit.
function ProfileHead({ profile, own }: { profile: ProfileRow; own: boolean }) {
  const update = useMutation(api.profile.update);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = `${window.location.origin}/${profile.handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const toggle = async () => {
    if (!own || busy) return;
    setBusy(true);
    try {
      await update({ publicProfile: !profile.publicProfile });
    } finally {
      setBusy(false);
    }
  };

  const pill = profile.publicProfile ? (
    <>
      <Globe size={11} aria-hidden="true" /> Public
    </>
  ) : (
    <>
      <Lock size={11} aria-hidden="true" /> Private
    </>
  );

  return (
    <header className="pf__head">
      <Avatar photoUrl={profile.photoUrl} handle={profile.handle} size={64} />
      <div className="pf__who">
        <h1 className="heading-sm">
          {profile.displayName ?? `@${profile.handle}`}
        </h1>
        <p className="label pf__handle">
          {profile.displayName && <span>@{profile.handle}</span>}
          {own ? (
            <Tooltip
              tip={
                profile.publicProfile
                  ? "Anyone with the link can see this page. Click to make it private."
                  : "Only you can see this page. Click to make it public."
              }
            >
              <button
                type="button"
                className={`tag pf__vis${profile.publicProfile ? " pf__vis--public" : ""}`}
                onClick={() => void toggle()}
                disabled={busy}
                aria-pressed={profile.publicProfile}
              >
                {pill}
              </button>
            </Tooltip>
          ) : !profile.publicProfile ? (
            <Tooltip tip="Private profile, visible to you as admin">
              <span className="tag pf__vis">{pill}</span>
            </Tooltip>
          ) : null}
        </p>
      </div>
      <div className="pf__actions">
        <Tooltip
          tip={
            profile.publicProfile
              ? "Copy the link to this profile"
              : "Copy the link. Others see it once the profile is public."
          }
        >
          <button
            type="button"
            className="ghost ghost--small"
            onClick={() => void share()}
          >
            {copied ? (
              <>
                <Check size={12} aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <LinkSimple size={12} aria-hidden="true" /> Share
              </>
            )}
          </button>
        </Tooltip>
        {own && (
          <Link className="ghost ghost--small" href="/me">
            <PencilSimple size={12} aria-hidden="true" /> Edit
          </Link>
        )}
      </div>
    </header>
  );
}

// Everything below the header that comes from the daily rows.
function Usage({ stats, now }: { stats: Stats; now: number }) {
  const todayKey = dayKey(now);
  const byDay = useMemo(
    () => new Map(stats.days.map((d) => [d.day, d])),
    [stats.days],
  );

  const totals = useMemo(() => {
    const t = {
      asks: 0,
      publicAsks: 0,
      privateAsks: 0,
      live: 0,
      held: 0,
      followUps: 0,
      answers: 0,
      jevTokens: 0,
      jevLatencyMs: 0,
      answerIn: 0,
      answerOut: 0,
      micro: 0,
    };
    for (const d of stats.days) {
      t.asks += d.asks;
      t.publicAsks += d.publicAsks;
      t.privateAsks += d.privateAsks;
      t.live += d.live;
      t.held += d.held;
      t.followUps += d.followUps;
      t.answers += d.answers;
      t.jevTokens += d.jevTokens;
      t.jevLatencyMs += d.jevLatencyMs;
      t.answerIn += d.answerInputTokens;
      t.answerOut += d.answerOutputTokens;
      t.micro += d.answerMicroUsd;
    }
    return t;
  }, [stats.days]);

  const { longest, current } = useMemo(
    () => streaks(stats.days, todayKey),
    [stats.days, todayKey],
  );

  const judged = totals.live + totals.held;
  const avgMs = judged > 0 ? Math.round(totals.jevLatencyMs / judged) : null;
  const tokens = totals.jevTokens + totals.answerIn + totals.answerOut;

  // Last thirty days, oldest first, zeros where nothing happened.
  const recent = useMemo(() => {
    const out: Array<Day> = [];
    const end = keyToMs(todayKey);
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const key = dayKey(end - i * DAY_MS);
      out.push(byDay.get(key) ?? emptyDay(key));
    }
    return out;
  }, [byDay, todayKey]);

  const models = Object.entries(stats.models).sort((a, b) => b[1] - a[1]);
  const topics = Object.entries(stats.topics)
    .filter(([k]) => k in TOPICS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (totals.asks === 0) {
    return (
      <div className="card empty">
        <p className="subheading">No asks yet.</p>
        <p className="body-sm muted">
          Usage shows up here from the first ask: streaks, a year of activity,
          what Jev said, which models answered, and tokens.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="pf__stats">
        <Stat
          label="Asks"
          value={formatCount(totals.asks)}
          tip="Every ask this account posted, wall and private, including ones Jev held"
        />
        <Stat
          label="Answers"
          value={formatCount(totals.answers)}
          tip="Model answers written for this account's asks and follow ups"
        />
        <Stat
          label="Longest streak"
          value={`${longest}d`}
          tip="Most consecutive days with at least one ask"
        />
        <Stat
          label="Current streak"
          value={`${current}d`}
          tip="Consecutive days with an ask, counting back from today. Yesterday's run holds until midnight UTC"
        />
      </div>

      <Heatmap byDay={byDay} todayKey={todayKey} />

      <section className="pf__block">
        <p className="label">Jev said</p>
        <ReplySplit replies={stats.replies} />
        <p className="label muted">
          {avgMs !== null && `Jev answered in ${avgMs}ms on average · `}
          {formatCount(totals.live)} on the wall or private
          {totals.held > 0 && ` · ${formatCount(totals.held)} held`}
          {totals.followUps > 0 &&
            ` · ${formatCount(totals.followUps)} follow ups`}
        </p>
      </section>

      {models.length > 0 && (
        <section className="pf__block">
          <p className="label">Models</p>
          <ol className="pf__models">
            {models.map(([id, n], i) => {
              const why = modelWhy(id);
              return (
                <li key={id} className="card pf__model">
                  <span className="pf__rank label">{i + 1}</span>
                  <span className="body">{modelLabel(id)}</span>
                  <span className="label muted">
                    {formatCount(n)} {n === 1 ? "answer" : "answers"}
                    {why && ` · ${why}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="pf__block">
        <p className="label">Tokens</p>
        <p className="heading-sm pf__big">{formatCount(tokens)} tokens</p>
        <p className="label muted">
          Jev {formatCount(totals.jevTokens)} in
          {totals.answers > 0 &&
            ` · models ${formatCount(totals.answerIn)} in, ${formatCount(totals.answerOut)} out · ${formatUsd(microToUsd(totals.micro))} in answers`}
        </p>
        <AreaChart
          values={recent.map(
            (d) => d.jevTokens + d.answerInputTokens + d.answerOutputTokens,
          )}
          labels={recent.map((d) => d.day)}
          unit="tokens"
        />
        <div className="pf__axis label muted">
          <span>{shortDate(recent[0]!.day)}</span>
          <span>Today</span>
        </div>
      </section>

      <section className="pf__block">
        <p className="label">Asks</p>
        <p className="heading-sm pf__big">
          {formatCount(totals.asks)} {totals.asks === 1 ? "ask" : "asks"}
        </p>
        <p className="label pf__legend">
          <span>
            <i className="pf__swatch pf__swatch--wall" /> Wall (
            {formatCount(totals.publicAsks)})
          </span>
          {stats.own && (
            <span>
              <i className="pf__swatch pf__swatch--private" /> Private (
              {formatCount(totals.privateAsks)})
            </span>
          )}
        </p>
        <BarChart
          series={
            stats.own
              ? [
                  {
                    key: "wall",
                    values: recent.map((d) => d.publicAsks),
                  },
                  {
                    key: "private",
                    values: recent.map((d) => d.privateAsks),
                  },
                ]
              : [{ key: "wall", values: recent.map((d) => d.asks) }]
          }
          labels={recent.map((d) => d.day)}
        />
        <div className="pf__axis label muted">
          <span>{shortDate(recent[0]!.day)}</span>
          <span>Today</span>
        </div>
      </section>

      {topics.length > 0 && (
        <section className="pf__block">
          <p className="label">Asks about</p>
          <p className="pf__topics">
            {topics.map(([k, n]) => (
              <Tooltip key={k} tip={TOPICS[k as keyof typeof TOPICS]}>
                <span className="tag">
                  {k} <span className="muted">{formatCount(n)}</span>
                </span>
              </Tooltip>
            ))}
          </p>
        </section>
      )}
    </>
  );
}

function emptyDay(day: string): Day {
  return {
    day,
    asks: 0,
    publicAsks: 0,
    privateAsks: 0,
    live: 0,
    held: 0,
    followUps: 0,
    answers: 0,
    jevTokens: 0,
    jevLatencyMs: 0,
    answerInputTokens: 0,
    answerOutputTokens: 0,
    answerMicroUsd: 0,
  };
}

function Stat({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip: string;
}) {
  return (
    <div className="pf__stat">
      <Tooltip tip={tip}>
        <span className="label">{label}</span>
      </Tooltip>
      <span className="heading-sm">{value}</span>
    </div>
  );
}

// Fifty three columns of seven dots, one per day, ending today. Month
// letters above the column where a month starts, M W F down the side.
// Four shades of the accent by share of the busiest day.
function Heatmap({
  byDay,
  todayKey,
}: {
  byDay: Map<string, Day>;
  todayKey: string;
}) {
  const grid = useMemo(() => {
    const end = keyToMs(todayKey);
    const endDow = new Date(end).getUTCDay();
    // Start on the Sunday 52 weeks before the week that holds today.
    const start = end - endDow * DAY_MS - 52 * 7 * DAY_MS;
    const weeks: Array<Array<{ key: string; asks: number; future: boolean }>> =
      [];
    const months: Array<{ col: number; letter: string }> = [];
    let lastMonth = -1;
    let max = 0;
    for (let w = 0; w < 53; w++) {
      const week: Array<{ key: string; asks: number; future: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const ms = start + (w * 7 + d) * DAY_MS;
        const key = dayKey(ms);
        const asks = byDay.get(key)?.asks ?? 0;
        max = Math.max(max, asks);
        week.push({ key, asks, future: ms > end });
        if (d === 0) {
          const month = new Date(ms).getUTCMonth();
          if (month !== lastMonth) {
            months.push({ col: w, letter: MONTH[month]! });
            lastMonth = month;
          }
        }
      }
      weeks.push(week);
    }
    return { weeks, months, max };
  }, [byDay, todayKey]);

  const level = (asks: number): number => {
    if (asks === 0 || grid.max === 0) return 0;
    const share = asks / grid.max;
    if (share >= 0.75) return 4;
    if (share >= 0.5) return 3;
    if (share >= 0.25) return 2;
    return 1;
  };

  return (
    <section className="pf__block">
      <div className="pf__heat" role="img" aria-label="Asks per day, last year">
        <div className="pf__heatMonths label muted">
          {grid.months.map((m) => (
            <span
              key={`${m.col}-${m.letter}`}
              style={{ gridColumn: m.col + 1 }}
            >
              {m.letter}
            </span>
          ))}
        </div>
        <div className="pf__heatDays label muted">
          <span style={{ gridRow: 2 }}>M</span>
          <span style={{ gridRow: 4 }}>W</span>
          <span style={{ gridRow: 6 }}>F</span>
        </div>
        <div className="pf__heatGrid">
          {grid.weeks.map((week, w) =>
            week.map((cell, d) => (
              <span
                key={cell.key}
                className={`pf__dot pf__dot--${level(cell.asks)}${cell.future ? " pf__dot--future" : ""}`}
                style={{ gridColumn: w + 1, gridRow: d + 1 }}
                title={
                  cell.future
                    ? undefined
                    : `${cell.asks} ${cell.asks === 1 ? "ask" : "asks"} · ${shortDate(cell.key)}`
                }
              />
            )),
          )}
        </div>
      </div>
    </section>
  );
}

const REPLY_ORDER = ["yes", "no", "depends", "open", "statement"] as const;
const REPLY_WORD: Record<(typeof REPLY_ORDER)[number], string> = {
  yes: "yes",
  no: "no",
  depends: "it depends",
  open: "open question",
  statement: "statement",
};

// One bar split by Jev's verdicts, with a legend. The wall app's own
// signature stat: no other profile page can show what a judge said.
function ReplySplit({ replies }: { replies: Record<string, number> }) {
  const total = REPLY_ORDER.reduce((n, k) => n + (replies[k] ?? 0), 0);
  if (total === 0) {
    return <p className="body-sm muted">Jev has not judged an ask here yet.</p>;
  }
  return (
    <>
      <div className="pf__split" aria-hidden="true">
        {REPLY_ORDER.map((k) => {
          const n = replies[k] ?? 0;
          if (n === 0) return null;
          return (
            <span
              key={k}
              className={`pf__seg pf__seg--${k}`}
              style={{ flexGrow: n }}
            />
          );
        })}
      </div>
      <ul className="pf__legend label">
        {REPLY_ORDER.map((k) => {
          const n = replies[k] ?? 0;
          if (n === 0) return null;
          return (
            <li key={k}>
              <Tooltip tip={REPLIES[k]}>
                <span>
                  <i className={`pf__swatch pf__seg--${k}`} /> {REPLY_WORD[k]}{" "}
                  {Math.round((n / total) * 100)}%
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const W = 600;
const H = 120;

// A filled line over the last thirty days. Pure SVG, no chart library.
function AreaChart({
  values,
  labels,
  unit,
}: {
  values: Array<number>;
  labels: Array<string>;
  unit: string;
}) {
  const max = Math.max(1, ...values);
  const step = W / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, H - (v / max) * (H - 8) - 4]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M0,${H} L${line.replace(/ /g, " L")} L${W},${H} Z`;
  return (
    <svg
      className="pf__chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${unit} per day, last ${values.length} days`}
    >
      <path className="pf__area" d={area} />
      <polyline className="pf__line" points={line} />
      {pts.map(([x, y], i) =>
        values[i]! > 0 ? (
          <circle key={labels[i]} className="pf__pt" cx={x} cy={y} r={3}>
            <title>
              {formatCount(values[i]!)} {unit} · {shortDate(labels[i]!)}
            </title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}

// Stacked bars, one per day. Series draw in order, bottom up.
function BarChart({
  series,
  labels,
}: {
  series: Array<{ key: string; values: Array<number> }>;
  labels: Array<string>;
}) {
  const n = labels.length;
  const totals = labels.map((_, i) =>
    series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(1, ...totals);
  const gap = 3;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg
      className="pf__chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Asks per day, last ${n} days`}
    >
      {labels.map((label, i) => {
        let y = H;
        return (
          <g key={label}>
            <title>
              {formatCount(totals[i]!)} {totals[i] === 1 ? "ask" : "asks"} ·{" "}
              {shortDate(label)}
            </title>
            {series.map((s) => {
              const v = s.values[i] ?? 0;
              if (v === 0) return null;
              const h = (v / max) * (H - 4);
              y -= h;
              return (
                <rect
                  key={s.key}
                  className={`pf__bar pf__bar--${s.key}`}
                  x={i * (bw + gap)}
                  y={y}
                  width={bw}
                  height={h}
                  rx={2}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
