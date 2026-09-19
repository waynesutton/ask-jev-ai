import { v } from "convex/values";
import { query } from "./_generated/server";
import { counters, GOAL, START_MS } from "./lib/counters";
import { costUsd, INPUT_USD_PER_MTOK } from "./lib/pricing";
import { MOOD_LABELS } from "./questions";

// The big numbers. Reactive: every accepted post re runs this.
export const counts = query({
  args: {},
  returns: v.object({
    live: v.number(),
    blocked: v.number(),
    submitted: v.number(),
    goal: v.number(),
    // Epoch ms the run began. Feeds the stopwatch and the pace estimate.
    startedAt: v.number(),
  }),
  handler: async (ctx) => {
    const [live, blocked, submitted] = await Promise.all([
      counters.count(ctx, "live"),
      counters.count(ctx, "blocked"),
      counters.count(ctx, "submitted"),
    ]);
    return { live, blocked, submitted, goal: GOAL, startedAt: START_MS };
  },
});

// Realtime Jev spend. Tokens come from sharded counters, price from pricing.ts.
// projectedUsd extrapolates the average per judged message out to the goal.
export const cost = query({
  args: {},
  returns: v.object({
    judged: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalUsd: v.number(),
    perMessageUsd: v.union(v.number(), v.null()),
    projectedUsd: v.union(v.number(), v.null()),
    inputUsdPerMtok: v.number(),
  }),
  handler: async (ctx) => {
    const [judged, inputTokens, outputTokens] = await Promise.all([
      counters.count(ctx, "judged"),
      counters.count(ctx, "inputTokens"),
      counters.count(ctx, "outputTokens"),
    ]);
    const totalUsd = costUsd(inputTokens, outputTokens);
    const perMessageUsd = judged > 0 ? totalUsd / judged : null;
    return {
      judged,
      inputTokens,
      outputTokens,
      totalUsd,
      perMessageUsd,
      projectedUsd: perMessageUsd === null ? null : perMessageUsd * GOAL,
      inputUsdPerMtok: INPUT_USD_PER_MTOK,
    };
  },
});

// Is Jev on? Flips the moment TYPESAFE_API_KEY is set, no redeploy needed.
export const gate = query({
  args: {},
  returns: v.object({ jev: v.boolean() }),
  handler: async () => {
    return { jev: Boolean(process.env.TYPESAFE_API_KEY) };
  },
});

// Mood of the wall: mean Score over the latest judged live messages.
export const mood = query({
  args: {},
  returns: v.object({
    average: v.union(v.number(), v.null()),
    label: v.union(v.string(), v.null()),
    sample: v.number(),
  }),
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .take(60);
    const moods = recent
      .map((m) => m.mood)
      .filter((n): n is number => typeof n === "number");
    if (moods.length === 0) {
      return { average: null, label: null, sample: 0 };
    }
    const average = moods.reduce((sum, n) => sum + n, 0) / moods.length;
    const index = Math.min(
      MOOD_LABELS.length - 1,
      Math.max(0, Math.round(average)),
    );
    return { average, label: MOOD_LABELS[index], sample: moods.length };
  },
});
