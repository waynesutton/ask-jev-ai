import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { messageStatus } from "./schema";
import { REPLIES } from "./questions";
import { MAX_WORDS, MIN_WORDS, parseMessage } from "./lib/words";
import { isHeldTopic } from "./lib/heldTerms";
import { rateLimiter } from "./lib/rateLimits";
import { counters } from "./lib/counters";
import { costUsd } from "./lib/pricing";

// Session id bounds. The client mints a UUID (36 chars). The floor keeps a
// tampered client from picking a short id that someone else could guess
// and read through `mine`.
const SESSION_MIN = 32;
const SESSION_MAX = 64;

const REPLY_KEYS = Object.keys(REPLIES) as Array<keyof typeof REPLIES>;

// Jev's raw answers, present once the message has been judged. This is
// what the "show answers" toggle on each card reveals. `reply` is optional
// because rows judged before the question existed do not have one.
export const jevAnswers = v.object({
  reply: v.optional(v.string()),
  replyConfidence: v.optional(v.number()),
  unkind: v.number(),
  adult: v.number(),
  targetsPerson: v.number(),
  mood: v.number(),
  moodConfidence: v.number(),
  topic: v.string(),
  topicConfidence: v.number(),
});

// What the browser is allowed to see about a message. No session ids.
export const publicMessage = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  text: v.string(),
  status: messageStatus,
  judged: v.boolean(),
  reply: v.optional(v.string()),
  mood: v.optional(v.number()),
  topic: v.optional(v.string()),
  harm: v.optional(v.number()),
  latencyMs: v.optional(v.number()),
  inputTokens: v.optional(v.number()),
  // USD this one judgment cost, derived from tokens and the list price.
  costUsd: v.optional(v.number()),
  answers: v.optional(jevAnswers),
  // Pulled by the admin. When true, text is a same shaped mask; every other
  // field is untouched. The card blurs the text and says "hidden by admin".
  hidden: v.boolean(),
});

// Replace every letter with a bullet so the card keeps its word shape for
// the blur without the real words ever leaving the server.
function mask(text: string): string {
  return text
    .split(" ")
    .map((word) => "•".repeat(word.length))
    .join(" ");
}

function toAnswers(doc: Doc<"messages">) {
  if (
    typeof doc.unkind !== "number" ||
    typeof doc.adult !== "number" ||
    typeof doc.targetsPerson !== "number" ||
    typeof doc.mood !== "number" ||
    typeof doc.moodConfidence !== "number" ||
    typeof doc.topic !== "string" ||
    typeof doc.topicConfidence !== "number"
  ) {
    return undefined;
  }
  return {
    reply: doc.reply,
    replyConfidence: doc.replyConfidence,
    unkind: doc.unkind,
    adult: doc.adult,
    targetsPerson: doc.targetsPerson,
    mood: doc.mood,
    moodConfidence: doc.moodConfidence,
    topic: doc.topic,
    topicConfidence: doc.topicConfidence,
  };
}

function toPublic(doc: Doc<"messages">) {
  const hazards = [doc.unkind, doc.adult, doc.targetsPerson].filter(
    (n): n is number => typeof n === "number",
  );
  // Hidden rows keep every judgment field so the card looks the same with
  // the text blurred. Only the words are masked.
  const hidden = doc.hidden === true;
  return {
    hidden,
    _id: doc._id,
    _creationTime: doc._creationTime,
    text: hidden ? mask(doc.text) : doc.text,
    status: doc.status,
    judged: doc.judged,
    reply: doc.reply,
    mood: doc.mood,
    topic: doc.topic,
    harm: hazards.length > 0 ? Math.max(...hazards) : undefined,
    latencyMs: doc.latencyMs,
    inputTokens: doc.inputTokens,
    costUsd:
      typeof doc.inputTokens === "number"
        ? costUsd(doc.inputTokens, doc.outputTokens ?? 0)
        : undefined,
    answers: toAnswers(doc),
  };
}

