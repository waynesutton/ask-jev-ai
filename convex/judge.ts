import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askJev, jevConfigured, JevUnavailableError } from "./lib/jev";
import { counters } from "./lib/counters";
import { bumpDaily, bumpUsage } from "./lib/usage";
import {
  BLOCK_THRESHOLD,
  isRoute,
  MAX_JUDGE_ATTEMPTS,
  QUESTIONS,
} from "./questions";

// One Jev request per message. Seven questions, evaluated in parallel,
// about 100 ms. The seventh picks which model would answer the ask, so a
// signed in ask leaves this call already routed. Runs in the default
// Convex runtime via fetch, through lib/jev.ts which chooses the door:
// the Convex AI Gateway Decisions endpoint by default, TypeSafe direct
// as the fallback or when pinned.
export const run = internalAction({
  args: {
    messageId: v.id("messages"),
    text: v.string(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // No key yet: publish on the allowlist alone and say so in the UI.
    if (!jevConfigured()) {
      await ctx.runMutation(internal.judge.record, {
        messageId: args.messageId,
        verdict: { kind: "unjudged" },
      });
      return null;
    }

    try {
      const response = await askJev({
        state: { message: args.text },
        questions: QUESTIONS,
      });
      const a = response.answers;
      const runnerUp = secondChoice(a.reply.choice, a.reply.probabilities);
      await ctx.runMutation(internal.judge.record, {
        messageId: args.messageId,
        verdict: {
          kind: "judged",
          reply: a.reply.choice,
          replyConfidence: a.reply.confidence,
          replyRunnerUp: runnerUp?.choice,
          replyRunnerUpP: runnerUp?.p,
          unkind: a.is_unkind.noul,
          adult: a.is_adult.noul,
          targetsPerson: a.targets_person.noul,
          mood: a.mood.score,
          moodConfidence: a.mood.confidence,
          topic: a.topic.choice,
          topicConfidence: a.topic.confidence,
          route: a.route.choice,
          routeConfidence: a.route.confidence,
          provider: response.provider,
          latencyMs: response.latencyMs,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      });
    } catch (error) {
      // No door opens for this deployment (gateway off, no key). Same
      // outcome as no key at all: publish on the allowlist, say so once,
      // and do not retry, since a retry cannot change the env.
      if (error instanceof JevUnavailableError) {
        console.warn(error.message);
        await ctx.runMutation(internal.judge.record, {
          messageId: args.messageId,
          verdict: { kind: "unjudged" },
        });
        return null;
      }
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

// The Choice answer carries a probability for every option. The runner up
// is the best option Jev did not pick, which is what makes a 52% verdict
// readable: yes 52%, no 41%. Undefined when the map has one entry.
function secondChoice(
  choice: string,
  probabilities: Record<string, number>,
): { choice: string; p: number } | undefined {
  let best: { choice: string; p: number } | undefined;
  for (const [option, p] of Object.entries(probabilities)) {
    if (option === choice || typeof p !== "number") continue;
    if (!best || p > best.p) best = { choice: option, p };
  }
  return best;
}

const verdict = v.union(
  v.object({
    kind: v.literal("judged"),
    reply: v.string(),
    replyConfidence: v.number(),
    replyRunnerUp: v.optional(v.string()),
    replyRunnerUpP: v.optional(v.number()),
    unkind: v.number(),
    adult: v.number(),
    targetsPerson: v.number(),
    mood: v.number(),
    moodConfidence: v.number(),
    topic: v.string(),
    topicConfidence: v.number(),
    route: v.string(),
    routeConfidence: v.number(),
    provider: v.union(v.literal("typesafe"), v.literal("gateway")),
    latencyMs: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }),
  v.object({ kind: v.literal("unjudged") }),
  v.object({ kind: v.literal("failed") }),
);

// Policy lives here, in code. Raw probabilities are stored so the threshold
// can move later without asking Jev again. A signed in ask that survives
// the wall check gets its model answer scheduled from here, so the answer
// starts the moment Jev is done and never before.
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
      await ctx.db.patch(args.messageId, {
        status: "failed",
        ...(message.userId ? { answerStatus: "skipped" as const } : {}),
      });
      return null;
    }

    if (result.kind === "unjudged") {
      await ctx.db.patch(args.messageId, { status: "live", judged: false });
      await counters.inc(ctx, "live");
      // Jev is off but the gateway may still be on. Answer with the
      // default route so signed in asks are not left hanging.
      if (message.userId) {
        await bumpDaily(ctx, message.userId, message._creationTime, {
          live: 1,
        });
        await scheduleAnswer(ctx, message.userId, args.messageId, message.text);
      }
      return null;
    }

    const harm = Math.max(result.unkind, result.adult, result.targetsPerson);
    const status = harm >= BLOCK_THRESHOLD ? "blocked" : "live";
    const route = isRoute(result.route) ? result.route : undefined;

    await ctx.db.patch(args.messageId, {
      status,
      judged: true,
      reply: result.reply,
      replyConfidence: result.replyConfidence,
      replyRunnerUp: result.replyRunnerUp,
      replyRunnerUpP: result.replyRunnerUpP,
      unkind: result.unkind,
      adult: result.adult,
      targetsPerson: result.targetsPerson,
      mood: result.mood,
      moodConfidence: result.moodConfidence,
      topic: result.topic,
      topicConfidence: result.topicConfidence,
      route,
      routeConfidence: result.routeConfidence,
      judgeProvider: result.provider,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ...(message.userId && status === "blocked"
        ? { answerStatus: "skipped" as const }
        : {}),
    });

    // Independent shards, so these run in parallel without conflicting.
    await Promise.all([
      counters.inc(ctx, status),
      counters.inc(ctx, "judged"),
      counters.add(ctx, "inputTokens", result.inputTokens),
      counters.add(ctx, "outputTokens", result.outputTokens),
    ]);

    if (message.userId) {
      await bumpUsage(ctx, message.userId, {
        jevInputTokens: result.inputTokens,
        jevOutputTokens: result.outputTokens,
      });
      // Filed under the day the ask was posted, not the day Jev answered,
      // so a retry hours later does not split one ask across two days.
      await bumpDaily(ctx, message.userId, message._creationTime, {
        live: status === "live" ? 1 : 0,
        held: status === "blocked" ? 1 : 0,
        jevTokens: result.inputTokens,
        jevLatencyMs: result.latencyMs,
        reply: result.reply,
        topic: result.topic,
      });
      if (status === "live") {
        await scheduleAnswer(ctx, message.userId, args.messageId, message.text);
      }
    }
    return null;
  },
});

// Kick off the model answer. The row shows "answering" right away so the
// card has something to say before the first token lands.
async function scheduleAnswer(
  ctx: MutationCtx,
  userId: Id<"users">,
  messageId: Id<"messages">,
  text: string,
): Promise<void> {
  await ctx.db.patch(messageId, { answerStatus: "pending" });
  await ctx.scheduler.runAfter(0, internal.answer.run, {
    messageId,
    userId,
    text,
    attempt: 1,
  });
}
