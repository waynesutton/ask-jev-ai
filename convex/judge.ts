import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { systemOne } from "./lib/typesafe";
import { counters } from "./lib/counters";
import { BLOCK_THRESHOLD, MAX_JUDGE_ATTEMPTS, QUESTIONS } from "./questions";

// One TypeSafe request per message. Six questions, evaluated in parallel,
// about 100 ms. Runs in the default Convex runtime via fetch.
export const run = internalAction({
  args: {
    messageId: v.id("messages"),
    text: v.string(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.TYPESAFE_API_KEY;

    // No key yet: publish on the allowlist alone and say so in the UI.
    if (!apiKey) {
      await ctx.runMutation(internal.judge.record, {
        messageId: args.messageId,
        verdict: { kind: "unjudged" },
      });
      return null;
    }

    const started = Date.now();
    try {
      const response = await systemOne({
        apiKey,
        state: { message: args.text },
        questions: QUESTIONS,
      });
      const a = response.answers;
      await ctx.runMutation(internal.judge.record, {
        messageId: args.messageId,
        verdict: {
          kind: "judged",
          reply: a.reply.choice,
          replyConfidence: a.reply.confidence,
          unkind: a.is_unkind.noul,
          adult: a.is_adult.noul,
          targetsPerson: a.targets_person.noul,
          mood: a.mood.score,
          moodConfidence: a.mood.confidence,
          topic: a.topic.choice,
          topicConfidence: a.topic.confidence,
          latencyMs: Date.now() - started,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      });
    } catch (error) {
      console.error("Judge failed", {
        messageId: args.messageId,
        attempt: args.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (args.attempt < MAX_JUDGE_ATTEMPTS) {
        // 500ms, 1s, 2s
        await ctx.scheduler.runAfter(
          500 * 2 ** (args.attempt - 1),
          internal.judge.run,
          {
            ...args,
            attempt: args.attempt + 1,
          },
        );
      } else {
        await ctx.runMutation(internal.judge.record, {
          messageId: args.messageId,
          verdict: { kind: "failed" },
        });
      }
    }
    return null;
  },
});

const verdict = v.union(
  v.object({
    kind: v.literal("judged"),
    reply: v.string(),
    replyConfidence: v.number(),
    unkind: v.number(),
    adult: v.number(),
    targetsPerson: v.number(),
    mood: v.number(),
    moodConfidence: v.number(),
    topic: v.string(),
    topicConfidence: v.number(),
    latencyMs: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }),
  v.object({ kind: v.literal("unjudged") }),
  v.object({ kind: v.literal("failed") }),
);

// Policy lives here, in code. Raw probabilities are stored so the threshold
// can move later without asking Jev again.
export const record = internalMutation({
  args: { messageId: v.id("messages"), verdict },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.status !== "judging") {
      return null; // already decided, keep this idempotent
    }

    const { verdict: result } = args;

    if (result.kind === "failed") {
      await ctx.db.patch(args.messageId, { status: "failed" });
      return null;
    }

    if (result.kind === "unjudged") {
      await ctx.db.patch(args.messageId, { status: "live", judged: false });
      await counters.inc(ctx, "live");
      return null;
    }

    const harm = Math.max(result.unkind, result.adult, result.targetsPerson);
    const status = harm >= BLOCK_THRESHOLD ? "blocked" : "live";

    await ctx.db.patch(args.messageId, {
      status,
      judged: true,
      reply: result.reply,
      replyConfidence: result.replyConfidence,
      unkind: result.unkind,
      adult: result.adult,
      targetsPerson: result.targetsPerson,
      mood: result.mood,
      moodConfidence: result.moodConfidence,
      topic: result.topic,
      topicConfidence: result.topicConfidence,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    // Independent shards, so these run in parallel without conflicting.
    await Promise.all([
      counters.inc(ctx, status),
      counters.inc(ctx, "judged"),
      counters.add(ctx, "inputTokens", result.inputTokens),
      counters.add(ctx, "outputTokens", result.outputTokens),
    ]);
    return null;
  },
});
