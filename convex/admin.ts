import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/core";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { messageStatus, userStatus as userStatusValidator } from "./schema";
import { adminUsername, requireAdmin, signupOpen } from "./lib/admin";
import { userStatus } from "./lib/auth";
import { microToUsd } from "./lib/pricing";

// Who is calling. Cheap enough to run on every /admin render. Does not
// throw so the page can show "sign in" vs "not authorized" without a catch.
export const me = query({
  args: {},
  returns: v.object({
    signedIn: v.boolean(),
    admin: v.boolean(),
    username: v.union(v.string(), v.null()),
    // Whether ADMIN_USERNAME is set at all. Drives the sign up hint.
    configured: v.boolean(),
    // Whether ADMIN_SIGNUP_OPEN=1. Shows or hides the create account link.
    signupOpen: v.boolean(),
  }),
  handler: async (ctx) => {
    const configured = adminUsername() !== null;
    const open = signupOpen();
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        signedIn: false,
        admin: false,
        username: null,
        configured,
        signupOpen: open,
      };
    }
    const user = await ctx.db.get(userId);
    const username = user?.username ?? null;
    const admin = username !== null && username === adminUsername();
    return { signedIn: true, admin, username, configured, signupOpen: open };
  },
});

// What the admin sees per row. Real text, every status, no session ids.
// Signed in rows carry the author's email and handle so moderation can
// reach the account from the message.
const adminMessage = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  text: v.string(),
  status: messageStatus,
  judged: v.boolean(),
  hidden: v.boolean(),
  // Signed in ask with a held term or blocklist word. The admin sees the
  // words; the wall blurs them for everyone else.
  wallHidden: v.boolean(),
  reply: v.optional(v.string()),
  topic: v.optional(v.string()),
  harm: v.optional(v.number()),
  visibility: v.union(v.literal("public"), v.literal("private")),
  userId: v.optional(v.id("users")),
  email: v.optional(v.string()),
  handle: v.optional(v.string()),
  route: v.optional(v.string()),
  answerModel: v.optional(v.string()),
  answerStatus: v.optional(v.string()),
  answerText: v.optional(v.string()),
  answerHidden: v.boolean(),
});

type AuthorCache = Map<Id<"users">, Doc<"users"> | null>;

async function toAdmin(
  ctx: QueryCtx,
  doc: Doc<"messages">,
  cache: AuthorCache,
) {
  const hazards = [doc.unkind, doc.adult, doc.targetsPerson].filter(
    (n): n is number => typeof n === "number",
  );
  let author: Doc<"users"> | null = null;
  if (doc.userId) {
    if (!cache.has(doc.userId))
      cache.set(doc.userId, await ctx.db.get(doc.userId));
    author = cache.get(doc.userId) ?? null;
  }
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    text: doc.text,
    status: doc.status,
    judged: doc.judged,
    hidden: doc.hidden ?? false,
    wallHidden: doc.wallHidden ?? false,
    reply: doc.reply,
    topic: doc.topic,
    harm: hazards.length > 0 ? Math.max(...hazards) : undefined,
    visibility: doc.visibility ?? ("public" as const),
    userId: doc.userId,
    email: author?.username,
    handle: author?.handle,
    route: doc.route,
    answerModel: doc.answerModel,
    answerStatus: doc.answerStatus,
    answerText: doc.answerText,
    answerHidden: doc.answerHidden ?? false,
  };
}

async function toAdminPage(ctx: QueryCtx, docs: Array<Doc<"messages">>) {
  const cache: AuthorCache = new Map();
  const out = [];
  for (const doc of docs) out.push(await toAdmin(ctx, doc, cache));
  return out;
}

// Which rows the admin is looking at. `all` is every status, `hidden` is
// rows the admin pulled regardless of status, `private` is signed in asks
// that never reached the wall.
export const adminFilter = v.union(
  v.literal("all"),
  v.literal("live"),
  v.literal("blocked"),
  v.literal("hidden"),
  v.literal("private"),
);

// Most hits an admin search returns. Enough to find one row.
const SEARCH_LIMIT = 30;

