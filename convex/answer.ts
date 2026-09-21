import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  Agent,
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getOptionalUser,
  isAdminUser,
  requireActiveUser,
  userStatus,
} from "./lib/auth";
import { counters } from "./lib/counters";
import { answerMicroUsd } from "./lib/pricing";
import { rateLimiter } from "./lib/rateLimits";
import { bumpDaily, bumpUsage } from "./lib/usage";
import { MAX_OPEN_WORDS, parseOpenAsk } from "./lib/words";
import { isRoute, ROUTES, type Route } from "./questions";

// The model answer behind a signed in ask. Jev picks the route in its own
// call; this file turns the route into a Convex AI Gateway model, streams
// the reply into an agent thread, and mirrors the finished text onto the
// message row so the wall card and the export never need the thread.

// When Jev did not answer (offline, or an unknown route), this is the model.
const DEFAULT_ROUTE: Route = "explain";

// Short by design. Jev's answer is one chip; the model's is a paragraph.
const INSTRUCTIONS = [
  "You answer short questions for a public wall called Ask Jev.",
  "Reply in one to three short sentences, plain text, no markdown, no lists, no headings.",
  "Answer directly. Do not restate the question. Do not say you are an AI.",
  "If the question cannot be answered, say what you would need in one sentence.",
].join(" ");

const MAX_ANSWER_ATTEMPTS = 3;

// How often the streamed text is mirrored to the message row while it
// arrives. The thread has every delta; the row only needs a readable pace.
const MIRROR_EVERY_MS = 350;

// One agent per model, built on first use. The gateway provider takes no
// key: getServiceToken mints a deployment token inside the action.
const agents = new Map<string, Agent>();

function agentFor(model: string): Agent {
  const existing = agents.get(model);
  if (existing) return existing;
  const agent = new Agent(components.agent, {
    name: "Jev answers",
    languageModel: convexGateway(model),
    instructions: INSTRUCTIONS,
    // Follow ups see the last few turns only. No search, no embeddings.
    contextOptions: { recentMessages: 12 },
    callSettings: { maxOutputTokens: 240, temperature: 0.4 },
    usageHandler: async (ctx, { userId, usage, model: used }) => {
      await ctx.runMutation(internal.answer.recordUsage, {
        userId: userId ?? null,
        model: used,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      });
    },
  });
  agents.set(model, agent);
  return agent;
}

function modelFor(route: string | undefined): { route: Route; model: string } {
  const key = route && isRoute(route) ? route : DEFAULT_ROUTE;
  return { route: key, model: ROUTES[key].model };
}

// What the action needs to know about the row before it starts.
export const context = internalQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(
    v.object({
      status: v.string(),
      answerStatus: v.optional(v.string()),
      route: v.optional(v.string()),
      threadId: v.optional(v.string()),
      userId: v.optional(v.id("users")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.messageId);
    if (!m) return null;
    return {
      status: m.status,
      answerStatus: m.answerStatus,
      route: m.route,
      threadId: m.threadId,
      userId: m.userId,
    };
  },
});

// Patch the row as the answer moves. Every call is idempotent.
export const patch = internalMutation({
  args: {
    messageId: v.id("messages"),
    threadId: v.optional(v.string()),
    answerModel: v.optional(v.string()),
    answerStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("streaming"),
        v.literal("done"),
        v.literal("failed"),
      ),
    ),
    answerText: v.optional(v.string()),
    answerInputTokens: v.optional(v.number()),
    answerOutputTokens: v.optional(v.number()),
    answerLatencyMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, ...fields }) => {
    const m = await ctx.db.get(messageId);
    if (!m) return null;
    const clean = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(messageId, clean);
    return null;
  },
});

