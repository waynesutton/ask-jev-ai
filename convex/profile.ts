import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { visibility, signInProvider } from "./schema";
import {
  getOptionalUser,
  HANDLE_RE,
  isAdminUser,
  isReservedHandle,
  requireActiveUser,
  requireUser,
  userStatus,
} from "./lib/auth";
import {
  paginatedMessages,
  publicMessage,
  toPublic,
  toPublicPage,
} from "./messages";
import { hasBlockedText } from "./lib/words";
import { deleteVotesFor } from "./votes";
import { deleteSideThreadsFor, deleteSideThreadsOn } from "./answer";

// Everything a signed in person can do with their own account and asks.
// Reads use requireUser (a paused account can still look and export);
// writes use requireActiveUser.

// Field caps. Small on purpose: this is a profile card, not a bio page.
const NAME_MAX = 40;
const BIO_MAX = 160;
const LINK_MAX = 120;
// Photos: two megabytes, common image types.
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Drop an agent thread and its messages in batches, from a mutation.
async function deleteThread(ctx: MutationCtx, threadId: string) {
  await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
    threadId,
  });
}

export const profileFields = v.object({
  handle: v.string(),
  displayName: v.optional(v.string()),
  bio: v.optional(v.string()),
  github: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  x: v.optional(v.string()),
  photoUrl: v.union(v.string(), v.null()),
  publicProfile: v.boolean(),
  userNumber: v.union(v.number(), v.null()),
  joinedAt: v.number(),
});

async function toProfile(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  user: Doc<"users">,
) {
  return {
    handle: user.handle ?? "",
    displayName: user.displayName,
    bio: user.bio,
    github: user.github,
    linkedin: user.linkedin,
    x: user.x,
    photoUrl: user.photoId ? await ctx.storage.getUrl(user.photoId) : null,
    publicProfile: user.publicProfile ?? false,
    userNumber: user.userNumber ?? null,
    joinedAt: user._creationTime,
  };
}

// The signed in account, or null. Drives the header and the settings
// page. Never throws so the header can render for visitors.
export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      providers: v.array(signInProvider),
      admin: v.boolean(),
      status: v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("blocked"),
      ),
      statusReason: v.optional(v.string()),
      profile: profileFields,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.username,
      providers: user.providers ?? ["password"],
      admin: isAdminUser(user),
      status: userStatus(user),
      statusReason: user.statusReason,
      profile: await toProfile(ctx, user),
    };
  },
});

// Only the field an update names moves. An empty string clears it.
export const update = mutation({
  args: {
    handle: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    github: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    x: v.optional(v.string()),
    publicProfile: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const patch: Partial<Doc<"users">> = {};

    if (args.handle !== undefined) {
      const handle = args.handle.trim().toLowerCase();
      if (!HANDLE_RE.test(handle)) {
        throw new ConvexError(
          "Handles are 3 to 20 lowercase letters, digits, or underscores",
        );
      }
      if (hasBlockedText(handle) || isReservedHandle(handle)) {
        throw new ConvexError("That handle is not allowed");
      }
      const taken = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .unique();
      if (taken && taken._id !== user._id) {
        throw new ConvexError("That handle is taken");
      }
      patch.handle = handle;
    }
    if (args.displayName !== undefined) {
      patch.displayName = clean(args.displayName, NAME_MAX, "Name");
    }
    if (args.bio !== undefined) {
      patch.bio = clean(args.bio, BIO_MAX, "Bio");
    }
    if (args.github !== undefined) {
      patch.github = handleLink(args.github, "GitHub");
    }
    if (args.linkedin !== undefined) {
      patch.linkedin = handleLink(args.linkedin, "LinkedIn");
    }
    if (args.x !== undefined) {
      patch.x = handleLink(args.x, "X");
    }
    if (args.publicProfile !== undefined) {
      patch.publicProfile = args.publicProfile;
    }
    await ctx.db.patch(user._id, patch);
    return null;
  },
});

// Trimmed, capped, profanity free. Empty clears the field.
function clean(raw: string, max: number, label: string): string | undefined {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length === 0) return undefined;
  if (value.length > max) {
    throw new ConvexError(`${label} must be ${max} characters or fewer`);
  }
  if (hasBlockedText(value)) {
    throw new ConvexError(`${label} contains a word that is not allowed`);
  }
  return value;
}

// Social links are stored as a bare handle. Accepts "@name", "name", or a
// full URL to the site and keeps the last path segment.
function handleLink(raw: string, label: string): string | undefined {
  let value = raw.trim();
  if (value.length === 0) return undefined;
  value = value.replace(/^https?:\/\/(www\.)?[^/]+\/(in\/)?/i, "");
  value = value.replace(/^@/, "").replace(/\/+$/, "");
  if (value.length > LINK_MAX || !/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new ConvexError(`${label} should be a username, like @name`);
  }
  return value;
}

