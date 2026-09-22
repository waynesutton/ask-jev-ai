import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { allocateHandle, nextSequence } from "./lib/auth";
import { bumpDaily } from "./lib/usage";
import { answerMicroUsd } from "./lib/pricing";
import { askJev } from "./lib/jev";
import { counters } from "./lib/counters";
import { QUESTIONS, REPLIES } from "./questions";

// One time backfills, run from the CLI after the schema push:
//   npx convex run migrations:backfillVisibility
//   npx convex run migrations:backfillUsers
//   npx convex run migrations:backfillReply '{"dryRun":true}'
// All are idempotent and page through the table in batches so a million
// rows never has to fit in one transaction.

const BATCH = 500;

// Rows from before accounts existed have no visibility. They were all on
// the wall, so they become public, which is what the wall index reads.
export const backfillVisibility = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("messages")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH });
    for (const row of page.page) {
      if (row.visibility === undefined) {
        await ctx.db.patch(row._id, { visibility: "public" });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillVisibility, {
        cursor: page.continueCursor,
      });
    } else {
      console.log("backfillVisibility done");
    }
    return null;
  },
});

// Rebuild userDaily from the asks that exist. Run once after the table
// ships:
//   npx convex run migrations:backfillDaily '{}'
// The first call with no cursor clears the table so the run is idempotent,
// then pages through messages and files each signed in ask under the day
// it was posted. Follow ups are not messages and are not rebuilt.
export const backfillDaily = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.cursor === undefined) {
      const existing = await ctx.db.query("userDaily").take(BATCH);
      for (const row of existing) await ctx.db.delete(row._id);
      if (existing.length === BATCH) {
        // More to clear. Come back with no cursor again.
        await ctx.scheduler.runAfter(0, internal.migrations.backfillDaily, {});
        return null;
      }
    }
    const page = await ctx.db
      .query("messages")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH });
    for (const m of page.page) {
      if (!m.userId) continue;
      const vis = m.visibility ?? "public";
      await bumpDaily(ctx, m.userId, m._creationTime, {
        asks: 1,
        publicAsks: vis === "public" ? 1 : 0,
        privateAsks: vis === "private" ? 1 : 0,
        live: m.status === "live" ? 1 : 0,
        held: m.status === "blocked" ? 1 : 0,
        jevTokens: m.inputTokens ?? 0,
        jevLatencyMs: m.latencyMs ?? 0,
        reply: m.reply,
        topic: m.topic,
        ...(m.answerStatus === "done" && m.answerModel
          ? {
              answers: 1,
              answerInputTokens: m.answerInputTokens ?? 0,
              answerOutputTokens: m.answerOutputTokens ?? 0,
              answerMicroUsd: answerMicroUsd(
                m.answerModel,
                m.answerInputTokens ?? 0,
                m.answerOutputTokens ?? 0,
              ),
              model: m.answerModel,
            }
          : {}),
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillDaily, {
        cursor: page.continueCursor,
      });
    } else {
      console.log("backfillDaily done");
    }
    return null;
  },
});

// Fill Jev's `reply` on live rows judged before the question existed
// (2026-09-17 05:52 UTC). Without it a card can show neither the verdict
// chip nor the open question line. Run from the CLI:
//
//   npx convex run migrations:backfillReply '{"dryRun":true}'
//     Pages every live row and logs how many lack a reply. No Jev calls.
//   npx convex run migrations:backfillReply '{"limit":200}'
//     Re judges up to 200 rows with the one `reply` Choice, about
//     $0.00003 each, then stops and logs the cursor to continue from.
//   npx convex run migrations:backfillReply '{"limit":200,"cursor":"..."}'
//     Picks up where the last run stopped.
//
// Each page is one action; the next page is scheduled, so a long table
// never runs into the action time limit. Tokens land on the global
// counters so the spend panel stays honest. The row's own token fields are
// left alone so its per card cost does not change.
const REPLY_KEYS = Object.keys(REPLIES) as Array<keyof typeof REPLIES>;

const replyRow = v.object({ _id: v.id("messages"), text: v.string() });

