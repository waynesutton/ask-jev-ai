import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { rateLimiter } from "./lib/rateLimits";
import { counters } from "./lib/counters";
import { getOptionalUser } from "./lib/auth";

// "Was Jev right?" One tap per ask, agree or disagree. Votes never change
// a verdict; they measure it. The first real calibration signal against
// replyConfidence and BLOCK_THRESHOLD, which until now were tuned by eye.
//
// Identity: an account votes as `u:<userId>`, a browser as `s:<sessionId>`.
// The tallies sit on the message row so cards need no join; this table
// only decides whether a tap is new, a flip, or a take back.

const SESSION_MIN = 32;
const SESSION_MAX = 64;

// Only verdicts with a right and wrong take a vote. "open" and
// "statement" asks have nothing to agree with.
const VOTABLE = new Set(["yes", "no", "depends"]);

export function voterKeyFor(
  user: Doc<"users"> | null,
  sessionId: string,
): string {
  return user ? `u:${user._id}` : `s:${sessionId}`;
}

function checkSession(sessionId: string) {
  if (sessionId.length < SESSION_MIN || sessionId.length > SESSION_MAX) {
    throw new ConvexError("Invalid session");
  }
}

// Tap agree or disagree. Same vote again takes it back; the other vote
// flips it. Returns the rate limit wait instead of throwing so the button
// can say "slow down" in place.
export const cast = mutation({
  args: {
    messageId: v.id("messages"),
    sessionId: v.string(),
    agree: v.boolean(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, args) => {
    checkSession(args.sessionId);
    const user = await getOptionalUser(ctx);
    if (user && user.status !== "active") {
      throw new ConvexError("Your account is paused");
    }

    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.status !== "live" ||
      !message.judged ||
      message.hidden === true ||
      !message.reply ||
      !VOTABLE.has(message.reply)
    ) {
      throw new ConvexError("This ask does not take votes");
    }

    // IP, then the voter. Same two layers as posting.
    const { ip } = await ctx.meta.getRequestMetadata();
    if (ip) {
      const byIp = await rateLimiter.limit(ctx, user ? "userIp" : "ip", {
        key: ip,
      });
      if (!byIp.ok) {
        return { ok: false as const, retryAfterMs: byIp.retryAfter };
      }
    }
    const voterKey = voterKeyFor(user, args.sessionId);
    const limit = await rateLimiter.limit(ctx, "vote", { key: voterKey });
    if (!limit.ok) {
      return { ok: false as const, retryAfterMs: limit.retryAfter };
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_message_and_voter", (q) =>
        q.eq("messageId", args.messageId).eq("voterKey", voterKey),
      )
      .unique();

    // Deltas to the two tallies. Each branch touches at most one of each.
    let dAgree = 0;
    let dDisagree = 0;
    if (!existing) {
      await ctx.db.insert("votes", {
        messageId: args.messageId,
        voterKey,
        userId: user?._id,
        agree: args.agree,
      });
      if (args.agree) dAgree = 1;
      else dDisagree = 1;
    } else if (existing.agree === args.agree) {
      // Take it back.
      await ctx.db.delete(existing._id);
      if (args.agree) dAgree = -1;
      else dDisagree = -1;
    } else {
      // Flip.
      await ctx.db.patch(existing._id, { agree: args.agree });
      dAgree = args.agree ? 1 : -1;
      dDisagree = args.agree ? -1 : 1;
    }

    await ctx.db.patch(args.messageId, {
      agree: Math.max(0, (message.agree ?? 0) + dAgree),
      disagree: Math.max(0, (message.disagree ?? 0) + dDisagree),
    });
    const bumps: Array<Promise<void>> = [];
    if (dAgree !== 0) bumps.push(counters.add(ctx, "voteAgree", dAgree));
    if (dDisagree !== 0) {
      bumps.push(counters.add(ctx, "voteDisagree", dDisagree));
    }
    await Promise.all(bumps);
    return { ok: true as const };
  },
});

// Every vote this viewer has cast, newest first, so the buttons can show
// which side is pressed. One subscription per page; every card that calls
// the hook with the same session id shares it.
export const mine = query({
  args: { sessionId: v.string() },
  returns: v.array(
    v.object({ messageId: v.id("messages"), agree: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    checkSession(args.sessionId);
    const user = await getOptionalUser(ctx);
    const voterKey = voterKeyFor(user, args.sessionId);
    const rows = await ctx.db
      .query("votes")
      .withIndex("by_voter", (q) => q.eq("voterKey", voterKey))
      .order("desc")
      .take(500);
    return rows.map((r) => ({ messageId: r.messageId, agree: r.agree }));
  },
});

// Remove every vote an account cast. Called from deleteAccount. The
// tallies on the messages stay; the account is gone, the count was real.
export async function deleteVotesFor(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const rows = await ctx.db
    .query("votes")
    .withIndex("by_voter", (q) => q.eq("voterKey", `u:${userId}`))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}
