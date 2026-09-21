import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { answerStatus, messageStatus, visibility } from "./schema";
import { REPLIES } from "./questions";
import {
  MAX_OPEN_WORDS,
  MAX_WORDS,
  MIN_WORDS,
  parseMessage,
  parseOpenAsk,
} from "./lib/words";
import { isHeldTopic } from "./lib/heldTerms";
import { rateLimiter } from "./lib/rateLimits";
import { counters } from "./lib/counters";
import { answerMicroUsd, costUsd, microToUsd } from "./lib/pricing";
import { getOptionalUser, isAdminUser, requireActiveUser } from "./lib/auth";
import { bumpDaily, bumpUsage } from "./lib/usage";
import { laneFor } from "./answer";

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
  // Jev's second choice, for close calls and "depends, leaning yes".
  replyRunnerUp: v.optional(v.string()),
  replyRunnerUpP: v.optional(v.number()),
  unkind: v.number(),
  adult: v.number(),
  targetsPerson: v.number(),
  mood: v.number(),
  moodConfidence: v.number(),
  topic: v.string(),
  topicConfidence: v.number(),
  route: v.optional(v.string()),
  routeConfidence: v.optional(v.number()),
});

// Who posted a signed in ask. Only what the profile already shows.
export const author = v.object({
  handle: v.string(),
  displayName: v.optional(v.string()),
  photoUrl: v.union(v.string(), v.null()),
  publicProfile: v.boolean(),
});

// What the browser is allowed to see about a message. No session ids, no
// user ids. `author` is present for signed in asks.
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
  // Pulled by the admin. Every other field is untouched. The card blurs the
  // text and says "hidden by admin".
  hidden: v.boolean(),
  // A signed in ask carrying a held term or a blocklist word. Live and
  // answered, blurred on the wall for everyone but its owner and the admin.
  wallHidden: v.boolean(),
  // True when `text` is a same shaped mask for this viewer and the answer
  // has been dropped. Set by either flag above. The client blurs on this
  // and never has to work out who is looking.
  masked: v.boolean(),
  visibility: visibility,
  archived: v.boolean(),
  author: v.optional(author),
  // Which Jev answered: typesafe or gateway.
  judgeProvider: v.optional(v.string()),
  // The model answer, for signed in asks.
  route: v.optional(v.string()),
  answerModel: v.optional(v.string()),
  answerStatus: v.optional(answerStatus),
  answerText: v.optional(v.string()),
  answerHidden: v.boolean(),
  answerLatencyMs: v.optional(v.number()),
  answerCostUsd: v.optional(v.number()),
  // Whether the asker followed up in their public thread, so /a/:id has
  // more to read than the ask and its short answer.
  hasThread: v.boolean(),
  // "Was Jev right?" tallies. Zero when nobody has voted.
  agree: v.number(),
  disagree: v.number(),
});

export type PublicMessage = typeof publicMessage.type;

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
    replyRunnerUp: doc.replyRunnerUp,
    replyRunnerUpP: doc.replyRunnerUpP,
    unkind: doc.unkind,
    adult: doc.adult,
    targetsPerson: doc.targetsPerson,
    mood: doc.mood,
    moodConfidence: doc.moodConfidence,
    topic: doc.topic,
    topicConfidence: doc.topicConfidence,
    route: doc.route,
    routeConfidence: doc.routeConfidence,
  };
}

// Authors are looked up once per page, not once per card.
type AuthorCache = Map<Id<"users">, PublicMessage["author"] | undefined>;

async function authorOf(
  ctx: QueryCtx,
  userId: Id<"users"> | undefined,
  cache: AuthorCache,
): Promise<PublicMessage["author"] | undefined> {
  if (!userId) return undefined;
  if (cache.has(userId)) return cache.get(userId);
  const user = await ctx.db.get(userId);
  const value =
    user && user.handle
      ? {
          handle: user.handle,
          displayName: user.displayName,
          photoUrl: user.photoId
            ? await ctx.storage.getUrl(user.photoId)
            : null,
          publicProfile: user.publicProfile ?? false,
        }
      : undefined;
  cache.set(userId, value);
  return value;
}

// Who is reading. The owner and the admin see a wall hidden ask in full;
// everyone else gets the mask. `undefined` viewer means nobody signed in.
export type Viewer = Doc<"users"> | null | undefined;

function canReveal(doc: Doc<"messages">, viewer: Viewer): boolean {
  if (!viewer) return false;
  return doc.userId === viewer._id || isAdminUser(viewer);
}