// One page of live rows that were judged but carry no reply.
export const pageLiveWithoutReply = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    rows: v.array(replyRow),
    scanned: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .paginate({ cursor: args.cursor, numItems: BATCH });
    const rows = page.page
      .filter((m) => m.judged && m.reply === undefined)
      .map((m) => ({ _id: m._id, text: m.text }));
    return {
      rows,
      scanned: page.page.length,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

// Write one backfilled reply. Skips rows that gained a reply or vanished
// since the page was read, so a rerun never overwrites a real verdict.
export const setReply = internalMutation({
  args: {
    messageId: v.id("messages"),
    reply: v.union(...REPLY_KEYS.map((r) => v.literal(r))),
    replyConfidence: v.number(),
    replyRunnerUp: v.optional(v.string()),
    replyRunnerUpP: v.optional(v.number()),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.reply !== undefined) return false;
    await ctx.db.patch(args.messageId, {
      reply: args.reply,
      replyConfidence: args.replyConfidence,
      replyRunnerUp: args.replyRunnerUp,
      replyRunnerUpP: args.replyRunnerUpP,
    });
    await Promise.all([
      counters.add(ctx, "inputTokens", args.inputTokens),
      counters.add(ctx, "outputTokens", args.outputTokens),
    ]);
    return true;
  },
});

const REPLY_ONLY = { reply: QUESTIONS.reply } as const;

export const backfillReply = internalAction({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    // Count only. Pages the whole table and calls Jev for nothing.
    dryRun: v.optional(v.boolean()),
    // Most rows to re judge across this run and the pages it schedules.
    limit: v.optional(v.number()),
    // Running totals, carried page to page. Not for the CLI.
    scanned: v.optional(v.number()),
    missing: v.optional(v.number()),
    fixed: v.optional(v.number()),
    failed: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const limit = args.limit ?? 100;
    let scanned = args.scanned ?? 0;
    let missing = args.missing ?? 0;
    let fixed = args.fixed ?? 0;
    let failed = args.failed ?? 0;

    const page = await ctx.runQuery(internal.migrations.pageLiveWithoutReply, {
      cursor: args.cursor ?? null,
    });
    scanned += page.scanned;
    missing += page.rows.length;

    // Rows on this page the limit kept us from reaching. A resume from
    // this page's cursor sees only these, since the fixed ones now carry
    // a reply and drop out of the filter.
    let left = dryRun ? 0 : page.rows.length;
    if (!dryRun) {
      for (const row of page.rows) {
        if (fixed + failed >= limit) break;
        left--;
        try {
          const response = await askJev({
            state: { message: row.text },
            questions: REPLY_ONLY,
          });
          const a = response.answers.reply;
          const reply = REPLY_KEYS.find((k) => k === a.choice);
          if (!reply) throw new Error(`Unknown reply ${a.choice}`);
          const runnerUp = secondChoice(a.choice, a.probabilities);
          const wrote = await ctx.runMutation(internal.migrations.setReply, {
            messageId: row._id,
            reply,
            replyConfidence: a.confidence,
            replyRunnerUp: runnerUp?.choice,
            replyRunnerUpP: runnerUp?.p,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          });
          if (wrote) fixed++;
        } catch (error) {
          failed++;
          console.error("backfillReply row failed", {
            messageId: row._id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const totals = { scanned, missing, fixed, failed };
    const hitLimit = !dryRun && fixed + failed >= limit;
    if (hitLimit && (left > 0 || !page.isDone)) {
      console.log("backfillReply stopped at limit", {
        ...totals,
        resume: {
          cursor: left > 0 ? (args.cursor ?? null) : page.continueCursor,
          limit,
        },
      });
      return null;
    }
    if (page.isDone) {
      console.log(
        dryRun ? "backfillReply dry run done" : "backfillReply done",
        totals,
      );
      return null;
    }
    // Running totals ride along, so `limit` caps the whole run and the
    // final log line covers every page.
    await ctx.scheduler.runAfter(0, internal.migrations.backfillReply, {
      cursor: page.continueCursor,
      dryRun,
      limit,
      ...totals,
    });
    return null;
  },
});

// Same as judge.ts: the best option Jev did not pick, so a 52% verdict
// reads with its 41% runner up.
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

// Accounts created before profiles existed (the admin) get a user number
// and a handle. The admin is number one; the sequence continues from there.
export const backfillUsers = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").order("asc").take(BATCH);
    let touched = 0;
    for (const user of users) {
      const patch: { userNumber?: number; handle?: string; status?: "active" } =
        {};
      if (user.userNumber === undefined) {
        patch.userNumber = await nextSequence(ctx, "users");
      }
      if (user.handle === undefined) {
        patch.handle = await allocateHandle(ctx, user.username, user._id);
      }
      if (user.status === undefined) {
        patch.status = "active";
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(user._id, patch);
        touched++;
      }
    }
    return touched;
  },
});
