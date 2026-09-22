import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askJev,
  JEV_GATEWAY_MODEL,
  JEV_GATEWAY_URL,
  jevConfigured,
  jevProvider,
  jevProviderOrder,
  JevUnavailableError,
} from "./lib/jev";
import { TYPESAFE_ENDPOINT, TYPESAFE_MODEL } from "./lib/typesafe";

// getServiceToken is an action only syscall. Stub it so the gateway door
// can be exercised outside a Convex action.
const getServiceToken = vi.fn<() => Promise<string>>();
vi.mock("convex/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("convex/server")>();
  return { ...original, getServiceToken: () => getServiceToken() };
});

const questions = {
  reply: {
    type: "choice",
    instructions: "Is it a yes?",
    criteria: { yes: "yes", no: "no" },
  },
} as const;

const answers = {
  reply: {
    type: "choice",
    choice: "yes",
    probabilities: { yes: 0.9, no: 0.1 },
    confidence: 0.9,
  },
};

type Call = { url: string; init: RequestInit };
let calls: Array<Call>;
let responses: Array<() => Response>;

function json(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
  calls = [];
  responses = [];
  getServiceToken.mockReset();
  getServiceToken.mockResolvedValue("token-123");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return next();
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.unstubAllEnvs();
  vi.stubEnv("JEV_PROVIDER", "");
  vi.stubEnv("TYPESAFE_API_KEY", "");
  vi.stubEnv("JEV_GATEWAY_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("which door opens first", () => {
  it("defaults to the gateway, with TypeSafe behind it when a key is set", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "sk-test");
    expect(jevProvider()).toBe("gateway");
    expect(jevProviderOrder()).toEqual(["gateway", "typesafe"]);
    expect(jevConfigured()).toBe(true);
  });

  it("is gateway only without a key", () => {
    expect(jevProviderOrder()).toEqual(["gateway"]);
    expect(jevConfigured()).toBe(true);
  });

  it("puts TypeSafe first when pinned, gateway behind it", () => {
    vi.stubEnv("JEV_PROVIDER", "typesafe");
    vi.stubEnv("TYPESAFE_API_KEY", "sk-test");
    expect(jevProvider()).toBe("typesafe");
    expect(jevProviderOrder()).toEqual(["typesafe", "gateway"]);
  });

  it("falls to gateway only when pinned to TypeSafe without a key", () => {
    vi.stubEnv("JEV_PROVIDER", "typesafe");
    expect(jevProviderOrder()).toEqual(["gateway"]);
  });
});

describe("askJev through the gateway", () => {
  it("posts the System One body to Decisions with the deployment token", async () => {
    responses.push(
      json({
        id: "req-1",
        model: JEV_GATEWAY_MODEL,
        answers,
        usage: { input_tokens: 21, output_tokens: 3, cost: 0.000001 },
      }),
    );
    const result = await askJev({ state: { message: "hi" }, questions });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(JEV_GATEWAY_URL);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toEqual({
      model: JEV_GATEWAY_MODEL,
      state: { message: "hi" },
      questions,
    });
    expect(result.provider).toBe("gateway");
    expect(result.answers.reply.choice).toBe("yes");
    expect(result.usage).toEqual({ input_tokens: 21, output_tokens: 3 });
    expect(result.costUsd).toBe(0.000001);
  });

  it("honors JEV_GATEWAY_URL when the endpoint moves", async () => {
    vi.stubEnv("JEV_GATEWAY_URL", "https://example.test/v1/decisions");
    responses.push(
      json({ answers, usage: { input_tokens: 1, output_tokens: 1 } }),
    );
    await askJev({ state: {}, questions });
    expect(calls[0].url).toBe("https://example.test/v1/decisions");
  });

  it("falls back to TypeSafe when the gateway fails and a key is present", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "sk-test");
    responses.push(json({ error: { code: "upstream_error" } }, 503));
    responses.push(
      json({
        model: TYPESAFE_MODEL,
        answers,
        usage: { input_tokens: 21, output_tokens: 3 },
      }),
    );
    const result = await askJev({ state: { message: "hi" }, questions });

    expect(calls.map((c) => c.url)).toEqual([JEV_GATEWAY_URL, TYPESAFE_ENDPOINT]);
    const headers = calls[1].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(result.provider).toBe("typesafe");
    expect(result.costUsd).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Jev gateway failed, falling back to typesafe",
      expect.objectContaining({ error: expect.stringContaining("503") }),
    );
  });

  it("surfaces the gateway error when there is nothing to fall back to", async () => {
    responses.push(json({ error: { code: "upstream_error" } }, 502));
    await expect(askJev({ state: {}, questions })).rejects.toThrow(
      "Gateway 502",
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("throws JevUnavailableError when the gateway is off and no key is set", async () => {
    getServiceToken.mockRejectedValue(
      new Error("AiGatewayDisabled: upgrade to a paid plan"),
    );
    await expect(askJev({ state: {}, questions })).rejects.toBeInstanceOf(
      JevUnavailableError,
    );
    expect(calls).toHaveLength(0);
  });

  it("still reaches TypeSafe when the gateway is off and a key is set", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "sk-test");
    getServiceToken.mockRejectedValue(new Error("AiGatewayUnavailable"));
    responses.push(
      json({
        model: TYPESAFE_MODEL,
        answers,
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
    );
    const result = await askJev({ state: {}, questions });
    expect(result.provider).toBe("typesafe");
    expect(calls.map((c) => c.url)).toEqual([TYPESAFE_ENDPOINT]);
  });
});

describe("askJev pinned to TypeSafe", () => {
  it("goes to TypeSafe first and falls back to the gateway on failure", async () => {
    vi.stubEnv("JEV_PROVIDER", "typesafe");
    vi.stubEnv("TYPESAFE_API_KEY", "sk-test");
    responses.push(json({ error: "rate limited" }, 429));
    responses.push(
      json({ answers, usage: { input_tokens: 2, output_tokens: 1 } }),
    );
    const result = await askJev({ state: {}, questions });

    expect(calls.map((c) => c.url)).toEqual([TYPESAFE_ENDPOINT, JEV_GATEWAY_URL]);
    expect(result.provider).toBe("gateway");
    expect(console.warn).toHaveBeenCalledWith(
      "Jev typesafe failed, falling back to gateway",
      expect.anything(),
    );
  });
});
