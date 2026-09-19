import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { SAFE_WORDS } from "./safeWords";

// Shared by the browser (instant feedback) and the server (enforcement).
// Two gates run in code before Jev ever sees a sentence:
//   1. Blocklist. Profanity, slurs, sexual terms. Masked as *** and never posted.
//   2. Allowlist. Plain English from safe-words plus a few demo words.

// A message is a short ask: at least three words, at most fifteen.
export const MIN_WORDS = 3;
export const MAX_WORDS = 15;

// What a blocked word is displayed as, everywhere.
export const MASK = "***";

// Words the demo needs that the safe-words list does not carry.
const EXTRA_WORDS: ReadonlySet<string> = new Set([
  "jev",
  "jevs",
  "convex",
  "typesafe",
  "demo",
]);

// English profanity dataset with the transformers the library recommends:
// leetspeak (sh1t), confusable unicode, repeated letters (fuuuck), case.
const profanity = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export type WordCheck = {
  raw: string;
  clean: string;
  // On the allowlist.
  ok: boolean;
  // On the blocklist. Takes priority over ok in the UI.
  blocked: boolean;
};

export type ParseResult =
  | { ok: true; words: Array<string>; text: string }
  | {
      ok: false;
      reason: "count" | "unsafe" | "blocked";
      checks: Array<WordCheck>;
    };

// Lowercase, drop a single trailing punctuation mark, keep letters and apostrophes.
export function cleanWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:]+$/, "")
    .replace(/[^a-z']/g, "");
}

export function isSafeWord(clean: string): boolean {
  return clean.length > 0 && (SAFE_WORDS.has(clean) || EXTRA_WORDS.has(clean));
}

export function isBlockedWord(clean: string): boolean {
  return clean.length > 0 && profanity.hasMatch(clean);
}

// Catches profanity split across words (f u c k) or hidden in punctuation.
// Checks the raw text and the text with everything but letters removed.
export function hasBlockedText(input: string): boolean {
  if (profanity.hasMatch(input)) return true;
  const letters = input.toLowerCase().replace(/[^a-z]/g, "");
  return letters.length > 0 && profanity.hasMatch(letters);
}

export function checkWords(input: string): Array<WordCheck> {
  return input
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((raw) => {
      const clean = cleanWord(raw);
      const blocked = isBlockedWord(clean) || isBlockedWord(raw);
      return { raw, clean, ok: !blocked && isSafeWord(clean), blocked };
    });
}

// The single source of truth for what counts as a valid post.
// Blocked wins over count so the user fixes the real problem first.
export function parseMessage(input: string): ParseResult {
  const checks = checkWords(input);
  if (checks.some((c) => c.blocked) || hasBlockedText(input)) {
    return { ok: false, reason: "blocked", checks };
  }
  if (checks.length < MIN_WORDS || checks.length > MAX_WORDS) {
    return { ok: false, reason: "count", checks };
  }
  if (checks.some((c) => !c.ok)) {
    return { ok: false, reason: "unsafe", checks };
  }
  const words = checks.map((c) => c.clean);
  return { ok: true, words, text: words.join(" ") };
}
