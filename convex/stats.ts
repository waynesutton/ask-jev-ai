import { v } from "convex/values";
import { query } from "./_generated/server";
import { counters, GOAL, START_MS } from "./lib/counters";
import { costUsd, INPUT_USD_PER_MTOK, microToUsd } from "./lib/pricing";
import { jevConfigured, jevProvider } from "./lib/jev";
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

// Realtime spend. Jev tokens and model tokens come from sharded counters,
// prices from pricing.ts. projectedUsd extrapolates Jev's average per
// judged message out to the goal; model answers are metered separately
// because only signed in asks get one.
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
    // Model answers behind signed in asks.
    answers: v.number(),
    answerInputTokens: v.number(),
    answerOutputTokens: v.number(),
    answerUsd: v.number(),
    perAnswerUsd: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const [
      judged,
      inputTokens,
      outputTokens,
      answers,
      answerInputTokens,
      answerOutputTokens,
      answerMicro,
    ] = await Promise.all([
      counters.count(ctx, "judged"),
      counters.count(ctx, "inputTokens"),
      counters.count(ctx, "outputTokens"),
      counters.count(ctx, "answers"),
      counters.count(ctx, "answerInputTokens"),
      counters.count(ctx, "answerOutputTokens"),
      counters.count(ctx, "answerMicroUsd"),
    ]);
    const totalUsd = costUsd(inputTokens, outputTokens);
    const perMessageUsd = judged > 0 ? totalUsd / judged : null;
    const answerUsd = microToUsd(answerMicro);
    return {
      judged,
      inputTokens,
      outputTokens,
      totalUsd,
      perMessageUsd,
      projectedUsd: perMessageUsd === null ? null : perMessageUsd * GOAL,
      inputUsdPerMtok: INPUT_USD_PER_MTOK,
      answers,
      answerInputTokens,
      answerOutputTokens,
      answerUsd,
      perAnswerUsd: answers > 0 ? answerUsd / answers : null,
    };
  },
});

// How often people agreed with Jev. Two sharded counters, one division.
// `rate` is null until the first vote so the panel can hide the row.
export const agreement = query({
  args: {},
  returns: v.object({
    agree: v.number(),
    disagree: v.number(),
    total: v.number(),
    rate: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const [agree, disagree] = await Promise.all([
      counters.count(ctx, "voteAgree"),
      counters.count(ctx, "voteDisagree"),
    ]);
    const total = agree + disagree;
    return { agree, disagree, total, rate: total > 0 ? agree / total : null };
  },
});

// Is Jev on, and through which door? Flips the moment the env changes,
// no redeploy needed.
export const gate = query({
  args: {},
  returns: v.object({
    jev: v.boolean(),
    provider: v.union(v.literal("typesafe"), v.literal("gateway")),
  }),
  handler: async () => {
    return { jev: jevConfigured(), provider: jevProvider() };
  },
});

// Mood of the wall: mean Score over the latest judged public live messages.
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
      .withIndex("by_visibility_and_status", (q) =>
        q.eq("visibility", "public").eq("status", "live"),
      )
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