// Meter one model call: global counters for the cost box, per user usage
// for the admin. Called from the agent's usageHandler.
export const recordUsage = internalMutation({
  args: {
    userId: v.union(v.string(), v.null()),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const micro = answerMicroUsd(
      args.model,
      args.inputTokens,
      args.outputTokens,
    );
    await Promise.all([
      counters.inc(ctx, "answers"),
      counters.add(ctx, "answerInputTokens", args.inputTokens),
      counters.add(ctx, "answerOutputTokens", args.outputTokens),
      counters.add(ctx, "answerMicroUsd", micro),
    ]);
    if (args.userId) {
      const user = await ctx.db.get(args.userId as Doc<"users">["_id"]);
      if (user) {
        await bumpUsage(ctx, user._id, {
          answers: 1,
          answerInputTokens: args.inputTokens,
          answerOutputTokens: args.outputTokens,
          answerMicroUsd: micro,
        });
        await bumpDaily(ctx, user._id, Date.now(), {
          answers: 1,
          answerInputTokens: args.inputTokens,
          answerOutputTokens: args.outputTokens,
          answerMicroUsd: micro,
          model: args.model,
        });
      }
    }
    return null;
  },
});

// The first answer for a fresh ask. Creates the thread, streams the reply,
// mirrors it to the row. Retries with backoff on gateway errors.
export const run = internalAction({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    text: v.string(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.answer.context, {
      messageId: args.messageId,
    });
    if (!row || row.status !== "live" || row.answerStatus === "done") {
      return null;
    }
    const { model } = modelFor(row.route);
    const agent = agentFor(model);
    const started = Date.now();

    try {
      let threadId = row.threadId;
      if (!threadId) {
        const created = await agent.createThread(ctx, {
          userId: args.userId,
          title: args.text,
        });
        threadId = created.threadId;
        await ctx.runMutation(internal.answer.patch, {
          messageId: args.messageId,
          threadId,
        });
      }
      await ctx.runMutation(internal.answer.patch, {
        messageId: args.messageId,
        answerModel: model,
        answerStatus: "streaming",
      });

      const text = await streamInto(ctx, agent, {
        threadId,
        userId: args.userId,
        prompt: args.text,
        messageId: args.messageId,
      });

      await ctx.runMutation(internal.answer.patch, {
        messageId: args.messageId,
        answerStatus: "done",
        answerText: text.text,
        answerInputTokens: text.inputTokens,
        answerOutputTokens: text.outputTokens,
        answerLatencyMs: Date.now() - started,
      });
    } catch (error) {
      console.error("Answer failed", {
        messageId: args.messageId,
        model,
        attempt: args.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (args.attempt < MAX_ANSWER_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          1000 * 2 ** (args.attempt - 1),
          internal.answer.run,
          { ...args, attempt: args.attempt + 1 },
        );
      } else {
        await ctx.runMutation(internal.answer.patch, {
          messageId: args.messageId,
          answerStatus: "failed",
        });
      }
    }
    return null;
  },
});

