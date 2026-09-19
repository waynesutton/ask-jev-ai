# Ask Jev, up to a million times

Created: 2026-09-17 05:33 UTC
Last Updated: 2026-09-17 05:40 UTC
Status: Done

## Problem

Three requests in one.

1. The How it works copy talks about the profanity blocklist and mentions kids. Both should go. The site should stay safe for work and public consumption without saying how.
2. Exactly five words is too tight. Allow three to fifteen.
3. Rename the app to Ask Jev, up to a million times. Placeholder becomes "ask jev anything".

## Proposed solution

Copy for How it works, verbatim from the request with the word count updated:

> Type three to fifteen words. Jev, TypeSafe's judgment model, reads the sentence and answers five typed questions in about 100 milliseconds. Convex stores the verdict and every open tab sees the wall move at once.
>
> This is a demo of Jev and Convex.

Facts under it: Length, Judge, Database, Hosting, Price. No gate list, no blocklist, no allowlist.

Word range in `convex/lib/words.ts`: `MIN_WORDS = 3`, `MAX_WORDS = 15`. `parseFiveWords` becomes `parseMessage`. Composer note shows `n / 15 words` while under three, `Ready` in range, `Cut n` over. Input `maxLength` raised to 200. Wall cards drop to body size when a message runs past eight words so a fifteen word card does not tower over the grid.

Rename: nav wordmark "Ask Jev", page title "Ask Jev, up to a million times", hero line "Ask Jev anything. Up to a million times.", composer label "Ask Jev · three to fifteen words", placeholder "ask jev anything", package name `ask-jev`, counter screen reader text "asks".

Blocklist stays exactly as is. It is not named anywhere in the UI. The `***` chip and "That word is not allowed here" note remain, since a user who trips it needs feedback.

## Files to change

- `convex/lib/words.ts` range constants, rename parser
- `convex/messages.ts` error copy, import
- `convex/schema.ts`, `convex/questions.ts` comments
- `src/components/Composer.tsx` label, placeholder, notes, chips, maxLength
- `src/components/HowItWorks.tsx` copy and facts, drop `wordCount` prop
- `src/components/Wall.tsx` long message class
- `src/components/Nav.tsx`, `src/components/Counter.tsx`, `src/App.tsx`, `index.html`, `src/styles.css`, `package.json`
- `files.md`, `changelog.md`, `task.md`

## Edge cases

- Two words: note reads `2 / 15 words`, Post disabled. Sixteen: `16 words. Cut 1`.
- Longer messages cost more Jev tokens. The cost tracker already reads real usage so the projection adjusts on its own.
- Existing wall data is all five words, still valid.

## Verification

- `npm run typecheck` passes.
- Three word post goes live. Fifteen word post goes live and renders at body size. Two and sixteen are refused client side; the server throws for both when called directly.
- Blocked word still masks as `***` and disables Post.
- No "kid", "child", "blocklist", "allowlist", "profanity" in rendered copy.

## Completion log

- 2026-09-17 05:33 UTC PRD written.
- 2026-09-17 05:40 UTC Shipped. Also swapped the three remaining "allowlist" status strings (hero, Yours, Wall) for Jev online or offline, and dropped "About" from the cost projection so it stops wrapping. `--text-body` in this token set is 29px, larger than the card heading, so the long card class uses a fixed 18px. Verified: 3 word and 15 word asks posted and judged live, 16 words refused with "Cut 1", typecheck clean.