const paginated = v.object({
  page: v.array(adminMessage),
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

// Every message, newest first, narrowed by filter. Admin only.
export const list = query({
  args: { paginationOpts: paginationOptsValidator, filter: adminFilter },
  returns: paginated,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Each filter is an index read so the list stays fast at a million rows.
    const { filter } = args;
    const base =
      filter === "hidden"
        ? ctx.db
            .query("messages")
            .withIndex("by_hidden", (q) => q.eq("hidden", true))
        : filter === "private"
          ? ctx.db
              .query("messages")
              .withIndex("by_visibility_and_status", (q) =>
                q.eq("visibility", "private"),
              )
          : filter === "all"
            ? ctx.db.query("messages")
            : ctx.db
                .query("messages")
                .withIndex("by_status", (q) => q.eq("status", filter));
    const result = await base.order("desc").paginate(args.paginationOpts);
    return { ...result, page: await toAdminPage(ctx, result.page) };
  },
});

// Full text search for the admin, across every status, best match first.
// Hidden and private filters apply after the search; thirty hits is small
// enough that this costs nothing.
export const search = query({
  args: { q: v.string(), filter: adminFilter },
  returns: v.array(adminMessage),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const q = args.q.trim();
    if (q.length === 0) return [];
    const rows = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (s) => {
        const searched = s.search("text", q);
        return args.filter === "live" || args.filter === "blocked"
          ? searched.eq("status", args.filter)
          : args.filter === "private"
            ? searched.eq("visibility", "private")
            : searched;
      })
      .take(SEARCH_LIMIT);
    const kept =
      args.filter === "hidden" ? rows.filter((m) => m.hidden === true) : rows;
    return await toAdminPage(ctx, kept);
  },
});

// Hide or unhide one message. Idempotent: patching to the same value is fine.
export const setHidden = mutation({
  args: { messageId: v.id("messages"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.messageId, {
      hidden: args.hidden,
      hiddenByBlock: false,
    });
    return null;
  },
});

// Pull or restore a model answer. The ask stays; only the answer goes.
export const setAnswerHidden = mutation({
  args: { messageId: v.id("messages"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.messageId, { answerHidden: args.hidden });
    return null;
  },
});

// Accounts

const adminUser = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  email: v.string(),
  handle: v.optional(v.string()),
  displayName: v.optional(v.string()),
  userNumber: v.optional(v.number()),
  status: userStatusValidator,
  statusReason: v.optional(v.string()),
  moderatedAt: v.optional(v.number()),
  admin: v.boolean(),
  publicProfile: v.boolean(),
  usage: v.object({
    asks: v.number(),
    publicAsks: v.number(),
    privateAsks: v.number(),
    answers: v.number(),
    answerInputTokens: v.number(),
    answerOutputTokens: v.number(),
    answerUsd: v.number(),
    jevInputTokens: v.number(),
    lastAskAt: v.union(v.number(), v.null()),
  }),
});

async function toAdminUser(ctx: QueryCtx, user: Doc<"users">) {
  const usage = await ctx.db
    .query("userUsage")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    email: user.username,
    handle: user.handle,
    displayName: user.displayName,
    userNumber: user.userNumber,
    status: userStatus(user),
    statusReason: user.statusReason,
    moderatedAt: user.moderatedAt,
    admin: user.username === adminUsername(),
    publicProfile: user.publicProfile ?? false,
    usage: {
      asks: usage?.asks ?? 0,
      publicAsks: usage?.publicAsks ?? 0,
      privateAsks: usage?.privateAsks ?? 0,
      answers: usage?.answers ?? 0,
      answerInputTokens: usage?.answerInputTokens ?? 0,
      answerOutputTokens: usage?.answerOutputTokens ?? 0,
      answerUsd: microToUsd(usage?.answerMicroUsd ?? 0),
      jevInputTokens: usage?.jevInputTokens ?? 0,
      lastAskAt: usage?.lastAskAt ?? null,
    },
  };
}

