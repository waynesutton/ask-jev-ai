# How sure was Jev, votes, copy link

Created: 2026-09-20 01:05 UTC
Last Updated: 2026-09-20 01:30 UTC
Status: Done

## Problem

The "Jev's answers" block under every card ran four rows and opened by default. Two of them (mood, topic) repeated chips already in the card foot. "Fits the wall?" showed `yes 99%` on every harmless post. The one number a yes or no asker wants, how sure Jev was, sat inside the block behind a toggle that read like a second answer. Signed in open asks got a "not a yes or no question" row under a model answer that already said so. Nothing measured whether Jev was right, and the only way to link an ask was to notice the timestamp is a link.

## Proposed solution

Fold the block to two rows, closed by default, and move the confidence onto the verdict chip so every surface reads `Jev: yes · 94%` at a glance. Store Jev's runner up choice from the same Choice answer so a shaky verdict explains itself. Say something about the wall gate only when the ask came close. Add a copy link and a "Was Jev right?" vote per ask.

### Backend

- `messages` gains `replyRunnerUp`, `replyRunnerUpP`, `agree`, `disagree`. All optional, no migration; old rows have no runner up and zero votes.
- New `votes` table, one row per voter per ask, keyed `u:<userId>` or `s:<sessionId>` so signing in later does not double count. Indexes `by_message_and_voter` and `by_voter`.
- `judge.run` reads `a.reply.probabilities`, takes the best option that is not the pick, and passes both through `record`. Zero extra tokens. `messages.overrideReply` clears the pair.
- `messages.jevAnswers` and `publicMessage` expose the new fields; `toPublic` defaults the tallies to 0.
- `votes.cast` accepts `{ messageId, sessionId, agree }`. Live, judged, not hidden, reply in yes/no/depends. Same vote again takes it back; the other flips. Patches the row tallies and bumps two sharded counters `voteAgree` and `voteDisagree`. IP layer plus a `vote` token bucket (30 a minute, capacity 10) per voter key. Returns `{ ok: false, retryAfterMs }` so the button can say "slow down" in place.
- `votes.mine` returns the viewer's votes (take 500) for the pressed state. Every card shares one subscription.
- `stats.agreement` divides the two counters; `rate` is null until the first vote.
- `profile.deleteAccount` deletes the account's votes. Tallies stay.

### Frontend

- `JevAnswers`: closed by default, remembered in `localStorage("jev:answers-open")` the same way the count panel is. Toggle reads "How sure was Jev" / "Hide how sure Jev was". Rows: "Jev says" with its bar, "Fits the wall?", and an indented "Runner up" when reply is depends or the top confidence is under 60% and the runner up carried at least 15%. Mood and topic rows gone.
- `VerdictChip`: one chip for Wall, AskPage, Profile, Me, Yours. `Jev: yes · 94%`; quiet `close call` under 60%; quiet `leaning no` on a depends. Tooltip explains the number.
- `EdgeTag`: quiet `close to the line` when the top hazard sits between 30% and `BLOCK_THRESHOLD`, with the number in the tip. Held cards keep their existing tag.
- `CopyLink`: writes `/a/:id`, swaps to "Copied" for 1.5s, says "Could not copy" if both clipboard paths are blocked. On wall cards, the ask page meta row, Profile and Me rows.
- `VoteButtons`: thumbs up and down with counts, pressed state from `votes.mine`, disabled for a paused account. Wall cards and the ask page. `AgreedNote` gives Profile and Me rows a read only "4 of 5 agreed".
- `CostTracker`: "Agreed with Jev" in More numbers once a vote exists.
- Styles: `.tag__pct`, `.tag--quiet`, `.answers__row--sub`, `.vote`, `.copylink`, plus 44px targets for thumbs and the copy link on coarse pointers.

## Files to change

- `convex/schema.ts`, `convex/judge.ts`, `convex/messages.ts`, `convex/votes.ts` (new), `convex/stats.ts`, `convex/profile.ts`, `convex/lib/counters.ts`, `convex/lib/rateLimits.ts`
- `src/components/JevAnswers.tsx`, `src/components/CopyLink.tsx` (new), `src/components/Vote.tsx` (new), `src/components/Wall.tsx`, `src/components/AskPage.tsx`, `src/components/Profile.tsx`, `src/components/Me.tsx`, `src/components/Yours.tsx`, `src/components/CostTracker.tsx`, `src/components/Docs.tsx`, `src/components/Legal.tsx`, `src/styles.css`

## Edge cases

- Rows judged before confidence existed: chip shows `Jev: yes` with no percent, fold shows no bar.
- A masked card (held words, hidden by admin) takes no vote; the voter cannot read what Jev judged.
- Open and statement replies get no chip and no thumbs; the model answer, or the lack of one, already says it.
- Take back then flip in one minute: three writes, well inside the bucket.
- Clipboard blocked (http, webview): the legacy selection copy runs; if that fails too the button says so.

## Verification

- Dev: `npx convex dev --once` added the two `votes` indexes. `npm run typecheck` clean.
- Wall card closed by default; chips read `Jev: yes · 94%`, `Jev: yes · 24%` with `close call`, `Jev: depends · 63%` with `leaning no`.
- Fresh depends ask stored `replyRunnerUp: "no"`, `replyRunnerUpP: 0.28`; fold showed Jev says 63%, Runner up no 28%, Fits the wall 99%.
- Agree then disagree on one card: `votes` row flipped to `agree: false`, message `agree 0, disagree 1`, `stats.agreement` returned `total 1, rate 0`, "Agreed with Jev 0%" appeared in More numbers.
- Ask page shows the verdict line with thumbs and the copy link; fold honours the saved preference.
- `/me` rows show the chip with percent, the lean tag, and the Link button.
- Dark theme checked on the open fold and the quiet tags.

## Completion log

- 2026-09-20 01:05 UTC PRD written from the approved plan.
- 2026-09-20 01:30 UTC Shipped to dev. Prod: `npm run deploy` ships the schema; no backfill needed, old rows simply have no runner up and zero votes.
