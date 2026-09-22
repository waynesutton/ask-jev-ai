// One door to Jev. Two ways through it.
//
//   gateway   POST https://ai-gateway.convex.dev/alpha/decisions on a short
//             lived deployment token from getServiceToken("ai-gateway").
//             No key to store. Usage lands on the Convex bill next to the
//             model answers. This is the default.
//   typesafe  POST to TypeSafe directly with TYPESAFE_API_KEY. The original
//             path, kept as the fallback and as an explicit choice.
//
// JEV_PROVIDER picks the primary. Unset means gateway. Whichever is primary,
// the other is tried once when the first call fails and is configured, so a
// gateway outage or a bad key never takes the wall down. The provider that
// answered is returned so the row can say which door it came through.
//
// The Decisions endpoint takes the System One body unchanged: `state`,
// `questions`, and the same three question types. Only the model id and
// the URL differ. Docs: https://docs.convex.dev/ai-gateway/api#post-alphadecisions
//
// Decisions is in alpha on the gateway. If the shape moves, only
// gatewayDecisions below needs to follow it.

// convex/server exports getServiceToken since 1.44 (this repo is on 1.46).
// It mints the deployment JWT the AI Gateway accepts. Actions only.
import * as convexServer from "convex/server";
import {
  JEV_GATEWAY_MODEL,
  systemOne,
  TypeSafeError,
  type AnswersFor,
  type Question,
} from "./typesafe";

export { JEV_GATEWAY_MODEL };

export type JevProvider = "typesafe" | "gateway";

// Where Decisions lives. JEV_GATEWAY_URL overrides it for the day the
// endpoint leaves alpha and moves.
export const JEV_GATEWAY_URL = "https://ai-gateway.convex.dev/alpha/decisions";

export type JevResult<Q extends Record<string, Question>> = {
  answers: AnswersFor<Q>;
  usage: { input_tokens: number; output_tokens: number };
  // The gateway reports what the call cost in USD. TypeSafe direct does
  // not, so the counters keep pricing from tokens for both paths.
  costUsd?: number;
  provider: JevProvider;
  latencyMs: number;
};

// Thrown when no door to Jev can open: the gateway says this deployment
// cannot use it (free plan, local backend) and there is no TypeSafe key.
// judge.run treats this like a missing key and publishes unjudged instead
// of retrying, so the wall keeps working while the env is fixed.
export class JevUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevUnavailableError";
  }
}

// Which provider goes first. Explicit env wins; unset means gateway.
export function jevProvider(): JevProvider {
  return process.env.JEV_PROVIDER === "typesafe" ? "typesafe" : "gateway";
}

// Primary first, then the other. TypeSafe only joins when it has a key;
// the gateway always joins because its token is minted per call.
export function jevProviderOrder(): Array<JevProvider> {
  const hasKey = Boolean(process.env.TYPESAFE_API_KEY);
  const primary = jevProvider();
  if (primary === "gateway") {
    return hasKey ? ["gateway", "typesafe"] : ["gateway"];
  }
  return hasKey ? ["typesafe", "gateway"] : ["gateway"];
}

// Whether any path to Jev is configured. Drives the "Jev online" line.
// The gateway needs no env, so this is only false when someone pinned
// JEV_PROVIDER=typesafe and left the key out.
export function jevConfigured(): boolean {
  return jevProviderOrder().length > 0;
}

export async function askJev<Q extends Record<string, Question>>(args: {
  state: unknown;
  questions: Q;
}): Promise<JevResult<Q>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const order = jevProviderOrder();
  let lastError: unknown;
  let gatewayUnavailable = false;

  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    const started = Date.now();
    try {
      if (provider === "gateway") {
        const response = await gatewayDecisions(args);
        return {
          answers: response.answers,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          },
          costUsd: response.usage.cost,
          provider,
          latencyMs: Date.now() - started,
        };
      }
      if (!apiKey) continue; // never in the order without a key, kept for types
      const response = await systemOne({ apiKey, ...args });
      return {
        answers: response.answers,
        usage: response.usage,
        provider,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      lastError = error;
      if (provider === "gateway" && isGatewayUnavailable(error)) {
        gatewayUnavailable = true;
      }
      const next = order[i + 1];
      if (next) {
        // Logged once per call, not per retry, so the log stays readable.
        console.warn(`Jev ${provider} failed, falling back to ${next}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (gatewayUnavailable && !apiKey) {
    throw new JevUnavailableError(
      "Jev is not available: the AI Gateway is off for this deployment and TYPESAFE_API_KEY is not set. Upgrade the Convex plan, or set the key, or set JEV_PROVIDER=typesafe with the key.",
    );
  }
  if (lastError !== undefined) throw lastError;
  throw new JevUnavailableError(
    "Jev is not configured: set TYPESAFE_API_KEY or unset JEV_PROVIDER",
  );
}

// getServiceToken throws these when the deployment cannot use the gateway
// at all. Everything else (5xx, a bad body, a network blip) is a normal
// failure worth retrying.
function isGatewayUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /AiGatewayDisabled|AiGatewayUnavailable/.test(message);
}

type DecisionsResponse<Q extends Record<string, Question>> = {
  id: string;
  model: string;
  answers: AnswersFor<Q>;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
};

// The System One body, posted to the gateway's Decisions endpoint with a
// deployment token.
async function gatewayDecisions<Q extends Record<string, Question>>(args: {
  state: unknown;
  questions: Q;
}): Promise<DecisionsResponse<Q>> {
  const url = process.env.JEV_GATEWAY_URL || JEV_GATEWAY_URL;
  const token = await convexServer.getServiceToken("ai-gateway");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_GATEWAY_MODEL,
      state: args.state,
      questions: args.questions,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TypeSafeError(
      response.status,
      `Gateway ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as DecisionsResponse<Q>;
}
