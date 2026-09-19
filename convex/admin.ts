import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/core";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { messageStatus } from "./schema";
import { adminUsername, requireAdmin } from "./lib/admin";

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
  }),
  handler: async (ctx) => {
    const configured = adminUsername() !== null;
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { signedIn: false, admin: false, username: null, configured };
    }
    const user = await ctx.db.get(userId);
    const username = user?.username ?? null;
    const admin = username !== null && username === adminUsername();
    return { signedIn: true, admin, username, configured };
  },
});

// What the admin sees per row. Real text, every status, no session ids.
const adminMessage = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  text: v.string(),
  status: messageStatus,
  judged: v.boolean(),
  hidden: v.boolean(),
  reply: v.optional(v.string()),
  topic: v.optional(v.string()),
  harm: v.optional(v.number()),
});

function toAdmin(doc: Doc<"messages">) {
  const hazards = [doc.unkind, doc.adult, doc.targetsPerson].filter(
    (n): n is number => typeof n === "number",
  );
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    text: doc.text,
    status: doc.status,
    judged: doc.judged,
    hidden: doc.hidden ?? false,
    reply: doc.reply,
    topic: doc.topic,
    harm: hazards.length > 0 ? Math.max(...hazards) : undefined,
  };
}

// Which rows the admin is looking at. `all` is every status, `hidden` is
// rows the admin pulled regardless of status.
export const adminFilter = v.union(
  v.literal("all"),
  v.literal("live"),
  v.literal("blocked"),
  v.literal("hidden"),
);

// Most hits an admin search returns. Enough to find one row.
const SEARCH_LIMIT = 30;

// Every message, newest first, narrowed by filter. Admin only.
export const list = query({
  args: { paginationOpts: paginationOptsValidator, filter: adminFilter },
  returns: v.object({
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
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Each filter is an index read so the list stays fast at a million rows.
    const { filter } = args;
    const base =
      filter === "hidden"
        ? ctx.db
            .query("messages")
            .withIndex("by_hidden", (q) => q.eq("hidden", true))
        : filter === "all"
          ? ctx.db.query("messages")
          : ctx.db
              .query("messages")
              .withIndex("by_status", (q) => q.eq("status", filter));
    const result = await base.order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toAdmin) };
  },
});

// Full text search for the admin, across every status, best match first.
// The hidden filter is applied after the search since the index only
// filters on status; thirty hits is small enough that this costs nothing.
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
          : searched;
      })
      .take(SEARCH_LIMIT);
    const kept =
      args.filter === "hidden" ? rows.filter((m) => m.hidden === true) : rows;
    return kept.map(toAdmin);
  },
});

// Hide or unhide one message. Idempotent: patching to the same value is fine.
export const setHidden = mutation({
  args: { messageId: v.id("messages"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.messageId, { hidden: args.hidden });
    return null;
  },
});
