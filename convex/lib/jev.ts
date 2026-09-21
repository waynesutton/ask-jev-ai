// One door to Jev. Today the call goes straight to TypeSafe with the
// deployment's TYPESAFE_API_KEY. When Convex lists `typesafe-ai/jev` on the
// AI Gateway, set JEV_PROVIDER=gateway and JEV_GATEWAY_URL and the same
// request goes through the gateway on a short lived deployment token. A
// gateway failure falls back to TypeSafe when a key is present, so a bad
// flip never takes the wall down.
//
// Assumption, flagged: Convex has not published the gateway path or body
// for Jev yet. The gateway branch sends the System One body unchanged with
// the model renamed. Verify it against the docs when Jev lands.

// convex/server exports getServiceToken since 1.44 (this repo is on 1.46).
// It mints the deployment JWT the AI Gateway accepts. Actions only.
import * as convexServer from "convex/server";
import {
  systemOne,
  TypeSafeError,
  type AnswersFor,
  type Question,
} from "./typesafe";

export type JevProvider = "typesafe" | "gateway";

// Model id Convex will list Jev under. Adjust if the models page differs.
export const JEV_GATEWAY_MODEL = "typesafe-ai/jev";

export type JevResult<Q extends Record<string, Question>> = {
  answers: AnswersFor<Q>;
  usage: { input_tokens: number; output_tokens: number };
  provider: JevProvider;
  latencyMs: number;
};

// Which provider the env asks for. Unset means TypeSafe.
export function jevProvider(): JevProvider {
  return process.env.JEV_PROVIDER === "gateway" ? "gateway" : "typesafe";
}

// Whether any path to Jev is configured. Drives the "Jev online" line.
export function jevConfigured(): boolean {
  const hasKey = Boolean(process.env.TYPESAFE_API_KEY);
  if (jevProvider() === "gateway") {
    return Boolean(process.env.JEV_GATEWAY_URL) || hasKey;
  }
  return hasKey;
}

export async function askJev<Q extends Record<string, Question>>(args: {
  state: unknown;
  questions: Q;
}): Promise<JevResult<Q>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const provider = jevProvider();

  if (provider === "gateway") {
    const started = Date.now();
    try {
      const response = await gatewaySystemOne(args);
      return {
        answers: response.answers,
        usage: response.usage,
        provider: "gateway",
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (!apiKey) throw error;
      // Logged once per call, not per retry, so the log stays readable.
      console.warn("Jev gateway failed, falling back to TypeSafe", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!apiKey) {
    throw new Error("Jev is not configured: set TYPESAFE_API_KEY");
  }
  const started = Date.now();
  const response = await systemOne({ apiKey, ...args });
  return {
    answers: response.answers,
    usage: response.usage,
    provider: "typesafe",
    latencyMs: Date.now() - started,
  };
}

// The same System One body, posted to the gateway with a deployment token.
async function gatewaySystemOne<Q extends Record<string, Question>>(args: {
  state: unknown;
  questions: Q;
}) {
  const url = process.env.JEV_GATEWAY_URL;
  if (!url) {
    throw new Error("JEV_PROVIDER=gateway but JEV_GATEWAY_URL is not set");
  }
  const token = await convexServer.getServiceToken("ai-gateway");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: args.state,
      model: JEV_GATEWAY_MODEL,
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
  return (await response.json()) as {
    answers: AnswersFor<Q>;
    usage: { input_tokens: number; output_tokens: number };
  };
}
