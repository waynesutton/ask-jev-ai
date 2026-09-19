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
