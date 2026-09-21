import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// One row per submitted message. Status moves judging -> live | blocked | failed.
export const messageStatus = v.union(
  v.literal("judging"),
  v.literal("live"),
  v.literal("blocked"),
  v.literal("failed"),
);

// Who can see an ask. Public rows are the wall. Private rows only ever
// reach their owner (and the admin list, for moderation).
export const visibility = v.union(v.literal("public"), v.literal("private"));

// Where the model answer for a signed in ask is. `skipped` covers held asks
// and anonymous posts, which never get one.
export const answerStatus = v.union(
  v.literal("pending"),
  v.literal("streaming"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("skipped"),
);

// Optional on legacy accounts, which keep password sign in.
export const signInProvider = v.union(
  v.literal("password"),
  v.literal("google"),
  v.literal("github"),
);

// Account standing, set by the admin. Missing means active.
export const userStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("blocked"),
);

export default defineSchema({
  // Convex Auth creates one row per account. Every field after `username`
  // is optional so the admin row created before accounts opened validates
  // untouched; `migrations.backfillUsers` fills the number and handle.
  users: defineTable({
    // The email the account signed up with.
    username: v.string(),
    // Legacy rows predate OAuth and use password sign in.
    providers: v.optional(v.array(signInProvider)),
    // Public slug for /u/:handle. Lowercase letters, digits, underscore.
    handle: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    github: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    x: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    // Whether /u/:handle is visible to anyone. Off by default.
    publicProfile: v.optional(v.boolean()),
    // "User number 10". Allocated from the sequences table at sign up.
    userNumber: v.optional(v.number()),
    status: v.optional(userStatus),
    statusReason: v.optional(v.string()),
    moderatedAt: v.optional(v.number()),
  })
    .index("by_username", ["username"])
    .index("by_handle", ["handle"])
    .index("by_userNumber", ["userNumber"])
    .index("by_status", ["status"]),

  // Monotonic counters that need an exact value, unlike the sharded ones.
  // One row per key. Mutations serialize, so a single doc is safe at sign
  // up volume.
  sequences: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  // Per user usage, one row per user, kept off the users doc because it
  // changes on every ask and every answer.
  userUsage: defineTable({
    userId: v.id("users"),
    asks: v.number(),
    publicAsks: v.number(),
    privateAsks: v.number(),
    answers: v.number(),
    answerInputTokens: v.number(),
    answerOutputTokens: v.number(),
    // Integer micro dollars so sums stay exact.
    answerMicroUsd: v.number(),
    jevInputTokens: v.number(),
    jevOutputTokens: v.number(),
    lastAskAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Per user, per UTC day. Feeds the profile page: the heatmap, streaks,
  // the reply split, models used, tokens over time. Written next to the
  // usage row on every ask, verdict, and answer, so a profile is one
  // indexed read of at most a year of small rows, never a scan of asks.
  // Record fields are keyed by the id in code (reply, topic, model id).
  userDaily: defineTable({
    userId: v.id("users"),
    // "2026-09-19", UTC.
    day: v.string(),
    asks: v.number(),
    publicAsks: v.number(),
    privateAsks: v.number(),
    live: v.number(),
    held: v.number(),
    followUps: v.number(),
    answers: v.number(),
    jevTokens: v.number(),
    // Sum of Jev latency, so the page can show the average.
    jevLatencyMs: v.number(),
    answerInputTokens: v.number(),
    answerOutputTokens: v.number(),
    answerMicroUsd: v.number(),
    replies: v.record(v.string(), v.number()),
    topics: v.record(v.string(), v.number()),
    models: v.record(v.string(), v.number()),
  }).index("by_user_and_day", ["userId", "day"]),

  // Emails the admin blocked. Checked at sign up so a blocked account
  // cannot delete itself and come back.
  blockedEmails: defineTable({
    email: v.string(),
    reason: v.optional(v.string()),
    blockedAt: v.number(),
  }).index("by_email", ["email"]),

  messages: defineTable({
    // Normalized words joined by single spaces. Three to fifteen on the
    // wall, up to sixty for a private ask.
    text: v.string(),
    // Anonymous browser session that posted it. Signed in posts keep it
    // too, so the "Yours" strip works before and after sign in.
    sessionId: v.string(),
    status: messageStatus,
    // True when Jev evaluated it. False when the key was missing.
    judged: v.boolean(),
    // Jev's answer to the ask: yes, no, depends, open, statement.
    reply: v.optional(v.string()),
    replyConfidence: v.optional(v.number()),
    // Jev's second choice and its probability, read from the same Choice
    // answer at no extra cost. Explains a shaky verdict: yes 52%, no 41%.
    replyRunnerUp: v.optional(v.string()),
    replyRunnerUpP: v.optional(v.number()),
    // "Was Jev right?" tallies, kept on the row so a card needs no join.
    // The votes table holds who voted so one voter counts once.
    agree: v.optional(v.number()),
    disagree: v.optional(v.number()),
    // How many follow ups the asker sent in their own thread. Zero or
    // missing means the thread holds only the ask and its short answer,
    // so the wall has nothing extra to point at.
    followUps: v.optional(v.number()),
    // Raw judgments, kept so thresholds can change without re inference.
    unkind: v.optional(v.number()),
    adult: v.optional(v.number()),
    targetsPerson: v.optional(v.number()),
    mood: v.optional(v.number()),
    moodConfidence: v.optional(v.number()),
    topic: v.optional(v.string()),
    topicConfidence: v.optional(v.number()),
    // Milliseconds Jev took to answer.
    latencyMs: v.optional(v.number()),
    // Token usage reported by TypeSafe. Cost is derived in code from pricing.ts.
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    // Set by the admin. The card stays on the wall, blurred, text masked.
    hidden: v.optional(v.boolean()),
    // True when the hide came from blocking the author, so a restore can
    // undo it without touching hides the admin placed by hand.
    hiddenByBlock: v.optional(v.boolean()),
    // Signed in ask that carries a held term or a blocklist word. It stays
    // live and gets its answer; the wall shows it blurred to everyone but
    // the owner and the admin. Set once at post time, whatever the
    // visibility, so a later move to the wall needs no second look.
    wallHidden: v.optional(v.boolean()),

    // Accounts. Missing userId means an anonymous post. Missing visibility
    // means a row from before accounts existed; the backfill sets public.
    userId: v.optional(v.id("users")),
    visibility: v.optional(visibility),
    // Agent thread holding the model answer and any follow ups.
    threadId: v.optional(v.string()),
    // Which model route Jev picked and how sure it was.
    route: v.optional(v.string()),
    routeConfidence: v.optional(v.number()),
    // Which Jev provider answered: typesafe or gateway.
    judgeProvider: v.optional(v.string()),
    // The model answer, mirrored here so the wall card and export do not
    // need the thread.
    answerModel: v.optional(v.string()),
    answerStatus: v.optional(answerStatus),
    answerText: v.optional(v.string()),
    // Admin pulled the answer. The ask stays.
    answerHidden: v.optional(v.boolean()),
    answerInputTokens: v.optional(v.number()),
    answerOutputTokens: v.optional(v.number()),
    answerLatencyMs: v.optional(v.number()),
    // Owner tucked it away in their history.
    archived: v.optional(v.boolean()),
  })
    .index("by_status", ["status"])
    .index("by_session", ["sessionId"])
    // Admin filter: only rows the admin hid.
    .index("by_hidden", ["hidden"])
    // The wall: public and live, newest first.
    .index("by_visibility_and_status", ["visibility", "status"])
    .index("by_user", ["userId"])
    .index("by_user_and_archived", ["userId", "archived"])
    .index("by_user_and_visibility", ["userId", "visibility"])
    // Full text search over the ask, scoped by status and visibility.
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["status", "visibility"],
    }),

  // One row per voter per ask for "Was Jev right?". `voterKey` is
  // `u:<userId>` for an account and `s:<sessionId>` for a browser, so a
  // sign in later does not let one person count twice. The tallies live on
  // the message; this table only decides whether a vote is new, a flip, or
  // a take back.
  votes: defineTable({
    messageId: v.id("messages"),
    voterKey: v.string(),
    userId: v.optional(v.id("users")),
    agree: v.boolean(),
  })
    .index("by_message_and_voter", ["messageId", "voterKey"])
    .index("by_voter", ["voterKey"]),

  // A side thread: one signed in person's follow ups on an ask they do not
  // own (an anonymous ask, or someone else's). The ask owner's own thread
  // lives on `messages.threadId`; this table covers everyone else. One row
  // per ask per user, private to that user and the admin, never on the wall.
  // `model` is fixed at creation from the route Jev gave the ask.
  threads: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    // Agent component thread id.
    threadId: v.string(),
    // Convex AI Gateway model id that answers in this thread.
    model: v.string(),
    // Follow ups sent so far, and when the last one landed.
    count: v.number(),
    lastAt: v.number(),
  })
    .index("by_message_and_user", ["messageId", "userId"])
    .index("by_message", ["messageId"])
    .index("by_threadId", ["threadId"])
    .index("by_user", ["userId"]),
});
