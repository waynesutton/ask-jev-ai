# Jev says: answer the question

Created: 2026-09-17 05:46 UTC
Last Updated: 2026-09-17 05:52 UTC
Status: Done

## Problem

The app is called Ask Jev anything, but Jev never answers the ask. The toggle shows how the message feels and what it is about. Type "will the sun come up tomorrow" and nothing on the card says yes.

## Proposed solution

Add one Choice question, `reply`, to the same request. Jev already reads the message once; a sixth question runs in parallel with the other five and costs a few extra input tokens, no extra latency.

Options, with a no match outcome as the TypeSafe docs recommend:

- `yes` A yes or no question whose honest answer from common knowledge is yes
- `no` A yes or no question whose honest answer is no
- `depends` A question that cannot be settled from common knowledge: personal, unknowable, or a matter of taste
- `open` A question that wants more than yes or no (what, why, how, who, which)
- `statement` Not a question

Store `reply` and `replyConfidence` on the message. Expose them in `answers`. Show "Jev says" as the first row of the toggle, and as the first chip on wall cards when the reply is yes, no, or depends.

Display copy:

| reply | toggle | card chip |
| --- | --- | --- |
| yes | yes · 97% sure | JEV: YES |
| no | no · 90% sure | JEV: NO |
| depends | it depends · 70% sure | JEV: DEPENDS |
| open | not a yes or no question | none |
| statement | that is not a question | none |

Copy in How it works moves from five questions to six.

## Files to change

- `convex/questions.ts` add `reply`, `REPLIES` labels
- `convex/judge.ts` pass through `reply`, `replyConfidence`
- `convex/schema.ts` two optional fields
- `convex/messages.ts` add to `jevAnswers` and `toAnswers`, optional so old rows still render
- `src/components/JevAnswers.tsx` first row
- `src/components/Wall.tsx` first chip
- `src/components/HowItWorks.tsx` six questions
- docs

## Edge cases

- Old rows have no `reply`. Toggle skips the row; card shows no chip.
- Jev returns an option not in the list. Map to statement wording, never crash.
- Confidence spreads across yes and no on a coin flip question. The percent shows that honestly. No threshold, no policy: this is display only.

## Verification

- `npm run typecheck`.
- Post "will the sun come up tomorrow" and expect yes. Post "can pigs fly" and expect no. Post "my dog learned a trick" and expect the not a question row and no chip.

## Completion log

- 2026-09-17 05:46 UTC PRD written.
- 2026-09-17 05:52 UTC Shipped and verified against the dev deployment. "can pigs fly" no · 100% sure, topic humor, 304ms. "will the sun rise tomorrow" yes · 97% sure, 181ms. "what should I cook tonight" not a yes or no question, no chip, 155ms. Per message cost moved from $0.000032 to $0.000041 for the extra question. Old five question rows render with no Jev says row. Prod needs `npm run deploy` to pick up the new question.
