# Open question line on anonymous asks, and a reply backfill

Created: 2026-09-22 07:45 UTC
Last Updated: 2026-09-22 07:58 UTC
Status: Done

## Problem

A visitor asks "who is president" or "what is jev". Jev reads it as `open` (wants more than yes or no) and stores that on the row. The wall card then shows nothing about it: no verdict chip (the chip skips `open` and `statement` on purpose), no model answer (visitors never get one), just the mood, topic, cost, and "Sign in to ask follow up questions". A reader cannot tell why this card has no answer, and the asker is not told what would have worked.

The only place that said anything was the Yours strip under the composer, and only for the visitor who posted it, only while the ask was in their last three.

Rows judged before 2026-09-17 05:52 UTC have no `reply` at all, so even a chip aware surface can say nothing about them.

## Root cause

`VerdictChip` renders only yes, no, and depends. The comment says the model answer above "or the lack of one" already says it. That was true for signed in asks. For an anonymous open ask there is no answer block, so nothing says it.

## Proposed solution

One shared `OpenAskNote` component, rendered in the answer slot of every card surface. It shows when an ask is live, judged, not masked, Jev said `open`, and no model answer exists or is coming (`answerStatus` undefined, which is only ever true for anonymous asks).

- Visitor: "Jev read this as an open question, not a yes or no. Sign in and a model Jev picks answers it, or ask something Jev can settle with yes or no." Sign in carries `?next=/a/:id`. The second link goes to the composer.
- Signed in: one quiet line, no link, so the blank card is explained: "Jev read this as an open question, not a yes or no. It was asked signed out, so no model answered it."
- Session still loading: nothing, same as `FollowUp`.

Surfaces: wall cards, the Yours strip (replacing the inline nudge), and `/a/:id`.

Backfill: `migrations:backfillReply`, an internal action run from the CLI. Pages live rows that were judged but have no `reply`, asks Jev only the `reply` Choice for each, and patches `reply`, `replyConfidence`, `replyRunnerUp`, `replyRunnerUpP`. Tokens go on the global `inputTokens` and `outputTokens` counters so spend stays honest; the row's own token fields stay as they were so per card cost does not drift. `dryRun` counts without calling Jev. `limit` caps how many rows one run re judges; when it is hit the log prints the cursor to resume from. Idempotent: a row that gained a `reply` between the page and the patch is skipped.

## Files to change

- `src/components/OpenAsk.tsx` new
- `src/components/Wall.tsx` render the note in the answer slot
- `src/components/Yours.tsx` swap the inline nudge for the component
- `src/components/AskPage.tsx` render the note above `AnswerBlock`
- `src/styles.css` `.yours__nudge` becomes `.nudge`, shared
- `convex/migrations.ts` `pageLiveWithoutReply`, `setReply`, `backfillReply`
- `convex/migrations.test.ts` new
- `src/components/Docs.tsx` the open question paragraph
- `README.md`, `files.md`, `changelog.md`, `task.md`

## Edge cases

- Signed in ask whose reply is `open`: has an answer block, so the note stays off. `answerStatus` is set on every signed in row once judged (pending, then streaming or done, or skipped on a hold), so the guard is exact.
- Masked or hidden rows: no note, the reader cannot see the ask.
- `statement` replies: no note. The line is about questions; a statement gets no chip today and keeps that.
- Rows without `reply`: no note until the backfill runs. The backfill only touches live rows with `judged: true`.
- The composer link on `/a/:id` goes home; on the home page it is a plain hash anchor that also focuses the textarea.
- Backfill on a row that was deleted between page and patch: `setReply` returns without writing.

## Verification

- `npm run typecheck`, `npm test`
- `npx convex dev --once` pushes the migration functions
- `npx convex run migrations:backfillReply '{"dryRun":true}'` prints how many live rows lack a reply
- Browser on dev: a visitor ask "who is president" shows the line on the wall card, in Yours, and on `/a/:id`; signed in the quiet line shows; a yes or no ask shows nothing new.

## Task completion log

- 2026-09-22 07:45 UTC PRD written.
- 2026-09-22 07:58 UTC Shipped to dev. `OpenAskNote` on the wall, Yours, and `/a/:id`; `.nudge` shared style; `backfillReply` with `pageLiveWithoutReply` and `setReply`; four tests. Browser on dev: the line renders on six wall cards and the Yours row, the composer link centers and focuses `#ask-jev`, the ask page shows it above the follow up card, dark theme and 375px clean. Backfill on dev: dry run 32 scanned and 4 missing, real run fixed 4 in one page, dry run now 0, row token fields unchanged. Signed in variant not checked in the browser. Typecheck and 38 tests clean. Not deployed.
