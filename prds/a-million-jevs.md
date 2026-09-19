# A Million Jevs: rename and hard profanity block

Created: 2026-09-17 05:13 UTC
Last Updated: 2026-09-17 05:20 UTC
Status: Done

## Problem

Two things.

1. The app is named Five to Million and its copy talks about kids and classrooms. It is not a kids product. It is a demo of Jev (TypeSafe) and Convex where every message is five words.
2. The only word gate in code is the safe-words allowlist. That list is human verified but still contains words like hell, kill, hate, stupid, drunk. It also has no notion of obfuscated profanity. Anything crude must never be typed into a post, posted, or shown anywhere in the app. Today a crude word shows up as a plain chip under the input until the user deletes it.

## Root cause

The allowlist answers "is this a normal English word" not "is this offensive". Those are different questions. The app needs both a blocklist (profanity, slurs, sexual terms) and an allowlist (plain vocabulary), in that order, before Jev ever sees the sentence.

## Proposed solution

Rename to A Million Jevs. Update every user facing string, the HTML title and description, package name, and docs. Drop all kids and classroom language. State plainly in the How it works section that this is a demo, not a kids app, and that safe-words is there to keep the wall clean.

Add a profanity blocklist using the `obscenity` npm package (English dataset plus recommended transformers, which catch leetspeak and spaced out letters). It runs in the browser for instant feedback and again on the server for enforcement, same as the allowlist.

Order of gates for each post:

1. Blocklist. Any match masks the word as `***` in the chips, disables Post, and shows "That word is not allowed here". The server throws the same message if a tampered client sends it.
2. Allowlist. Unchanged. Off list words show as a red chip with the word visible, since off list is not the same as offensive.
3. Jev. Unchanged. Five typed questions, block on any hazard at or above the threshold.

Add five demo words to the allowlist in code: jev, jevs, convex, typesafe, demo. The safe-words list does not have them and a demo called A Million Jevs must let people type "jev".

The input box itself keeps what the user typed. Rewriting a text field while someone types breaks the caret and fights the user. The word never leaves the browser, the chip under it reads `***`, and the post button stays off.

## Alternatives considered

- dwyl/english-words as the allowlist. 479k words including every profanity, so the blocklist would carry the whole load and the five word game gets less interesting. Not used.
- Hand written blocklist in the repo. Nobody wants to maintain that file. `obscenity` is maintained and tested.
- Removing hell, kill, hate, stupid, drunk from the allowlist. Left in. They are ordinary words in most sentences and Jev's is_unkind question is the right tool for context. This is the point of the demo.

## Files to change

- `package.json` name, add `obscenity`
- `convex/lib/words.ts` blocklist check, extra words, `blocked` flag, new parse reason
- `convex/messages.ts` server error for blocked words
- `convex/questions.ts` drop kids and classroom wording from criteria and comments
- `scripts/buildSafeWords.mjs`, `convex/lib/safeWords.ts` header comment wording
- `src/components/Composer.tsx` mask blocked chips as `***`, new count note
- `src/components/Nav.tsx`, `src/App.tsx`, `index.html`, `src/styles.css` name and copy
- `src/components/HowItWorks.tsx` new paragraph and demo note
- `files.md`, `changelog.md`, `task.md`

## Edge cases

- Obfuscated profanity across word boundaries (`f u c k`). Checked on the whole input, not just per word.
- False positives on ordinary words containing a bad substring. `obscenity` ships a whitelist for common ones; the allowlist still runs after, so the worst case is a word gets a `***` chip it did not deserve. Acceptable for a demo; noted.
- Profanity plus wrong word count. Blocked message wins over the count message so the user fixes the real problem first.
- Existing wall data. Only allowlisted words were ever stored, so no cleanup needed.

## Verification

- `npm run typecheck` passes.
- Type a crude word in the composer: chip reads `***`, Post disabled, note reads "That word is not allowed here".
- Type `f u c k` spaced out: same result.
- Type `a million jevs are here`: five green chips, Post enabled.
- Send a blocked sentence straight to `messages.send` from the dashboard: mutation throws.
- Page title, nav, hero, how section, footer all say A Million Jevs or the new copy. No "kid", "child", "classroom" anywhere in `src/` or `convex/` outside the generated word list.

## Completion log

- 2026-09-17 05:13 UTC PRD written.
- 2026-09-17 05:15 UTC `obscenity` installed. Matcher sanity checked: catches sh1t, fuuuck, F U C K; no false positive on "class assistant".
- 2026-09-17 05:17 UTC `words.ts` rewritten with blocklist, `MASK`, `EXTRA_WORDS`, `hasBlockedText`, `blocked` reason. `messages.send` throws "That word is not allowed here". Composer masks chips and disables Post. Single letter chips masked together when profanity is spread across words.
- 2026-09-17 05:18 UTC Rename and copy: Nav, index.html, App hero, HowItWorks (three gates, demo note), styles comment, package name. Kids and classroom wording removed from questions.ts, buildSafeWords.mjs, safeWords.ts header.
- 2026-09-17 05:20 UTC Verified. Typecheck clean. 11 parser cases pass (temp script, removed). Browser: `this sh1t is a test` shows `THIS *** IS A TEST`, Post disabled, note "That word is not allowed here". `a million jevs are here` posts, Jev returns CALM, other, 289ms, $0.000032.