export async function toPublic(
  ctx: QueryCtx,
  doc: Doc<"messages">,
  cache: AuthorCache = new Map(),
  viewer: Viewer = null,
): Promise<PublicMessage> {
  const hazards = [doc.unkind, doc.adult, doc.targetsPerson].filter(
    (n): n is number => typeof n === "number",
  );
  // Masked rows keep every judgment field so the card looks the same with
  // the text blurred. Only the words are masked, and the model answer is
  // dropped with them since it tends to repeat the ask. An admin hide masks
  // for everyone; a wall hide masks for everyone but the owner and admin.
  const hidden = doc.hidden === true;
  const wallHidden = doc.wallHidden === true;
  const masked = hidden || (wallHidden && !canReveal(doc, viewer));
  const answerHidden = doc.answerHidden === true;
  return {
    hidden,
    wallHidden,
    masked,
    _id: doc._id,
    _creationTime: doc._creationTime,
    text: masked ? mask(doc.text) : doc.text,
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
    visibility: doc.visibility ?? "public",
    archived: doc.archived ?? false,
    author: await authorOf(ctx, doc.userId, cache),
    judgeProvider: doc.judgeProvider,
    route: doc.route,
    answerModel: doc.answerModel,
    answerStatus: doc.answerStatus,
    answerText: answerHidden || masked ? undefined : doc.answerText,
    answerHidden,
    answerLatencyMs: doc.answerLatencyMs,
    answerCostUsd:
      doc.answerModel && typeof doc.answerInputTokens === "number"
        ? microToUsd(
            answerMicroUsd(
              doc.answerModel,
              doc.answerInputTokens,
              doc.answerOutputTokens ?? 0,
            ),
          )
        : undefined,
    hasThread:
      doc.threadId !== undefined &&
      (doc.followUps ?? 0) > 0 &&
      !answerHidden &&
      !masked,
    agree: doc.agree ?? 0,
    disagree: doc.disagree ?? 0,
  };
}

export async function toPublicPage(
  ctx: QueryCtx,
  docs: Array<Doc<"messages">>,
  viewer: Viewer = null,
): Promise<Array<PublicMessage>> {
  const cache: AuthorCache = new Map();
  const out: Array<PublicMessage> = [];
  for (const doc of docs) out.push(await toPublic(ctx, doc, cache, viewer));
  return out;
}

// Post an ask. Two paths share one mutation:
//   anonymous: wall rules (three to fifteen safe words), five a minute.
//     The blocklist and allowlist run here again so a tampered client
//     cannot skip them, and a held term stores the row as blocked.
//   signed in: wall or private, up to sixty words of anything. No word
//     list can reject it. A blocklist word or a held term flags the row
//     `wallHidden` instead, so the wall blurs it for others while the owner
//     keeps the ask, the answer, and the thread. Twenty a minute, by user.
// Jev runs after the insert, in a scheduled action, and the model answer
// runs after Jev. Jev's own hold still applies to both paths.
export const send = mutation({
  args: {
    text: v.string(),
    sessionId: v.string(),
    visibility: v.optional(visibility),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), messageId: v.id("messages") }),
    v.object({ ok: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, args) => {
    if (
      args.sessionId.length < SESSION_MIN ||
      args.sessionId.length > SESSION_MAX
    ) {
      throw new ConvexError("Invalid session");
    }

    const signedIn = await getOptionalUser(ctx);
    // Visitors post to the wall only. A private flag from a signed out
    // client is not an error, it is just ignored.
    const user = signedIn ? await requireActiveUser(ctx) : null;
    const vis = user ? (args.visibility ?? "public") : "public";

    let text: string;
    let wallHidden = false;
    if (user) {
      const parsed = parseOpenAsk(args.text);
      if (!parsed.ok) {
        throw new ConvexError(`One to ${MAX_OPEN_WORDS} words, please`);
      }
      text = parsed.text;
      wallHidden = parsed.profane || isHeldTopic(text);
    } else {
      const parsed = parseMessage(args.text);
      if (!parsed.ok) {
        throw new ConvexError(
          parsed.reason === "blocked"
            ? "That word is not allowed here"
            : parsed.reason === "count"
              ? `${MIN_WORDS} to ${MAX_WORDS} words, please`
              : "One of those words is not on the safe list",
        );
      }
      text = parsed.text;
    }

    // IP first. A script that mints a new session id per request still
    // shares one IP budget. Null IP (scheduled, admin key) skips this layer.
    const { ip } = await ctx.meta.getRequestMetadata();
    if (ip) {
      const byIp = await rateLimiter.limit(ctx, user ? "userIp" : "ip", {
        key: ip,
      });
      if (!byIp.ok) {
        return { ok: false as const, retryAfterMs: byIp.retryAfter };
      }
    }
    const limit = user
      ? await rateLimiter.limit(ctx, "userPost", { key: user._id })
      : await rateLimiter.limit(ctx, "post", { key: args.sessionId });
    if (!limit.ok) {
      return { ok: false as const, retryAfterMs: limit.retryAfter };
    }

    const owner = user
      ? { userId: user._id, visibility: vis, wallHidden }
      : { visibility: "public" as const };

    // Anonymous ask on a topic the wall does not host. Stored as blocked
    // without a judge call, so the poster sees the usual held line and the
    // wall sees nothing. Signed in asks were flagged above instead.
    if (!user && isHeldTopic(text)) {
      const messageId = await ctx.db.insert("messages", {
        text,
        sessionId: args.sessionId,
        status: "blocked",
        judged: false,
        ...owner,
      });
      await Promise.all([
        counters.inc(ctx, "submitted"),
        counters.inc(ctx, "blocked"),
      ]);
      return { ok: true as const, messageId };
    }

    const messageId = await ctx.db.insert("messages", {
      text,
      sessionId: args.sessionId,
      status: "judging",
      judged: false,
      ...owner,
    });

    await counters.inc(ctx, "submitted");
    if (user) await recordAsk(ctx, user._id, vis);
    await ctx.scheduler.runAfter(0, internal.judge.run, {
      messageId,
      text,
      attempt: 1,
    });

    return { ok: true as const, messageId };
  },
});

