import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type UsageCounts = Omit<Doc<"userUsage">, "_id" | "_creationTime" | "userId">;

const ZERO: UsageCounts = {
  asks: 0,
  publicAsks: 0,
  privateAsks: 0,
  answers: 0,
  answerInputTokens: 0,
  answerOutputTokens: 0,
  answerMicroUsd: 0,
  jevInputTokens: 0,
  jevOutputTokens: 0,
  lastAskAt: 0,
};

// Add to a user's usage row, creating it on first touch. Every field is a
// delta except lastAskAt, which takes the newer value. One row per user,
// so a user posting quickly serializes on it; at twenty a minute that is
// nothing.
export async function bumpUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
  delta: Partial<UsageCounts>,
): Promise<void> {
  const row = await ctx.db
    .query("userUsage")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const base: UsageCounts = row ? { ...row } : { ...ZERO };
  const next: UsageCounts = { ...base };
  for (const key of Object.keys(ZERO) as Array<keyof UsageCounts>) {
    const add = delta[key];
    if (add === undefined) continue;
    next[key] =
      key === "lastAskAt" ? Math.max(base[key], add) : base[key] + add;
  }
  if (row) {
    await ctx.db.patch(row._id, next);
  } else {
    await ctx.db.insert("userUsage", { userId, ...next });
  }
}

// Daily rows for the profile page. Same idea as bumpUsage, one row per
// user per UTC day, with three record fields whose keys come from code:
// Jev's reply id, the topic id, the answer model id.

type DailyRow = Doc<"userDaily">;
type DailyNumbers = Omit<
  DailyRow,
  "_id" | "_creationTime" | "userId" | "day" | "replies" | "topics" | "models"
>;
type DailyRecords = Pick<DailyRow, "replies" | "topics" | "models">;

export type DailyDelta = Partial<DailyNumbers> & {
  reply?: string;
  topic?: string;
  model?: string;
};

const DAILY_ZERO: DailyNumbers = {
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

// "2026-09-19" in UTC. The profile page groups by this key, and the
// browser labels it in the viewer's own time zone.
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function bumpRecord(
  record: Record<string, number>,
  key: string | undefined,
): Record<string, number> {
  if (key === undefined) return record;
  return { ...record, [key]: (record[key] ?? 0) + 1 };
}

export async function bumpDaily(
  ctx: MutationCtx,
  userId: Id<"users">,
  at: number,
  delta: DailyDelta,
): Promise<void> {
  const day = dayKey(at);
  const row = await ctx.db
    .query("userDaily")
    .withIndex("by_user_and_day", (q) => q.eq("userId", userId).eq("day", day))
    .unique();
  const base: DailyNumbers = row ? { ...row } : { ...DAILY_ZERO };
  const numbers: DailyNumbers = { ...base };
  for (const key of Object.keys(DAILY_ZERO) as Array<keyof DailyNumbers>) {
    const add = delta[key];
    if (add === undefined) continue;
    numbers[key] = base[key] + add;
  }
  const records: DailyRecords = {
    replies: bumpRecord(row?.replies ?? {}, delta.reply),
    topics: bumpRecord(row?.topics ?? {}, delta.topic),
    models: bumpRecord(row?.models ?? {}, delta.model),
  };
  if (row) {
    await ctx.db.patch(row._id, { ...numbers, ...records });
  } else {
    await ctx.db.insert("userDaily", { userId, day, ...numbers, ...records });
  }
}
