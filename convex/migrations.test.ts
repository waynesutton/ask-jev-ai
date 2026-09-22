/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import shardedCounter from "@convex-dev/sharded-counter/test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { counters } from "./lib/counters";
import { JEV_GATEWAY_URL } from "./lib/jev";
import { QUESTIONS } from "./questions";

const modules = import.meta.glob("./**/*.ts");

// getServiceToken is an action only syscall; stub it like jev.test.ts.
vi.mock("convex/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("convex/server")>();
  return { ...original, getServiceToken: async () => "token-123" };
});

type Call = { url: string; body: unknown };
let calls: Array<Call>;
let responses: Array<() => Response>;

function jevSays(
  choice: string,
  probabilities: Record<string, number>,
  tokens = 12,
): () => Response {
  return () =>
    new Response(
      JSON.stringify({
        id: "req",
        model: "typesafe/jev-1.13",
        answers: {
          reply: {
            type: "choice",
            choice,
            probabilities,
            confidence: probabilities[choice],
          },
        },
        usage: { input_tokens: tokens, output_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

function setup(): TestConvex<typeof schema> {
  const t = convexTest(schema, modules);
  shardedCounter.register(t);
  return t;
}

// Three live rows: one judged without a reply (the target), one judged
// with a reply, one never judged. Only the first should change.
async function seed(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const base = { sessionId: "s".repeat(36), status: "live" as const };
    const missing = await ctx.db.insert("messages", {
      ...base,
      text: "who is president",
      judged: true,
      topic: "other",
    });
    const settled = await ctx.db.insert("messages", {
      ...base,
      text: "can pigs fly",
      judged: true,
      reply: "no",
      replyConfidence: 0.99,
    });
    const unjudged = await ctx.db.insert("messages", {
      ...base,
      text: "is water wet",
      judged: false,
    });
    return { missing, settled, unjudged };
  });
}

beforeEach(() => {
  calls = [];
  responses = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return next();
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("JEV_PROVIDER", "");
  vi.stubEnv("TYPESAFE_API_KEY", "");
  vi.stubEnv("JEV_GATEWAY_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("backfillReply", () => {
  it("dry run counts rows without a reply and never calls Jev", async () => {
    const t = setup();
    const ids = await seed(t);

    await t.action(internal.migrations.backfillReply, { dryRun: true });

    expect(calls).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith("backfillReply dry run done", {
      scanned: 3,
      missing: 1,
      fixed: 0,
      failed: 0,
    });
    const row = await t.run((ctx) => ctx.db.get(ids.missing));
    expect(row?.reply).toBeUndefined();
  });

  it("asks Jev the reply question alone and fills the missing row", async () => {
    const t = setup();
    const ids = await seed(t);
    responses.push(jevSays("open", { open: 0.8, depends: 0.15, yes: 0.05 }));

    await t.action(internal.migrations.backfillReply, {});

    // One call, one question, the gateway door.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(JEV_GATEWAY_URL);
    expect(calls[0].body).toMatchObject({
      state: { message: "who is president" },
      questions: { reply: QUESTIONS.reply },
    });
    expect(
      Object.keys((calls[0].body as { questions: object }).questions),
    ).toEqual(["reply"]);

    const rows = await t.run(async (ctx) => ({
      missing: await ctx.db.get(ids.missing),
      settled: await ctx.db.get(ids.settled),
      unjudged: await ctx.db.get(ids.unjudged),
    }));
    expect(rows.missing).toMatchObject({
      reply: "open",
      replyConfidence: 0.8,
      replyRunnerUp: "depends",
      replyRunnerUpP: 0.15,
    });
    // The row's own token fields stay put so its per card cost holds.
    expect(rows.missing?.inputTokens).toBeUndefined();
    expect(rows.settled).toMatchObject({ reply: "no", replyConfidence: 0.99 });
    expect(rows.unjudged?.reply).toBeUndefined();

    // Spend lands on the global counters.
    const spent = await t.run((ctx) => counters.count(ctx, "inputTokens"));
    expect(spent).toBe(12);
    expect(console.log).toHaveBeenCalledWith("backfillReply done", {
      scanned: 3,
      missing: 1,
      fixed: 1,
      failed: 0,
    });
  });

  it("stops at the limit and logs a cursor to resume from", async () => {
    const t = setup();
    await seed(t);
    await t.run((ctx) =>
      ctx.db.insert("messages", {
        sessionId: "s".repeat(36),
        status: "live",
        text: "what is jev",
        judged: true,
      }),
    );
    responses.push(jevSays("open", { open: 0.9, statement: 0.1 }));

    await t.action(internal.migrations.backfillReply, { limit: 1 });

    expect(calls).toHaveLength(1);
    // One row on this page was never reached, so the resume cursor is this
    // page's own start: the fixed row now has a reply and drops out.
    expect(console.log).toHaveBeenCalledWith("backfillReply stopped at limit", {
      scanned: 4,
      missing: 2,
      fixed: 1,
      failed: 0,
      resume: { cursor: null, limit: 1 },
    });
  });

  it("counts a Jev failure and keeps going", async () => {
    const t = setup();
    const ids = await seed(t);
    responses.push(() => new Response("nope", { status: 502 }));

    await t.action(internal.migrations.backfillReply, {});

    const row = await t.run((ctx) => ctx.db.get(ids.missing));
    expect(row?.reply).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith("backfillReply done", {
      scanned: 3,
      missing: 1,
      fixed: 0,
      failed: 1,
    });
  });
});