async function recordAsk(
  ctx: Parameters<typeof bumpUsage>[0],
  userId: Id<"users">,
  vis: "public" | "private",
) {
  const now = Date.now();
  await bumpUsage(ctx, userId, {
    asks: 1,
    publicAsks: vis === "public" ? 1 : 0,
    privateAsks: vis === "private" ? 1 : 0,
    lastAskAt: now,
  });
  await bumpDaily(ctx, userId, now, {
    asks: 1,
    publicAsks: vis === "public" ? 1 : 0,
    privateAsks: vis === "private" ? 1 : 0,
  });
}

// Let the sender retry a message the judge could not reach Jev for. The
// session id or the signed in owner proves it is theirs.
export const retry = mutation({
  args: { messageId: v.id("messages"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    const user = await getOptionalUser(ctx);
    const owns =
      message &&
      (message.sessionId === args.sessionId ||
        (user !== null && message.userId === user._id));
    if (!message || !owns) {
      throw new ConvexError("Message not found");
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
    // A hand set reply has no runner up; clear the stale pair.
    await ctx.db.patch(args.messageId, {
      reply: args.reply,
      replyConfidence: 1,
      replyRunnerUp: undefined,
      replyRunnerUpP: undefined,
    });
    return null;
  },
});

export const paginatedMessages = v.object({
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
});

// The wall. Public and live, newest first, paginated. Wall hidden asks
// come back masked unless the viewer owns them or is the admin, so the
// same query serves every tab and the owner still sees their own words.
export const wall = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginatedMessages,
  handler: async (ctx, args) => {
    const viewer = await getOptionalUser(ctx);
    const result = await ctx.db
      .query("messages")
      .withIndex("by_visibility_and_status", (q) =>
        q.eq("visibility", "public").eq("status", "live"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: await toPublicPage(ctx, result.page, viewer) };
  },
});

// Search the wall. Full text over public live asks, best match first, up
// to 24. Masked rows are dropped rather than blurred: a blurred card that
// matched your word would leak what is under the blur.
export const search = query({
  args: { q: v.string() },
  returns: v.array(publicMessage),
  handler: async (ctx, args) => {
    const q = args.q.trim();
    if (q.length === 0) return [];
    const viewer = await getOptionalUser(ctx);
    const rows = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (s) =>
        s.search("text", q).eq("status", "live").eq("visibility", "public"),
      )
      .take(24);
    return await toPublicPage(
      ctx,
      rows.filter((m) => !m.hidden && (!m.wallHidden || canReveal(m, viewer))),
      viewer,
    );
  },
});

// Where this viewer's follow ups go. `own` is the ask owner's thread,
// `side` is a private thread of their own on someone else's ask. Null
// means no follow ups for this viewer: signed out, paused, or the ask is
// held, hidden, or not theirs to read.
export const followUpLane = v.object({
  kind: v.union(v.literal("own"), v.literal("side")),
  threadId: v.optional(v.string()),
  model: v.string(),
});

// One ask, for /a/:id. Public live asks are open to anyone. Private asks,
// held asks, and anything still judging belong to the owner and the admin.
export const get = query({
  args: { messageId: v.id("messages") },
  returns: v.union(
    v.object({
      ...publicMessage.fields,
      // The owner's thread to read on the ask page. Only present when the
      // viewer may read it; answer.listMessages checks again on its side.
      threadId: v.optional(v.string()),
      // Whether this viewer may ask follow ups, and where they land.
      followUp: v.union(followUpLane, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.messageId);
    if (!doc) return null;
    const user = await getOptionalUser(ctx);
    const owner = user !== null && doc.userId === user._id;
    const admin = user !== null && isAdminUser(user);
    const open =
      (doc.visibility ?? "public") === "public" && doc.status === "live";
    if (!owner && !admin && !open) return null;
    const row = await toPublic(ctx, doc, new Map(), user);
    return {
      ...row,
      threadId: row.hasThread || owner || admin ? doc.threadId : undefined,
      followUp: await laneFor(ctx, doc, user),
    };
  },
});

// The sender's own recent posts, every status. This is where the
// judging -> live flip is visible. Private asks from a signed in session
// are only returned to that signed in owner, so a shared device that
// signed out does not keep showing them.
export const mine = query({
  args: { sessionId: v.string() },
  returns: v.array(publicMessage),
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(8);
    const visible = docs.filter(
      (m) => m.userId === undefined || (user !== null && m.userId === user._id),
    );
    return await toPublicPage(ctx, visible.slice(0, 6), user);
  },
});
