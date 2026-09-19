# Ask shape: steer asks toward yes, no, or it depends

Created: 2026-09-17 08:48 UTC
Last Updated: 2026-09-17 08:48 UTC
Status: In Progress (guide done, either or pick is a proposal)

## Problem

Jev answers the ask with a Choice over five outcomes: yes, no, depends, open, statement. Only the first three are answers. On prod (`fastidious-oyster-877`, 745 submitted, 712 live) the last 60 live asks split yes 9, no 8, depends 17, open 17, statement 9. So 26 of 60, about four in ten, get "not a yes or no question" or "that is not a question". People are asking "what is the lucky number", "who is jev", "what can you do with jev". The app never told them what shape works.

A smaller ask from feedback: either or questions ("blue or red", "you or me") and comparatives ("is it better") also get no real answer. On prod only 2 of 60 asks contain "or".

## Proposed solution

### 1. Guide above the box (done)

One muted sentence between the label and the input: "Jev answers yes, no, or it depends. Ask something that can be settled that way." Then three example asks as mono text buttons, one per answer (`is the ocean salty` yes, `can pigs fly` no, `will it rain tomorrow` depends). Click fills the input and focuses it. Every word is on the safe list.

Under the box, once an ask is otherwise ready, the count note adds "for a yes or no, start with is, can, or will" when the first word is not a yes or no opener (is, are, am, was, were, can, could, do, does, did, will, would, should, has, have, had, may, might). Client only, no cost.

### 2. Either or pick (proposal, not built)

Keep one request per message. The cost flow stays: one `systemOne` call, all questions in parallel, input tokens only.

- In `convex/lib/words.ts`, add `eitherOptions(text)`: split the normalized text on `or`, return the two to four option strings when the ask has that shape, else null. Shared with the browser so the composer can show which options Jev will pick from.
- In `convex/judge.ts`, when options exist, add a speculative `pick` Choice to the same request: instructions "Read `message` as a question offering these options. Pick the one common knowledge favors, or `neither` if it is taste or unknowable.", criteria built from the options plus `neither`. Roughly 40 extra input tokens, only on asks that contain "or". Everything else is unchanged.
- Schema: `pick: v.optional(v.string())`, `pickConfidence: v.optional(v.number())`. Old rows keep working because both are optional.
- `messages.ts` `toAnswers` and `JevAnswers` show "Jev picks red" with a bar when `pick` is set and is not `neither`. `replyChip` gets `Jev: red`.
- Comparatives like "is it better" already resolve to yes, no, or depends through `reply`. No change needed there beyond the guide.

Why not now: 2 of 60 prod asks would use it. Ship the guide first, read the reply mix again after a few hundred asks, and build the pick if "or" asks grow.

### 3. Are the three rows right? (assessment)

- "Fits the wall?" is the safety gate and the reason the wall can be unmoderated. Keep.
- "What is it about?" drives the topic chip and gives the wall texture. Keep.
- "How does it feel?" is low signal for questions. Almost every question scores `flat`, and the "Mood of the wall" line reads flat nearly always. It is not wrong, just quiet. Two options for later, neither urgent: (a) replace the Score with one that fits questions, for example how playful the ask is (serious, curious, playful, silly), which would also make the wall mood line more alive; (b) leave it, since the cost is a few tokens and the row explains what a Score is. Changing it means new schema fields and a new wall mood line, so it is a separate PRD if wanted.

## Files changed

- `src/components/Composer.tsx`: `EXAMPLES`, `YES_NO_STARTERS`, guide paragraph, `useExample`, nudge in the count note.
- `src/styles.css`: `.composer__guide`, `.composer__try`, `.composer__example`.

## Edge cases

- Autofocus on load still lands in the input; example click moves focus there too.
- Examples never trip the blocklist or allowlist (checked against `safeWords.ts`).
- The nudge only shows when the ask is otherwise ready, so it never competes with a count or safe list message.
- A yes or no ask that starts with a name ("jev is you right") gets the nudge. Acceptable; the nudge is a hint, the ask still posts.

## Verification

- Typecheck and prettier clean.
- Browser: guide renders between label and box, example click fills the input and enables Ask, "what should i eat" shows the nudge, "can pigs fly" does not.

## Log

- 2026-09-17 08:48 UTC Guide, examples, and nudge shipped to dev. Either or pick written up as a proposal with prod numbers.
