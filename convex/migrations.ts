import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { allocateHandle, nextSequence } from "./lib/auth";
import { bumpDaily } from "./lib/usage";
import { answerMicroUsd } from "./lib/pricing";

// One time backfills, run from the CLI after the schema push:
//   npx convex run migrations:backfillVisibility
//   npx convex run migrations:backfillUsers
// Both are idempotent and page through the table in batches so a million
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
