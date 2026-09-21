import { ShardedCounter } from "@convex-dev/sharded-counter";
import { components } from "../_generated/api";

// Counter keys. "live" is the big number on the page.
// "judged", "inputTokens", "outputTokens" feed the realtime Jev cost row.
// The "answer*" keys meter the model answers behind signed in asks.
export type CounterKey =
  | "live"
  | "blocked"
  | "submitted"
  | "judged"
  | "inputTokens"
  | "outputTokens"
  | "answers"
  | "answerInputTokens"
  | "answerOutputTokens"
  // Integer micro dollars. Divided once, in the query, never per row.
  | "answerMicroUsd"
  // "Was Jev right?" votes across every ask. Feeds the agreement rate.
  | "voteAgree"
  | "voteDisagree";

// 32 shards keeps a million writes spread out. Reads happen in queries only.
export const counters = new ShardedCounter<CounterKey>(
  components.shardedCounter,
  {
    defaultShards: 32,
  },
);

export const GOAL = 1_000_000;

// When the run to one million began: 12:31 AM PDT, Sep 17, 2026.
// Stored as UTC so every clock on every device agrees.
export const START_MS = Date.UTC(2026, 8, 17, 7, 31, 0);