// Step one of a photo upload: a short lived URL the browser POSTs to.
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Step two: claim the stored file as the profile photo. Checks type and
// size from the storage metadata, then drops the previous photo.
export const setPhoto = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    if (args.storageId) {
      const meta = await ctx.db.system.get(args.storageId);
      if (!meta) throw new ConvexError("Upload not found");
      if (!meta.contentType || !PHOTO_TYPES.has(meta.contentType)) {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError("Use a JPEG, PNG, WebP, or GIF");
      }
      if (meta.size > PHOTO_MAX_BYTES) {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError("Photos must be 2 MB or smaller");
      }
    }
    if (user.photoId && user.photoId !== args.storageId) {
      await ctx.storage.delete(user.photoId);
    }
    await ctx.db.patch(user._id, { photoId: args.storageId ?? undefined });
    return null;
  },
});

// A public profile by handle, or null when it is private or missing. The
// owner and the admin see it either way.
export const byHandle = query({
  args: { handle: v.string() },
  returns: v.union(
    v.object({ profile: profileFields, own: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const handle = args.handle.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!user) return null;
    const viewer = await getOptionalUser(ctx);
    const own = viewer !== null && viewer._id === user._id;
    const admin = viewer !== null && isAdminUser(viewer);
    if (!own && !admin && !(user.publicProfile ?? false)) return null;
    if (userStatus(user) === "blocked" && !admin) return null;
    return { profile: await toProfile(ctx, user), own };
  },
});

// Usage for the profile page, from the daily rows. Same visibility rule as
// byHandle. The client turns the rows into streaks, the heatmap, and the
// charts, so this stays one indexed read. Newest 400 days, which covers
// the twelve month heatmap with room for the viewer's time zone.
const dailyRow = v.object({
  day: v.string(),
  asks: v.number(),
  publicAsks: v.number(),
  privateAsks: v.number(),
  live: v.number(),
  held: v.number(),
  followUps: v.number(),
  answers: v.number(),
  jevTokens: v.number(),
  jevLatencyMs: v.number(),
  answerInputTokens: v.number(),
  answerOutputTokens: v.number(),
  answerMicroUsd: v.number(),
});

export const stats = query({
  args: { handle: v.string() },
  returns: v.union(
    v.object({
      own: v.boolean(),
      days: v.array(dailyRow),
      replies: v.record(v.string(), v.number()),
      topics: v.record(v.string(), v.number()),
      models: v.record(v.string(), v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const handle = args.handle.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!user) return null;
    const viewer = await getOptionalUser(ctx);
    const own = viewer !== null && viewer._id === user._id;
    const admin = viewer !== null && isAdminUser(viewer);
    if (!own && !admin && !(user.publicProfile ?? false)) return null;
    if (userStatus(user) === "blocked" && !admin) return null;

    const rows = await ctx.db
      .query("userDaily")
      .withIndex("by_user_and_day", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(400);

    const replies: Record<string, number> = {};
    const topics: Record<string, number> = {};
    const models: Record<string, number> = {};
    const days: Array<typeof dailyRow.type> = [];
    for (const row of rows) {
      for (const [k, n] of Object.entries(row.replies)) {
        replies[k] = (replies[k] ?? 0) + n;
      }
      for (const [k, n] of Object.entries(row.topics)) {
        topics[k] = (topics[k] ?? 0) + n;
      }
      for (const [k, n] of Object.entries(row.models)) {
        models[k] = (models[k] ?? 0) + n;
      }
      days.push({
        day: row.day,
        asks: row.asks,
        publicAsks: row.publicAsks,
        // How many asks were private is the owner's business. Everyone
        // else sees the total and the wall count only.
        privateAsks: own || admin ? row.privateAsks : 0,
        live: row.live,
        held: row.held,
        followUps: row.followUps,
        answers: row.answers,
        jevTokens: row.jevTokens,
        jevLatencyMs: row.jevLatencyMs,
        answerInputTokens: row.answerInputTokens,
        answerOutputTokens: row.answerOutputTokens,
        answerMicroUsd: row.answerMicroUsd,
      });
    }
    days.reverse();
    return { own, days, replies, topics, models };
  },
});

// A user's public live asks, for their profile page. Rows the admin hid
// are left out entirely; the profile is not the place for a blurred card.
// Wall hidden rows show in full to the owner and the admin and are left
// out for everyone else, for the same reason.
export const publicAsks = query({
  args: { handle: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginatedMessages,
  handler: async (ctx, args) => {
    const handle = args.handle.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    const viewer = await getOptionalUser(ctx);
    const reveal =
      viewer !== null && (viewer._id === user._id || isAdminUser(viewer));
    // A private profile still shows its owner (and the admin) the wall list.
    if (!(user.publicProfile ?? false) && !reveal) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("messages")
      .withIndex("by_user_and_visibility", (q) =>
        q.eq("userId", user._id).eq("visibility", "public"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const page = result.page.filter(
      (m) =>
        m.status === "live" &&
        !m.hidden &&
        !(m.archived ?? false) &&
        (!m.wallHidden || reveal),
    );
    return { ...result, page: await toPublicPage(ctx, page, viewer) };
  },
});

// Which slice of your history. Archived rows only show in the archive.
export const historyFilter = v.union(
  v.literal("all"),
  v.literal("private"),
  v.literal("public"),
  v.literal("archived"),
);

// Your asks, every status, newest first. The owner sees real text even on
// rows the admin hid, since it is their own.
export const history = query({
  args: { paginationOpts: paginationOptsValidator, filter: historyFilter },
  returns: paginatedMessages,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const base =
      args.filter === "archived"
        ? ctx.db
            .query("messages")
            .withIndex("by_user_and_archived", (q) =>
              q.eq("userId", user._id).eq("archived", true),
            )
        : args.filter === "all"
          ? ctx.db
              .query("messages")
              .withIndex("by_user", (q) => q.eq("userId", user._id))
          : ctx.db
              .query("messages")
              .withIndex("by_user_and_visibility", (q) =>
                q
                  .eq("userId", user._id)
                  .eq("visibility", args.filter as "public" | "private"),
              );
    const result = await base.order("desc").paginate(args.paginationOpts);
    const page =
      args.filter === "archived"
        ? result.page
        : result.page.filter((m) => !(m.archived ?? false));
    return { ...result, page: await toPublicPage(ctx, page, user) };
  },
});

async function ownMessage(
  ctx: MutationCtx,
  user: Doc<"users">,
  messageId: Id<"messages">,
): Promise<Doc<"messages">> {
  const message = await ctx.db.get(messageId);
  if (!message || message.userId !== user._id) {
    throw new ConvexError("Ask not found");
  }
  return message;
}

// Move an ask between the wall and private. No word rule to pass: the
// `wallHidden` flag was set at post time, so an ask that carries a held
// term lands on the wall blurred for others and in full for its owner.
export const setVisibility = mutation({
  args: { messageId: v.id("messages"), visibility },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const message = await ownMessage(ctx, user, args.messageId);
    await ctx.db.patch(message._id, { visibility: args.visibility });
    return null;
  },
});

export const setArchived = mutation({
  args: { messageId: v.id("messages"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const message = await ownMessage(ctx, user, args.messageId);
    await ctx.db.patch(message._id, { archived: args.archived });
    return null;
  },
});

// Delete one ask and its thread. The counters are not decremented: the
// big number counts asks Jev answered, and Jev did answer this one.
export const remove = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const message = await ownMessage(ctx, user, args.messageId);
    if (message.threadId) {
      await deleteThread(ctx, message.threadId);
    }
    // Other people's follow up threads on this ask go with it.
    await deleteSideThreadsOn(ctx, message._id);
    await ctx.db.delete(message._id);
    return null;
  },
});

// Everything about you, as JSON the browser turns into a download. Capped
// at the newest thousand asks so the query stays inside its limits; the
// history page has the rest.
export const exportData = query({
  args: {},
  returns: v.object({
    exportedAt: v.number(),
    account: v.object({
      email: v.string(),
      profile: profileFields,
    }),
    asks: v.array(publicMessage),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1000);
    const asks: Array<typeof publicMessage.type> = [];
    for (const doc of docs) {
      // The owner's export carries the real text and the real answer even
      // if the admin hid the ask. The flags stay so the file says so.
      const row = await toPublic(ctx, doc, new Map(), user);
      asks.push({
        ...row,
        text: doc.text,
        masked: false,
        answerText: doc.answerHidden ? undefined : doc.answerText,
      });
    }
    return {
      exportedAt: Date.now(),
      account: { email: user.username, profile: await toProfile(ctx, user) },
      asks,
    };
  },
});

// Delete the account. Private asks and their threads go. Public asks stay
// on the wall without an author, so the count of a million does not lose
// rows, but nothing points back at the person. The admin account cannot
// delete itself from the UI; that is a deployment decision.
export const deleteAccount = mutation({
  args: { confirm: v.literal("delete my account") },
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (isAdminUser(user)) {
      throw new ConvexError("The admin account cannot be deleted from here");
    }
    const asks = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const ask of asks) {
      if ((ask.visibility ?? "public") === "private") {
        if (ask.threadId) {
          await deleteThread(ctx, ask.threadId);
        }
        await deleteSideThreadsOn(ctx, ask._id);
        await ctx.db.delete(ask._id);
      } else {
        await ctx.db.patch(ask._id, { userId: undefined });
      }
    }
    // Follow up threads this person opened on other people's asks.
    await deleteSideThreadsFor(ctx, user._id);
    const usage = await ctx.db
      .query("userUsage")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (usage) await ctx.db.delete(usage._id);
    const daily = await ctx.db
      .query("userDaily")
      .withIndex("by_user_and_day", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of daily) await ctx.db.delete(row._id);
    // Who voted goes; the tallies on the asks stay.
    await deleteVotesFor(ctx, user._id);
    if (user.photoId) await ctx.storage.delete(user.photoId);
    // Frees the email for a fresh sign up and ends password sign in.
    await ctx.runMutation(components.authUsername.public.deleteUsername, {
      userId: user._id,
    });
    await ctx.db.delete(user._id);
    return null;
  },
});
