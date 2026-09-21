// Jev list price. Source: https://typesafe.ai/blog/introducing-system-one-models-and-jev
// Input $0.042 per million tokens. Output is free: there is no autoregressive
// decode to meter. Update here if the price sheet changes.

export const INPUT_USD_PER_MTOK = 0.042;
export const OUTPUT_USD_PER_MTOK = 0;

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) /
    1_000_000
  );
}

// Answer models, USD per million tokens, in then out. Snapshot of the
// provider list prices at the time of writing; the gateway bills what the
// provider bills. Any model not listed here is metered at the fallback
// row so the tracker never shows $0 for a real call.
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "google/gemini-3.5-flash-lite": { input: 0.1, output: 0.4 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
  "openai/gpt-5.4-mini": { input: 0.25, output: 2 },
  "perplexity/sonar": { input: 1, output: 1 },
};

const FALLBACK_PRICE = { input: 1, output: 4 };

// Integer micro dollars (one millionth of a dollar), so counters that sum
// thousands of answers stay exact. Rounded per call, not per token.
export function answerMicroUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICES[model] ?? FALLBACK_PRICE;
  // tokens * (USD per Mtok) / 1e6 tokens * 1e6 micro = tokens * price
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}

export function microToUsd(micro: number): number {
  return micro / 1_000_000;
}