// Post an ask. The blocklist and allowlist run here again so a tampered
// client cannot skip them. Jev runs after the insert, in a scheduled action.
export const send = mutation({
  args: { text: v.string(), sessionId: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), messageId: v.id("messages") }),
    v.object({ ok: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, args) => {
    const parsed = parseMessage(args.text);
    if (!parsed.ok) {
      throw new Error(
        parsed.reason === "blocked"
          ? "That word is not allowed here"
          : parsed.reason === "count"
            ? `${MIN_WORDS} to ${MAX_WORDS} words, please`
            : "One of those words is not on the safe list",
      );
    }
    if (
      args.sessionId.length < SESSION_MIN ||
      args.sessionId.length > SESSION_MAX
    ) {
      throw new Error("Invalid session");
    }

    // IP first. A script that mints a new session id per request still
    // shares one IP budget. Null IP (scheduled, admin key) skips this layer.
    const { ip } = await ctx.meta.getRequestMetadata();
    if (ip) {
      const byIp = await rateLimiter.limit(ctx, "ip", { key: ip });
      if (!byIp.ok) {
        return { ok: false as const, retryAfterMs: byIp.retryAfter };
      }
    }

    const limit = await rateLimiter.limit(ctx, "post", { key: args.sessionId });
    if (!limit.ok) {
      return { ok: false as const, retryAfterMs: limit.retryAfter };
    }

    // Topics the wall does not host. Stored as blocked without a judge
    // call, so the poster sees the usual held line and the wall sees nothing.
    if (isHeldTopic(parsed.text)) {
      const messageId = await ctx.db.insert("messages", {
        text: parsed.text,
        sessionId: args.sessionId,
        status: "blocked",
        judged: false,
      });
      await Promise.all([
        counters.inc(ctx, "submitted"),
        counters.inc(ctx, "blocked"),
      ]);
      return { ok: true as const, messageId };
    }

    const messageId = await ctx.db.insert("messages", {
      text: parsed.text,
      sessionId: args.sessionId,
      status: "judging",
      judged: false,
    });

    await counters.inc(ctx, "submitted");
    await ctx.scheduler.runAfter(0, internal.judge.run, {
      messageId,
      text: parsed.text,
      attempt: 1,
    });

    return { ok: true as const, messageId };
  },
});

// Let the sender retry a message the judge could not reach TypeSafe for.
export const retry = mutation({
  args: { messageId: v.id("messages"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.sessionId !== args.sessionId) {
      throw new Error("Message not found");
    }
    if (message.status !== "failed") {
      return null;
    }
    await ctx.db.patch(args.messageId, { status: "judging" });
    await ctx.scheduler.runAfter(0, internal.judge.run, {
      messageId: args.messageId,
      text: message.text,
      attempt: 1,
    });
    return null;
  },
});

// Operator only, run from the CLI: correct Jev's reply on one live row.
// For asks Jev misread, like questions about itself before the prompt
// carried any self knowledge. Leaves every other answer untouched.
export const overrideReply = internalMutation({
  args: {
    messageId: v.id("messages"),
    reply: v.union(...REPLY_KEYS.map((r) => v.literal(r))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      reply: args.reply,
      replyConfidence: 1,
    });
    return null;
  },
});

// The wall. Only live messages, newest first, paginated.
export const wall = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(publicMessage),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toPublic) };
  },
});

// Search the wall. Full text over live asks, best match first, up to 24.
// Rows the admin hid are dropped rather than masked: a blurred card that
// matched your word would leak what is under the blur.
export const search = query({
  args: { q: v.string() },
  returns: v.array(publicMessage),
  handler: async (ctx, args) => {
    const q = args.q.trim();
    if (q.length === 0) return [];
    const rows = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (s) =>
        s.search("text", q).eq("status", "live"),
      )
      .take(24);
    return rows.filter((m) => !m.hidden).map(toPublic);
  },
});

// The sender's own recent posts, every status. This is where the
// judging -> live flip is visible.
export const mine = query({
  args: { sessionId: v.string() },
  returns: v.array(publicMessage),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(6);
    return docs.map(toPublic);
  },
});
