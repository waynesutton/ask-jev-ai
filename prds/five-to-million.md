# Five to Million

Created: 2026-09-17 04:05 UTC
Last Updated: 2026-09-17 04:16 UTC
Status: Done (pending API key and production deploy)

## Problem

Show what TypeSafe (Jev) and Convex do well in one small public app. A shared wall where every message is exactly five words, a counter climbing to one million, and nothing unkind ever lands.

## Root cause of the design choice

Jev does not generate text. It judges. So the app never asks it to chat. Code owns the workflow (allowlist, rate limit, counters, realtime), and Jev answers narrow typed questions about each message in one request.

## Proposed solution

Two gates, each doing what it is good at:

1. Allowlist in code. Every word must be in the human verified list from The-Best-Codes/safe-words (12,530 tokens after cleanup). Zero cost, deterministic, runs client side for instant feedback and server side for enforcement.
2. Jev. One request per message with five parallel questions: is_unkind, is_adult, targets_person (Noul), mood (Score), topic (Choice). Code composes the answers with thresholds in one file.

Flow: `messages.send` mutation inserts with status `judging` and schedules `judge.run`. The action calls TypeSafe, then `judge.record` patches status to `live` or `blocked` and bumps sharded counters. The wall query returns only `live`. The sender watches their own card flip.

When `TYPESAFE_API_KEY` is missing, the gate degrades to allowlist only and the UI says so. Adding the key flips the UI with no redeploy.

## Files to change

- `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`
- `convex/convex.config.ts` (sharded counter, rate limiter, static hosting)
- `convex/schema.ts`, `convex/messages.ts`, `convex/judge.ts`, `convex/questions.ts`, `convex/stats.ts`
- `convex/lib/words.ts`, `convex/lib/safeWords.ts` (generated), `convex/lib/typesafe.ts`
- `scripts/buildSafeWords.mjs`
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/components/*`, `src/lib/session.ts`
- `prds/`, `task.md`, `files.md`, `changelog.md`

## Edge cases

- Exactly five words after trimming and collapsing whitespace. Trailing `.`, `,`, `!`, `?` stripped from the last word only.
- Apostrophes allowed when the list contains the token (`don't`, `ain't`).
- Duplicate submits: rate limiter per anonymous session, 10 per minute with burst of 3.
- Judge failure: retry three times with backoff, then mark `failed` so the sender can retry. Never publish an unjudged message when a key is configured.
- No key configured: publish as `live` with `judged: false`.
- Counter reads use `count` in queries only, never inside the send mutation.

## Verification steps

- `npm run typecheck` passes for app and convex.
- `npx convex dev --once` deploys schema and functions to the anonymous local deployment.
- `npm run build` produces `dist/`.
- Browser: post five valid words, watch status flip to live, counter increments, wall shows the message. Post an invalid word, submit stays disabled. Post six words, submit stays disabled.

## Task completion log

- 2026-09-17 04:05 UTC PRD written.
- 2026-09-17 04:09 UTC Backend deployed to anonymous local deployment. Components installed: shardedCounter, rateLimiter (with batchWorker child), staticHosting.
- 2026-09-17 04:14 UTC Verified: `npm run typecheck` clean, `vite build` clean, post flow judging to live in browser, counter 4 to 5, validation errors thrown for six words and unsafe words, rate limiter returned `ok: false` with `retryAfterMs` on the fourth burst post.
- 2026-09-17 04:16 UTC Not yet verified: the Jev judged path and the failed/retry path. Both need a real `TYPESAFE_API_KEY`. Types match the documented API response shape.