export const userFilter = v.union(
  v.literal("all"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("blocked"),
);

// Every account, newest first, with usage. Admin only.
export const users = query({
  args: { paginationOpts: paginationOptsValidator, filter: userFilter },
  returns: v.object({
    page: v.array(adminUser),
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
    await requireAdmin(ctx);
    // "active" also has to catch rows with no status at all, which the
    // by_status index cannot, so it scans and filters in code.
    const { filter } = args;
    const base =
      filter === "paused" || filter === "blocked"
        ? ctx.db
            .query("users")
            .withIndex("by_status", (q) => q.eq("status", filter))
        : ctx.db.query("users");
    const result = await base.order("desc").paginate(args.paginationOpts);
    const page =
      args.filter === "active"
        ? result.page.filter((u) => userStatus(u) === "active")
        : result.page;
    const out = [];
    for (const user of page) out.push(await toAdminUser(ctx, user));
    return { ...result, page: out };
  },
});

// Totals for the Users tab header. Exact, from the sequences row and the
// status index; small enough to count in a query.
export const userTotals = query({
  args: {},
  returns: v.object({
    accounts: v.number(),
    paused: v.number(),
    blocked: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const seq = await ctx.db
      .query("sequences")
      .withIndex("by_key", (q) => q.eq("key", "users"))
      .unique();
    const paused = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "paused"))
      .collect();
    const blocked = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .collect();
    return {
      accounts: seq?.value ?? 0,
      paused: paused.length,
      blocked: blocked.length,
    };
  },
});

// Find accounts by email or handle prefix. Small result, no index needed
// beyond the two exact lookups; the list is the browse path.
export const findUsers = query({
  args: { q: v.string() },
  returns: v.array(adminUser),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const q = args.q.trim().toLowerCase();
    if (q.length === 0) return [];
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_username", (idx) =>
        idx.gte("username", q).lt("username", q + "\uffff"),
      )
      .take(20);
    const byHandle = await ctx.db
      .query("users")
      .withIndex("by_handle", (idx) =>
        idx.gte("handle", q).lt("handle", q + "\uffff"),
      )
      .take(20);
    const seen = new Set<string>();
    const out = [];
    for (const user of [...byEmail, ...byHandle]) {
      if (seen.has(user._id)) continue;
      seen.add(user._id);
      out.push(await toAdminUser(ctx, user));
    }
    return out;
  },
});

// One account with its latest asks, for the drawer.
export const userDetail = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({ user: adminUser, recent: v.array(adminMessage) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
    return {
      user: await toAdminUser(ctx, user),
      recent: await toAdminPage(ctx, docs),
    };
  },
});

// Pause, block, or restore an account.
//   paused: can sign in, read, and export; cannot post or edit.
//   blocked: every app call refuses the session; public asks are hidden;
//            the email cannot sign up again.
//   active: restore. Hides placed by the block are lifted; hides the
//           admin placed by hand stay.
export const setUserStatus = mutation({
  args: {
    userId: v.id("users"),
    status: userStatusValidator,
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id) {
      throw new ConvexError("You cannot change your own standing");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");
    const reason = args.reason?.trim() || undefined;
    const previous = userStatus(user);

    await ctx.db.patch(user._id, {
      status: args.status,
      statusReason: args.status === "active" ? undefined : reason,
      moderatedAt: Date.now(),
    });

    if (args.status === "blocked") {
      await blockEmail(ctx, user.username, reason);
      await setBlockHides(ctx, user._id, true);
    } else if (previous === "blocked") {
      await unblockEmail(ctx, user.username);
      await setBlockHides(ctx, user._id, false);
    }
    return null;
  },
});

async function blockEmail(ctx: MutationCtx, email: string, reason?: string) {
  const existing = await ctx.db
    .query("blockedEmails")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { reason, blockedAt: Date.now() });
  } else {
    await ctx.db.insert("blockedEmails", {
      email,
      reason,
      blockedAt: Date.now(),
    });
  }
}

async function unblockEmail(ctx: MutationCtx, email: string) {
  const existing = await ctx.db
    .query("blockedEmails")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}

// Hide (or unhide) every public ask from a blocked account, flagged so a
// restore only lifts the hides the block placed.
async function setBlockHides(
  ctx: MutationCtx,
  userId: Id<"users">,
  hide: boolean,
) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_user_and_visibility", (q) =>
      q.eq("userId", userId).eq("visibility", "public"),
    )
    .collect();
  for (const row of rows) {
    if (hide && !row.hidden) {
      await ctx.db.patch(row._id, { hidden: true, hiddenByBlock: true });
    } else if (!hide && row.hiddenByBlock) {
      await ctx.db.patch(row._id, { hidden: false, hiddenByBlock: false });
    }
  }
}