// A follow up inside an existing thread. The user message was saved by
// the mutation that scheduled this, so the stream continues from it.
// `system` is set for side threads: the thread did not start with the ask
// and the model answer, so the ask and Jev's verdict ride along here.
export const reply = internalAction({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    threadId: v.string(),
    promptMessageId: v.string(),
    model: v.string(),
    system: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agent = agentFor(args.model);
    try {
      const result = await agent.streamText(
        ctx,
        { threadId: args.threadId, userId: args.userId },
        {
          promptMessageId: args.promptMessageId,
          ...(args.system ? { system: args.system } : {}),
        },
        { saveStreamDeltas: true },
      );
      await result.consumeStream();
    } catch (error) {
      console.error("Follow up failed", {
        messageId: args.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});

// Stream one reply into the thread and mirror the text onto the row as it
// arrives, at a readable cadence.
async function streamInto(
  ctx: ActionCtx,
  agent: Agent,
  args: {
    threadId: string;
    userId: string;
    prompt: string;
    messageId: Doc<"messages">["_id"];
  },
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const result = await agent.streamText(
    ctx,
    { threadId: args.threadId, userId: args.userId },
    { prompt: args.prompt },
    { saveStreamDeltas: true },
  );
  let text = "";
  let lastMirror = 0;
  for await (const delta of result.textStream) {
    text += delta;
    const now = Date.now();
    if (now - lastMirror >= MIRROR_EVERY_MS) {
      lastMirror = now;
      await ctx.runMutation(internal.answer.patch, {
        messageId: args.messageId,
        answerText: text,
      });
    }
  }
  const usage = await result.usage;
  return {
    text: text.trim(),
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  };
}

// Two kinds of thread hang off an ask.
//
//   own: the ask owner's thread on `messages.threadId`, opened by the model
//        answer. Readable by anyone when the ask is public, owner writes.
//   side: one signed in person's follow ups on an ask they do not own, in
//        the `threads` table. Private to them and the admin.
//
// Which one a viewer writes to is decided once, here, and returned by
// messages.get so the page and the mutation agree.
export type FollowUpLane = {
  kind: "own" | "side";
  // Missing for a side lane nobody has written to yet.
  threadId?: string;
  model: string;
};

// Can this ask take follow ups from anyone at all? Live, and not pulled
// by the admin. Held asks and failed judgments never open a thread.
function acceptsFollowUps(message: Doc<"messages">): boolean {
  return message.status === "live" && message.hidden !== true;
}

export async function sideThreadFor(
  ctx: QueryCtx | MutationCtx,
  messageId: Id<"messages">,
  userId: Id<"users">,
): Promise<Doc<"threads"> | null> {
  return await ctx.db
    .query("threads")
    .withIndex("by_message_and_user", (q) =>
      q.eq("messageId", messageId).eq("userId", userId),
    )
    .unique();
}

// Where this viewer's follow ups go, or null when they cannot follow up:
// a visitor, a paused or blocked account, a held or hidden ask, or a
// private ask that is not theirs.
export async function laneFor(
  ctx: QueryCtx | MutationCtx,
  message: Doc<"messages">,
  user: Doc<"users"> | null,
): Promise<FollowUpLane | null> {
  if (!user || !acceptsFollowUps(message)) return null;
  if (userStatus(user) !== "active") return null;
  const owner = message.userId === user._id;
  if (owner) {
    if (!message.threadId) return null;
    return {
      kind: "own",
      threadId: message.threadId,
      model: message.answerModel ?? modelFor(message.route).model,
    };
  }
  // Side lanes only open on public asks. A private ask that is not yours
  // is not readable, so it cannot be followed up either.
  if ((message.visibility ?? "public") !== "public") return null;
  const side = await sideThreadFor(ctx, message._id, user._id);
  return {
    kind: "side",
    threadId: side?.threadId,
    model: side?.model ?? modelFor(message.route).model,
  };
}

// The system prompt for a side thread turn. The thread did not begin with
// the ask, so the model gets it here along with Jev's verdict and the
// public answer when there is one. Short: the follow up is the prompt.
function sideSystem(message: Doc<"messages">): string {
  const parts: Array<string> = [INSTRUCTIONS];
  parts.push(`Someone on the wall asked: "${message.text}"`);
  if (message.reply) {
    const pct =
      typeof message.replyConfidence === "number"
        ? ` (${Math.round(message.replyConfidence * 100)}% sure)`
        : "";
    parts.push(`Jev, the judge, said: ${message.reply}${pct}.`);
  }
  if (message.answerText && message.answerHidden !== true) {
    parts.push(`A model already answered: "${message.answerText}"`);
  }
  parts.push(
    "The person you are talking to is not the asker. They are following up on that ask. Answer their follow up in light of it.",
  );
  return parts.join(" ");
}

// Who may read a thread. Own thread: the owner, the admin, or anyone when
// the ask is public and live. Side thread: its owner or the admin.
async function readAccess(
  ctx: QueryCtx,
  message: Doc<"messages">,
  threadId: string,
): Promise<boolean> {
  const user = await getOptionalUser(ctx);
  const admin = user !== null && isAdminUser(user);
  if (message.threadId === threadId) {
    if (user && message.userId === user._id) return true;
    if (admin) return true;
    return (
      (message.visibility ?? "public") === "public" &&
      message.status === "live" &&
      message.hidden !== true &&
      message.answerHidden !== true
    );
  }
  const side = await ctx.db
    .query("threads")
    .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
    .unique();
  if (!side || side.messageId !== message._id) return false;
  if (message.hidden === true) return false;
  return admin || (user !== null && side.userId === user._id);
}

// Messages in a thread on an ask, with stream deltas, for the ask page. No
// `returns` validator: the page is the AI SDK's UIMessage shape, which the
// agent component owns and does not export a validator for. The client
// reads it through useUIMessages, which expects exactly this return.
export const listMessages = query({
  args: {
    // useUIMessages insists on threadId as an argument; messageId is what
    // access control is keyed on. The two must agree.
    threadId: v.string(),
    messageId: v.id("messages"),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Ask not found");
    if (!(await readAccess(ctx, message, args.threadId))) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: undefined,
      };
    }
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});

// Ask a follow up. The owner continues their own thread; anyone else
// signed in gets a side thread on the ask, created on the first send.
// Rate limited, same word cap as an ask and no word list, since no thread
// is ever on the wall. The user turn lands now; the model turn streams in
// from the scheduled action.
export const followUp = mutation({
  args: { messageId: v.id("messages"), text: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Ask not found");
    const lane = await laneFor(ctx, message, user);
    if (!lane) throw new ConvexError("This ask does not take follow ups");
    if (lane.kind === "own" && message.answerStatus !== "done") {
      throw new ConvexError("Wait for the first answer");
    }
    const parsed = parseOpenAsk(args.text);
    if (!parsed.ok) {
      throw new ConvexError(`Keep it under ${MAX_OPEN_WORDS} words`);
    }
    for (const name of ["answer", "answerDaily"] as const) {
      const limit = await rateLimiter.limit(ctx, name, { key: user._id });
      if (!limit.ok) {
        return { ok: false as const, retryAfterMs: limit.retryAfter };
      }
    }

    const now = Date.now();
    let threadId = lane.threadId;
    let system: string | undefined;
    if (lane.kind === "side") {
      // First send opens the side thread. Later sends bump the row.
      const existing = await sideThreadFor(ctx, message._id, user._id);
      if (existing) {
        threadId = existing.threadId;
        await ctx.db.patch(existing._id, {
          count: existing.count + 1,
          lastAt: now,
        });
      } else {
        threadId = await createThread(ctx, components.agent, {
          userId: user._id,
          title: message.text,
        });
        await ctx.db.insert("threads", {
          messageId: message._id,
          userId: user._id,
          threadId,
          model: lane.model,
          count: 1,
          lastAt: now,
        });
      }
      system = sideSystem(message);
    } else {
      // The wall's "Read the thread" keys off this count.
      await ctx.db.patch(message._id, {
        followUps: (message.followUps ?? 0) + 1,
      });
    }
    if (!threadId) throw new ConvexError("Wait for the first answer");

    const { messageId: promptMessageId } = await saveMessage(
      ctx,
      components.agent,
      { threadId, userId: user._id, prompt: parsed.text },
    );
    await bumpUsage(ctx, user._id, { asks: 1, lastAskAt: now });
    await bumpDaily(ctx, user._id, now, { followUps: 1 });
    await ctx.scheduler.runAfter(0, internal.answer.reply, {
      messageId: args.messageId,
      userId: user._id,
      threadId,
      promptMessageId,
      model: lane.model,
      system,
    });
    return { ok: true as const };
  },
});

// Your side threads, newest activity first, for /me. Each carries the ask
// it hangs off so the row can link to it. A deleted ask leaves no row,
// since remove and deleteAccount clean these up.
export const myThreads = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("threads"),
      messageId: v.id("messages"),
      text: v.string(),
      model: v.string(),
      count: v.number(),
      lastAt: v.number(),
      // Whether the ask still takes follow ups. False when it was hidden
      // after the thread opened.
      open: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    const out: Array<{
      _id: Id<"threads">;
      messageId: Id<"messages">;
      text: string;
      model: string;
      count: number;
      lastAt: number;
      open: boolean;
    }> = [];
    for (const row of rows) {
      const ask = await ctx.db.get(row.messageId);
      if (!ask) continue;
      out.push({
        _id: row._id,
        messageId: row.messageId,
        text: ask.text,
        model: row.model,
        count: row.count,
        lastAt: row.lastAt,
        open: acceptsFollowUps(ask),
      });
    }
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out;
  },
});

// Drop every side thread on one ask. Called when the ask is deleted.
export async function deleteSideThreadsOn(
  ctx: MutationCtx,
  messageId: Id<"messages">,
): Promise<void> {
  const rows = await ctx.db
    .query("threads")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .collect();
  for (const row of rows) {
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: row.threadId,
    });
    await ctx.db.delete(row._id);
  }
}

// Drop every side thread one person opened. Called when the account goes.
export async function deleteSideThreadsFor(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const rows = await ctx.db
    .query("threads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: row.threadId,
    });
    await ctx.db.delete(row._id);
  }
}
