import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// One row per submitted message. Status moves judging -> live | blocked | failed.
export const messageStatus = v.union(
  v.literal("judging"),
  v.literal("live"),
  v.literal("blocked"),
  v.literal("failed"),
);

export default defineSchema({
  // Convex Auth creates one row per account. Sign up is gated to the admin
  // username, so in practice this table holds one row.
  users: defineTable({
    username: v.string(),
  }).index("by_username", ["username"]),

  messages: defineTable({
    // Normalized words (three to fifteen) joined by single spaces.
    text: v.string(),
    // Anonymous browser session that posted it.
    sessionId: v.string(),
    status: messageStatus,
    // True when Jev evaluated it. False when the key was missing.
    judged: v.boolean(),
    // Jev's answer to the ask: yes, no, depends, open, statement.
    reply: v.optional(v.string()),
    replyConfidence: v.optional(v.number()),
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
  })
    .index("by_status", ["status"])
    .index("by_session", ["sessionId"])
    // Admin filter: only rows the admin hid.
    .index("by_hidden", ["hidden"])
    // Full text search over the ask, scoped to live rows for the wall search.
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["status"],
    }),
});
