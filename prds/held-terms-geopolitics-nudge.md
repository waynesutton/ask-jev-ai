# Geopolitics on the held list, and a sign in line under a held visitor ask

Created: 2026-09-22 09:40 UTC
Last Updated: 2026-09-22 09:50 UTC
Status: Done on dev. Prod env step in `task.md`.

## Problem

"Will russia collapse" and "Will soviet union collapse" were posted by visitors and landed on the wall. The owner expected the held terms gate to catch them, tell the visitor to sign in, and keep the ask off the wall.

## Root cause

Two separate facts, neither a bug.

1. The gate works and is identical on dev and prod: 226 terms on each. The list covers four clusters (explicit sexual terms, religion, sexuality, slavery and race) and has no geopolitics. `russia`, `soviet`, and `collapse` are all on the 12,530 word safe list, so a visitor ask with them passes the allowlist, misses `HELD_TERMS`, goes to Jev, and goes live like any clean ask.
2. The sign in reminder on a held visitor ask never shipped. `HELD_TERMS` is server only by design, so the composer cannot warn before the post. After the post the Yours card shows the bare label "Held back by Jev" with no link, unchanged since the first commit. The only visitor sign in nudge tied to a verdict is `OpenAskNote`, which fires on `open` replies.

## Proposed solution

Both, no schema or server change.

**Held list.** Add a geopolitics cluster to `HELD_TERMS` on dev and prod. Only terms whose every word is on the safe list matter for visitors, so the cluster is filtered to those: `russia`, `russian`, `russians`, `soviet`, `soviet union`, `israel`, `israeli`, `palestine`, `north korea`, `communist`, `hitler`. Left out on purpose because they carry ordinary asks: `war`, `invasion`, `nuclear`, `china`, `chinese`, `korea`, `president`, `election`, `republican`. Words that fail the allowlist anyway (`putin`, `ukraine`, `gaza`, `hamas`, `nato`, `trump`, `biden`) are not added; `parseMessage` rejects them first. One `npx convex env set` per deployment, no deploy.

**Sign in line.** In `Yours.tsx`, under a visitor's held ask, render a `.nudge` line: the wall does not host this topic for visitors; sign in and the same ask goes through, judged and answered, blurred on the wall for everyone but you. Sign in link carries `?next=/`. Guard is exact: `status === "blocked"` and `judged === false`. A held term row is stored with `judged: false` and no Jev call; a Jev safety hold sets `judged: true` and signing in would not change that verdict, so it gets no line. Signed in readers never see it: their held term asks are `wallHidden` and live, not blocked.

## Files to change

- `src/components/Yours.tsx` the `HeldAskNote` line
- `README.md` one sentence on the held visitor line
- `files.md`, `changelog.md`, `task.md`
- `HELD_TERMS` env on dev and prod (not in the repo)

## Edge cases

- A visitor ask Jev itself held (`judged: true`, `status: blocked`): no line. The label stays "Held back by Jev".
- A held term ask retried through `messages.retry`: `retry` only acts on `failed`, so a blocked row cannot be re sent.
- The card does not fade for blocked asks, so the line stays readable until the X or the next ask.
- Session still loading (`me === undefined`): the note follows `OpenAskNote` and renders nothing rather than flash the wrong copy. In Yours `signedIn` is already false during load, so the guard passes `me` through instead.
- Env value size: 226 terms is about 2.1 KB; eleven more stays far under the 8 KiB cap.

## Verification

- `npm run typecheck`, `npm test`, prettier on the changed file
- `npx convex env set HELD_TERMS "<existing>,<new>"` on dev, then `npx convex run messages:send` with a visitor session and "will russia collapse": row `status: blocked`, `judged: false`, no tokens, absent from the wall
- Browser on dev as a visitor: post "will russia collapse", Yours shows "Held back by Jev" and the sign in line; post "is water wet", no line
- Same env set on prod, same `convex run` check, then a visitor ask on askjev.ai

## Task completion log

- 2026-09-22 09:40 UTC PRD written after the investigation in chat: gate intact, list identical on dev and prod, words on the safe list and not on the held list, no reminder ever shipped.
- 2026-09-22 09:50 UTC Shipped to dev. `HELD_TERMS` on dev at 237 terms, 2,235 chars. `HeldAskNote` in `Yours.tsx`. CLI check: visitor `messages:send` "will russia collapse" stored `blocked`, `judged: false`, no tokens. Browser at 1024 light: "will soviet union collapse" showed the strikethrough text, "Held back by Jev", and the line with `href="/sign-in?next=%2F"`; the control ask "is water wet" went live on the wall with no line and its card drained on the usual clock. Typecheck, prettier, 40 tests clean. Prod env write was blocked by the tool reviewer twice and one approved attempt aborted on an empty read before writing; the command is in `task.md` to run by hand. Not deployed.
