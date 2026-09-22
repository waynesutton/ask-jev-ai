# Changelog

All notable changes to this project are documented here. Format follows Keep a Changelog. Dates are UTC.

## [Unreleased]

### Fixed (2026-09-22, human error copy on prod, and LinkedIn `in/name`)

- Saving a profile on prod showed `[CONVEX M(profile:update)] [Request ID: ...] Server Error Called by client`. Two things stacked. The server had thrown a plain `ConvexError("LinkedIn should be a username, like @name")` because `in/waynesutton` was rejected, even though the field's own placeholder reads `in/username`. And on prod Convex replaces `error.message` with that wrapper and carries the real sentence in `error.data`; every catch site read `.message`, so people saw the wrapper. Dev was unaffected because `.message` includes the text there, which is why it never showed up before.
- New `src/lib/errors.ts` with `userMessage(error, fallback)`. A `ConvexError` with string data returns that sentence. Anything else (a bug, a limit, a dropped connection) logs the raw error to the console, request id included so it can be matched against the dashboard logs, and returns a short fallback such as "Could not save your profile. Try again". Wired into the eight catch sites: profile save, visibility, photo upload, account delete, vote, post, follow up, and admin user status.
- `handleLink` in `convex/profile.ts` strips a leading `in/` for any social field, so LinkedIn accepts `in/name`, `@name`, `name`, or the full URL. Reproduced the failing save with `convex-test` against the exact fields from the screenshot before the fix and confirmed it saves after.
- `src/lib/errors.test.ts` covers both branches of `userMessage`.

### Changed (2026-09-22, Yours is one card that clears itself)

- Yours under the composer shows your newest ask only, not the last three. The card has a head row with the "Yours" label and an X (`Close this card`, 28px hit area, `--ash` on hover, the global focus ring on keyboard). A new ask replaces the card; the X closes it; the closed id goes to `localStorage` (`jev:yours-dismissed`) so a reload does not bring it back. State still hides it when storage is blocked.
- Signed in, the card stays until you close it or ask again. A note under it reads "Kept in your history with every ask before it." and links to `/me#me-asks`.
- Signed out, a live ask is already on the wall, so the block leaves on its own. A 1.5px hairline under the card drains from the right over four seconds (`yours-drain`, duration set from `FADE_MS` in the component), then the whole block steps 20px toward the wall, shrinks a hair, and fades (`yours-leave`, 480ms). Hover or focus anywhere on the block pauses the clock; the note says so on pointer devices and hides that line on touch. `prefers-reduced-motion` gets a 240ms opacity fade and no travel. Held back and failed asks do not fade: one never reaches the wall, the other has Retry.
- `Latest` is its own component keyed on the message id, so a new ask mounts fresh with a full drain and no leftover leave state. Animation end handlers check the animation name, since the confidence bars and the judging dot end their own animations inside the card.
- Checked on dev: visitor card drains and leaves at about 4.5s, the id lands in storage, the X works on both paths, a signed in card sits past six seconds with the history link and no hairline, and the linked section on `/me` holds the ask. Throwaway account deleted through `/me` (08:37).

### Changed (2026-09-22, Docs becomes About, one page top to bottom)

- `/about` replaces `/docs`. The page opens with the same How it works section the home page renders, then a ruled docs band with the long version under it. The band sits on the how grid's two columns (`minmax(240px, 3fr) 9fr`): the sticky contents rail under the head, the 720px reading column under the cards, so the page reads as one ledger. Band head: mono label "Docs", "How it works, in full.", last updated, the lede. The rail stacks into a wrapped row at 1100px, where the how head stacks too.
- `HowItWorks` takes a `variant`. On `/about` the heading is the page h1, step titles are h2, the pill reads "Read the full docs" and is a plain `#docs` anchor, and `how--page` drops the rule above the section since the top row already opens the page. Home is unchanged in look: h2 and h3, the pill still reads "Read the docs" and now routes to `/about#docs`.
- Hero nav and colophon say About and go to `/about`. `/docs` still resolves: the page rewrites the address to `/about#docs` and lands on the band. A client side push does not scroll to a hash on its own and the router scrolls to the top first, so `About` scrolls to `location.hash` once it mounts. The docs copy "This page is the long version of How it works" now points at the section above. Last updated on the band moves to September 22. `Docs.tsx` renamed `About.tsx`; the `.docs__*` classes stay for the band. Checked on dev at 1440, 1024, and 375, both landing paths, no horizontal overflow (08:30).

### Added (2026-09-22, design system notes)

- `.interface-design/system.md`. The two skins and their token contract, the surface shift depth strategy (no shadows, move one step on the token ladder instead), and the reusable patterns from the How it works build with their measurements: step cards with a 184px stage and a 24px bleed, ruled rows with an 88px mono label, link chips, number pairs, the verdict chip and its quiet tag. Also the copy rules for UI. Agents read it before UI work so the next section matches the last one (08:05).

### Added (2026-09-22, the open question line, and a reply backfill)

- An anonymous ask Jev read as `open` ("who is president", "what is jev") used to show nothing about it: no verdict chip, no answer, just mood, topic, and cost. New `OpenAskNote` fills the answer slot on the wall card, under Yours, and on `/a/:id`. Visitors read "Jev read this as an open question, not a yes or no. Sign in and a model Jev picks answers it, or ask something Jev can settle with yes or no." Sign in carries `?next=/a/:id`; the second link puts the caret in the box on the home page and routes home from anywhere else. Signed in readers get a muted one liner saying the ask was made signed out, so no model answered. The guard is `answerStatus` undefined, which only an anonymous row has once judged, so a signed in open ask keeps its answer block and nothing else. The inline nudge in Yours is gone; it was the same line on one surface (07:58).
- `.yours__nudge` became `.nudge`, shared by the three surfaces, with dotted link underlines matching the follow up link and a faint rule for the muted version.
- `migrations:backfillReply`. Rows judged before 2026-09-17 05:52 UTC have no `reply`, so no surface could say anything about them. The action pages live judged rows without a reply, asks Jev the one `reply` Choice per row (about $0.00003), and writes reply, confidence, and runner up. Tokens go on the global counters; the row's own token fields stay so its per card cost does not move. `{"dryRun":true}` counts without a call. `limit` caps a run and the log prints the cursor to resume from. Idempotent: a row that gained a reply between page and patch is skipped. Ran on dev: 32 live rows scanned, 4 missing, 4 fixed, dry run now reports 0. Prod has not been touched; run the dry run there after the deploy to see the count.
- `convex/migrations.test.ts`, four cases with `convex-test` and the sharded counter registered: dry run, a real fill with only the `reply` question in the body, the limit stop with its resume cursor, and a Jev failure counted without a write.
- `/docs` open question paragraph and the README feature line name the three surfaces and the way back to the box; README scripts section gains the backfill commands.

### Changed (2026-09-22, How it works as three step cards)

- The three centered paragraphs (about 330 words) and the seven fact cards are replaced by a head and three step cards. Head on the left: label, heading, a two sentence subheading, a "Read the docs" pill to `/docs`, and an "AI Gateway docs" ghost to the gateway overview. Cards on the right, each opening with a stage built from the app's own primitives: 01 "Ask. Jev judges." shows a wall card in miniature (the ask, the `Jev: depends · 71%` chip, the quiet `leaning yes` tag, the topic chip, latency, and the two "How sure was Jev" bars); 02 "Jev picks the lane." lists the four lanes from `ROUTES` with `explain` lit, a `picked` tag, and each model label, so a lane change shows up without a copy edit; 03 "The answer streams to every tab." shows the model line with the pulsing dot, a streamed sentence with a blinking caret, and three small tabs that light in turn. Under the stage: number, title, two or three plain sentences, one link out (Decisions with Jev or Jev at TypeSafe by `provider`, Models on the gateway, Realtime in Convex).
- Two ruled rows under the cards. "Built on" carries every outbound link as a mono chip: Convex AI Gateway, Decisions with Jev, Agent component, Convex Auth, Rate limiter, Sharded counter, Static hosting, Convex. The numbers row carries what the fact cards used to: length, rate, models and providers, Jev's price, each imported from the constant the server enforces (`words.ts`, `limits.ts`, `questions.ts`, `pricing.ts`).
- New `--stage` token in both skins for the inset well at the top of each card: `#d9d9d5` in light, a hair under canvas so the well reads as inset rather than cut through to the page; canvas in dark where the hairlines carry the edge. The caret blink, the dot pulse, and the tab pulse all stop under `prefers-reduced-motion`. `.facts` and `.fact` rules removed. Breakpoints: 1100px puts the head above the cards, 800px stacks the cards, 520px stacks the numbers. Checked at 1440 in both skins, 1024, and 375 (07:58).

### Changed (2026-09-22, who can read a thread, said before you type)

- One rule, stated everywhere it matters: a thread follows its ask. The asker's follow ups on a wall ask are public, like the ask; on a private ask they are private; everyone else's follow ups are private to them and the admin. `FollowUp.tsx` takes `visibility` and `author` from the card and `laneTip` picks the tooltip for the signed in verb: owner of a public ask, owner of a private ask, or another viewer. The visitor tip now says the thread is one only you can read.
- `/a/:id`: the asker's thread gets a head with a title ("Your thread" or "The asker's thread") and a `{visibility} thread` tag with a tooltip. The composer note under it says public or private before the first character. The side thread copy reads "only you and the admin can read" in place of "only you see".
- `/docs` gets a paragraph on the rule, why other people's follow ups have no public option (they skip Jev and the word gate, so they stay off the wall), and where the tooltips say which case applies. Privacy adds the sentence that your follow ups on your own public ask are public. Two paragraphs rewrapped, no copy change.
- The sign up note and the README follow up bullet say the same thing in the same words: a thread on someone else's ask is one only you and the admin can read, and a thread follows its ask. Checked on dev with two throwaway accounts, then deleted them (07:26).

### Fixed (2026-09-22, follow up link ran past the card in Safari)

- `.followup__link` forbade wrapping. "Sign in to ask follow up questions" is 34 mono characters plus the icon; Safari sets DM Mono a little wider than Chrome and phones bump the mono a size, so the line poked out of the wall card. The link now wraps like any other line, the chat icon pins to the first line (`margin-top: calc((1lh - 12px) / 2)`, `0.2em` where `lh` is not supported), and the second line indents under the text. Checked at 390 and 320px (07:09).

### Added (2026-09-22, support link)

- `Support` in the home colophon after Source, opening the repo's issue tracker at `https://github.com/waynesutton/ask-jev-ai/issues` in a new tab. Same mono line, same dot separators, same arrow glyph as the other outbound links (07:06).

### Changed (2026-09-22, top row pills and the "for real" line)

- Sign up and Sign in in the top row are now the same box. Sign up was a `ghost--small` (4/12 padding, caption type, 1.5px border) beside a `pill--small` (8/16, body-sm, no border), so the filled pill sat 3px shorter and narrower than the outline next to it. One rule on `account__signup` and `account__signin` sets the border, padding, and type for both; the pill's border is its own ink so the fill looks unchanged. The 520px override that gave the two different padding now sets 8/12 on both (07:02).
- The "for real" line under the headline grew from 0.22em to 0.32em of the display size, margin pulled in a touch, so it reads as part of the joke rather than fine print. Same face, same colour, still flush right under the comma.
- Visitors now read `for real after login`, and the line is a link to `/sign-up`. Same type and colour at rest, an underline on hover and focus. Signed in accounts see the plain `for real`. Still one h1, so a screen reader hears the whole promise as one heading.

### Fixed (2026-09-22, canonical and share card URLs)

- `index.html` canonical, `og:url`, `og:image`, and `twitter:image` now point at `https://www.askjev.ai` instead of the raw Convex site host. The custom domain has been live since the domain work and the apex redirects to www, so search engines and link previews were being told the wrong home. Ships with the next `npm run deploy` (03:30).
- `<title>`, meta description, `og:title`, `og:description`, and the X card now describe the current product: the verdict in about 100 milliseconds, then sign in and Jev picks one of four models for a short answer through the Convex AI Gateway. The old copy sold the visitor only wall. Title is "Ask Jev anything, for real", the same line the home route sets on `document.title`. The image itself (`public/og.png`) still shows the old hero; regenerating it from `scripts/og-card.html` is a separate task (03:35).
- `prds/deploy-accounts-oauth-gateway.md` rewritten as eight phases with a gate after each, a "have these ready" list, and an "if it breaks" table with the fix already decided.

### Changed (2026-09-21, Jev through the Convex AI Gateway)

- Convex shipped the AI Gateway with a Decisions endpoint for Jev, so the judge now runs through it by default. `convex/lib/jev.ts` posts the same System One body to `POST https://ai-gateway.convex.dev/alpha/decisions` with model `typesafe/jev-1.13` on a `getServiceToken("ai-gateway")` token. No TypeSafe key to store, and Jev's usage lands on the Convex bill beside the model answers. `JEV_PROVIDER` unset means gateway first; `typesafe` pins TypeSafe direct first. Whichever is primary, the other is tried once on failure when configured, so a gateway outage or a bad key never takes the wall down. `JEV_GATEWAY_URL` is now an optional override of the endpoint instead of a required path. The gateway reports cost in USD on the response and `askJev` returns it as `costUsd`; the counters keep pricing from tokens so both paths add up the same way (01:20).
- `JevUnavailableError` in `lib/jev.ts` and a matching branch in `judge.run`. When the gateway refuses the deployment (`AiGatewayDisabled`, `AiGatewayUnavailable`, free plan, anonymous local backend) and no `TYPESAFE_API_KEY` is set, the ask publishes unjudged at once instead of burning retries.
- `@convex-dev/ai-sdk-provider` to `^0.2.1`, the release that carries `convexGateway.evaluationModel()`. The judge stays on `fetch` because System One's Choice, Score, and Noul types map to the Decisions body unchanged and the app already types the response.
- Copy. Hero line reads "Jev online · Convex AI Gateway" or "Jev online · TypeSafe" from `stats.gate`. How it works: the Judge card names the live provider and links to the Decisions docs; the gateway paragraph says Jev goes through it too. `/docs`: a paragraph under "How Jev picks the model" on the Decisions endpoint and the fallback, plus the stack and data rows. Privacy: the TypeSafe paragraph says ask text reaches Jev through the gateway by default. `JEV_GATEWAY_MODEL` moved to `lib/typesafe.ts` so the docs page can import it without pulling `convex/server` into the browser bundle.
- `convex/jev.test.ts`, nine Vitest cases with `getServiceToken` and `fetch` mocked: provider order with and without a key, the exact Decisions URL, headers, and body, the URL override, gateway 503 to TypeSafe, gateway error with no fallback, unavailable with no key, and TypeSafe pinned first with the gateway catching its failure.
- Verified on dev. Visitor ask "is the sky blue on a clear day" judged through the gateway in 217ms, row `judgeProvider: "gateway"`, `reply: "yes"` at 0.99. `JEV_GATEWAY_URL` pointed at a bad path on purpose: the log shows `Jev gateway failed, falling back to typesafe` with the gateway's own 400 naming `/alpha/decisions` as a supported route, and the next row says `judgeProvider: "typesafe"`, live, `no` at 0.98 in 357ms. Override removed. Hero reads "Jev online · Convex AI Gateway", the Judge card "Jev via Convex AI Gateway". Typecheck, tests, and `convex dev --once` clean. Not deployed.

### Added (2026-09-21, brand mark and logo)

- A high resolution mark and logo in `public/`, drawn from the favicon and the share card. `icon.svg` and `icon.png` (1024) are the ember stat card with the real Archivo ExtraCondensed Black J (wdth 62, wght 900) in obsidian, plus a sulfur period: Jev answers, then stops. The three colors are the three the light theme already owns. The glyph group stays inside the central 60 percent so GitHub's circle avatar crop keeps it whole; checked at 64 px and in a circle mask. `logo.svg` and `logo.png` (3000 wide, transparent) put the mark at 200 px beside "Ask Jev" in the same face, word space pulled in 35 percent for the compressed cut. Every glyph is a filled path built from the variable font with fonttools and fontkit, so nothing depends on a web font at render time (02:55).

### Added (2026-09-20, local Google and GitHub sign in)

- Undeployed Auth v2 OAuth components and provider callbacks. Verified emails link to the same account; the admin email, blocked emails, and stale/deleted accounts are refused. Optional provider metadata preserves legacy password accounts and removes password controls from OAuth-only settings.
- Google/GitHub buttons on sign in and sign up, global flow errors, safe follow-up return paths, a Sign in pill and Sign up link, and password-only admin access. Updated account/privacy copy and documented the five OAuth environment variables.
- Twenty-three local OAuth identity/redirect tests, typechecked component bindings generated without deployment, and mobile light/dark UI verification. Separate dev and production clients exist. Both provider ID/secret pairs and each environment's allowed origins are saved and privately verified in Convex. Production callbacks are verified, and Google consent is External/In production. Live OAuth verification remains pending. Both localhost ports currently fail because the dev backend has no OAuth start functions deployed. No deployment performed.

### Added (2026-09-20, handoff note for Google and GitHub sign in)

- `setup-off-Google-GitHub.md`, a Computer Use walkthrough for adding Continue with Google and Continue with GitHub beside email and password, on dev and then prod. Covers the Auth v2 alpha OAuth provider as shipped in `@convex-dev/auth@2.0.0-alpha.2` (two `oauth` component installs with their own `httpPrefix`, `setupGoogle` and `setupGithub`, `startSignIn*` and `completeSignIn*`, `oauth()` in `ambientSignIns`, `useSignInWithGoogle` and `useSignInWithGithub`, `useOauth().flowError`), account linking by verified email in the app's `createUser` callbacks, refusing the admin email on both providers, the header `Sign in` pill with a `Sign up` link, the Google console and GitHub OAuth app steps, the env vars per deployment, a fourteen step verification list, and a leak check. The file names deployments and console accounts, so it is in `.gitignore` next to the domain handoff (03:45). No code changed in this entry.

### Added (2026-09-20, follow up threads on every ask)

- Every live card grows a follow up link in its foot: wall, `/a/:id`, `/:handle`, `/me`, and the Yours strip. Signed out it reads "Sign in to ask follow up questions" and carries `?next=/a/:id`, so `SignIn` lands you back on the ask with the composer focused once you are in. Signed in it reads "Ask a follow up" and opens `/a/:id#follow-up`, which focuses the composer on mount. One `FollowUp` component; the old "Open thread" link in `AnswerBlock` is gone (02:00).
- Anyone signed in can follow up on any live ask, not just their own. The owner keeps the public thread that already existed. Everyone else gets a **side thread**: private, one per person per ask, opened on the first send. The model Jev picked for the ask answers, with a system note carrying the ask text, Jev's verdict and confidence, and the short answer when there is one, so a visitor's yes or no ask can be asked "why" with the same context. New table `threads` (`messageId`, `userId`, `threadId`, `model`, `count`, `lastAt`) with `by_message_and_user`, `by_message`, `by_threadId`, and `by_user`.
- `answer.followUp` picks the lane on the server through `laneFor`: `own` when you posted the ask and its answer is done, `side` for everyone else, null when the ask is held, hidden, or masked. Side thread sends use the same `answer` and `answerDaily` buckets and the same 60 word cap. `answer.reply` takes an optional `system`. `answer.listMessages` reads through `readAccess`: the owner's thread is public when the ask is; a side thread opens only for its owner and the admin. `messages.get` returns the viewer's `followUp` lane so the page renders without a second round trip.
- `/a/:id` shows up to two lanes. The asker's thread, read only for everyone but the asker, then "Your follow ups" with the model label and its own composer. Visitors see a card that explains the feature and links to sign in with `next`. A paused account sees why the composer is gone.
- A "Follow ups" section on `/me`, after Your asks, lists the side threads you opened, newest activity first, with the ask text, turn count, model, and a Continue link; a `closed` tag when the ask was hidden after you opened it. Anchor row gains a fourth link. `answer.myThreads` feeds it.
- Cleanup: deleting an ask from `/me` or the admin deletes every side thread on it; deleting an account deletes the side threads it opened (`deleteSideThreadsOn`, `deleteSideThreadsFor`). Agent component threads go with them.
- The wall's `hasThread` now means the asker actually followed up. A new `followUps` counter on the message row is bumped in the owner lane, and "Read the thread" only appears once it is above zero. Before, a thread with nothing but the ask and its short answer showed the link and opened to an empty block.

### Added (2026-09-20, how sure was Jev, votes, and a copy link)

- The verdict chip carries Jev's confidence everywhere a card shows up: wall, `/a/:id`, `/:handle`, `/me`, and the Yours strip. `Jev: yes · 94%` is one read. Under 60% a quiet `close call` tag sits beside it. Rows judged before confidence existed keep the plain chip. One `VerdictChip` component replaces the four copies of `replyChip` and a bare `tag` span (01:15).
- Jev's runner up is stored with every verdict. The Choice answer already returns a probability for each option, so `judge.run` takes the best one that is not the pick and passes `replyRunnerUp` and `replyRunnerUpP` through `record`. Zero extra tokens. A `depends` chip now reads `leaning no` beside it when the runner up carried at least 15%, and the fold shows the number. `overrideReply` clears the pair when the admin hand sets a reply. Old rows have no runner up; nothing to backfill.
- "Was Jev right?" Two thumbs under every live yes, no, or depends on the wall and the ask page. One vote per person per ask, `u:<userId>` signed in or `s:<sessionId>` as a visitor, so signing in later does not double count. Same tap takes it back, the other tap flips it. Tallies live on the message row (`agree`, `disagree`) so cards need no join; a `votes` table with `by_message_and_voter` and `by_voter` decides new, flip, or take back. Two sharded counters feed `stats.agreement`, which shows as "Agreed with Jev" in More numbers once the first vote lands. Rate limit: the IP layer plus a `vote` bucket of 30 a minute, capacity 10, per voter. Masked cards and open or statement replies take no vote. `deleteAccount` deletes the account's votes and leaves the tallies. `/me` and `/:handle` rows show a read only "4 of 5 agreed" instead of buttons.
- A Link button on every card, the ask page meta row, and the Profile and Me rows copies `/a/:id`. Swaps to "Copied" for 1.5 seconds; falls back to the selection copy when the clipboard API is blocked and says "Could not copy" if that fails too. Tooltips on both.

### Changed (2026-09-20, the answers block folds to two rows)

- "Show Jev's answers" is now "How sure was Jev", closed by default, remembered per browser under `jev:answers-open` the same way the count panel is. `/a/:id` opens it unless the browser has said otherwise. The block is two rows: "Jev says" with its bar and "Fits the wall?". Mood and topic rows are gone; the chips in the card foot already carry them. A third indented "Runner up" row appears when the reply is depends or the verdict was under 60% and the runner up carried at least 15% (01:15).
- The wall gate only speaks up when it matters. A live ask whose top hazard sat between 30% and the hold line gets a quiet `close to the line` tag whose tip gives the number and the threshold. The harmless majority say nothing. Held cards keep their `held words` tag.
- Docs: the primitives section describes the chip, the fold, the runner up, the two quiet tags, the vote, and the copy link, and says in one sentence that votes measure Jev and never change a verdict. Privacy: one entry under data collected for the vote row.

### Changed (2026-09-19, /me reads settings first, with an anchor row)

- `/me` is ordered Profile, Account, Your asks. Settings were under the full history before, so a long list pushed the handle and password fields a few screens down. Now the two forms come first and the history, which grows without bound, is last (22:45).
- An anchor row sits under the heading: Profile, Account, Your asks, as plain `#` links to `me-profile`, `me-account`, and `me-asks`. The path does not change so the router stays out of it; the browser scrolls and each section has 24px of `scroll-margin-top` so its rule is not flush to the top edge. Same mono link style as the docs contents, ruled above, pulled 16px into the first section so the row sits between two rules. Coarse pointer tap area matches the other mono links. Checked on dev: clicking Your asks lands the section at 24px with the URL at `/me#me-asks` and the page still on the account route.

### Fixed (2026-09-19, form fields on /me and the auth pages have a border again)

- Every text field outside the composer (Handle, Display name, Bio, GitHub, LinkedIn, X, Current and New password, the delete confirmation, and the sign in and sign up fields) draws its own 1.5px rule in `--input-border`, 48px tall, with the focus color on focus. The composer redo moved its border from the textarea to the box around it, and `.auth__input` had been borrowing the textarea's rule, so those fields went flat and an empty one was invisible on the card (22:40).
- The radius is `--radius-small` (16px light, 6px dark), not the 24px card radius. A single line field at 48px with a 24px radius is a full pill and reads as a search bar; the bio textarea keeps the card radius since it is a taller box like the composer.
- Empty fields keep the native caret. The composer hides its caret while empty and blinks a drawn one; these fields have no drawn caret, so `caret-color: var(--ink)` stays on in the placeholder state. Checked on `/sign-in` and `/me` in both themes.

### Changed (2026-09-19, the count panel folds and the wall clears the fold)

- The orange panel keeps the count, the bar, the percent and held line, then three rows people quote: Jev spend, To one million, At this pace. Everything else (Per message, Tokens in, Model answers, Answer spend, Per answer, On the clock, and the clock footnote) sits behind a "More numbers" row that opens to "Fewer numbers". Closed by default, remembered per browser in `localStorage` under `jev:numbers-open`. The toggle is ruled like a stat row with the same caret as the wall's Show Jev's answers, `aria-expanded` and `aria-controls` set, and a 40px tap area under `(pointer: coarse)` (22:29).
- `.hero` no longer has `min-height: 100vh`. That rule made the hero fill the screen no matter how short the panel got, so the wall header was always a screen down. Now the hero ends where the panel ends, the hero bottom padding is 48px, and `#wall` gets 48px of top padding instead of 80. At 1440 by 900 the panel ends at 682px and "The wall." sits at 814 to 890, above the fold. The mobile rule that undid the min height is gone with it.
- `roughDuration` past a year returns `~2.5y` under ten years and `~257y` after, not `~256y 181d`. The day count was noise and the wide value wrapped the "At this pace" label to three lines in dark mode, where the display face is wider. Stat labels are `nowrap` so the value shrinks first.

### Fixed (2026-09-19, the whole UI on a phone)

- Walked every route at 375px: home signed in and signed out, `/docs`, `/me`, `/:handle`, `/a/:id`, and the account menu. Nothing scrolls sideways on any of them (22:10).
- Top row under 800px: nav on the left, avatar and theme toggle on the right of the same line, the Powered by credit on its own line below. `.hero__left` becomes `display: contents` so the three pieces reorder as flex children. Each credit link and its arrow are `nowrap`, so the arrow never lands alone on a line. The 520px rule that dropped the nav divider moved up into the 800px block.
- Composer bar on a phone: "Enter sends, Shift Enter for a new line" is now its own span (`composer__keyHint`) hidden under 800px. The soft keyboard has no send key, and the hint was wrapping the count to three lines. The visitor placeholder is "Ask something Jev can settle"; the long version wrapped to a second line that an empty textarea does not grow for, so it ran into the bar. The note under the box still says yes, no, or it depends.
- Docs tables: headers and model ids wrap under 640px, so the price table (466px wide with `nowrap`) fits the column instead of scrolling inside it.
- Profile heatmap: 5px dots and 1px gaps under 640px, so the full year (53 columns) fits a 343px column at 338px, no sideways scroll. Reads like the GitHub mobile heatmap.
- Touch targets. Under `(pointer: coarse)`, the mono text links and toggles (`hero__nav`, credit, theme toggle, back link, docs contents, answers toggle, Open thread, timestamps, composer and lanes links, colophon and legal nav) get 12px of block padding and a matching negative margin, so the hit area grows from 13 to 17px to 38px with zero layout shift. Small ghost pills grow from 23 to 31px. The 16px `?` hints get a pseudo element hit area 40px square. Verified by injecting the same declarations without the media query and measuring: the only movement was the ghost pills, which is the point.
- Every text field is 16px or larger (composer 18px, search and auth 16px), so iOS does not zoom on focus.

### Changed (2026-09-19, hero redo and the gateway credit)

- The fold is three columns again, but each one earns its place. Left, `Lanes`: a bulleted read of what a visitor gets (yes, no, or it depends; 3 to 15 words; 5 asks a minute; every ask on the wall) beside what signing in lifts (any question up to 60 words; Jev picks one of 4 models; the answer streams through the Convex AI Gateway; wall or private; 20 a minute; history and a profile). Signed in, the left column collapses to one list. Center, the composer. Right, the orange counter, untouched. Every number in the lists is imported from the constant the server enforces (21:40).
- The composer is one box, not a pill and a circle. The textarea grows with the text up to about eight lines and then scrolls, the word count sits in the bar at the bottom left, and the Ask button, a fixed 40px pill, sits at the bottom right. The Wall and Private toggle is a segmented control in the header row for accounts; visitors get a "Sign in to ask anything" link there instead. The example questions are gone. Word chips only show once something is typed. The headline is a size smaller, and the fold starts higher so a reply shows below without a scroll on a laptop.
- The Convex AI Gateway is named where an answer comes from: the "Powered by" line in the top row now reads Convex, AI Gateway, and TypeSafe; the Lanes list links it; How it works has a paragraph on what the gateway does for this app (4 models from 4 providers behind one endpoint, Convex holds the keys, a short lived token per action, one bill) and its Answers card reads "Convex AI Gateway · 4 models, Jev picks"; `/docs` explains the same in "How Jev picks the model." Provider and model counts are derived from `ROUTES`, not typed.
- Verified the profile end to end: signed in as a throwaway account, one wall ask and one private ask, then compared `userDaily`, `userUsage`, the four `messages` rows, and the rendered `/:handle` page. Asks 4, answers 4, wall 2, private 2, models 2 and 2, tokens 5,461, spend $0.00093, topics nature 3 and tech 1. The "On the wall" list on the profile shows only the two public asks (21:45).

### Added (2026-09-19, profiles at /:handle and the docs page)

- Profiles live at `/:handle`. `/u/:handle` still resolves. A reserved list in `convex/lib/auth.ts` keeps handles off the app's own routes (`admin`, `docs`, `terms`, `me`, `ask`, and so on), checked when a handle is allocated at sign up and when it is changed on `/me` (21:30).
- The profile page reads like a usage page. Head row with the avatar, the name, a Public or Private pill the owner can click to flip, and Share and Edit buttons. A rail with joined date, user number, links, and bio. Then the numbers: asks, answers, longest and current streak; a year of asks as a heatmap; a segmented bar of how Jev replied (yes, no, it depends, open, statement); the models Jev picked, ranked, with the one line reason; tokens over thirty days as an area chart; asks over thirty days as bars, split Wall and Private for the owner; the top topics; and the live wall asks. Private counts only show to the owner and the admin. A private profile shows all of this to its owner and nobody else.
- New table `userDaily`, one row per user per UTC day with asks, public and private counts, verdict counts, follow ups, answers, Jev and model tokens, latency, spend, and three record fields keyed by reply id, topic id, and model id. Written in the same mutations as `userUsage` (`messages.send`, `judge.record`, `answer.recordUsage`, `answer.followUp`), so a profile is one indexed read of at most 400 small rows, never a scan of asks. `profile.stats` returns the rows and the totals. `migrations.backfillDaily` rebuilt it from existing asks on dev. `deleteAccount` removes the rows.
- `/docs`, the long version of How it works. Thirteen sections: what this is, what happens when you ask, the seven typed questions Jev answers, the visitor rules, what signing in lifts, how Jev picks the model, answers and follow ups, the account page, the profile page, the counter and the cost box, rate limits, what is stored and where it goes, and the stack. Every number on the page is imported from the constant the server enforces (word limits, thresholds, the lane table, the price table, the rate limits), so the page cannot drift from the code. Admin features are not on it. Linked from the hero nav, the How it works section, and the colophon.

### Changed (2026-09-19, ask anything for real)

- The hero reads "Ask Jev anything," with a small mono "for real" set below and to the right. The tag sits on its own line at narrow widths (21:00).
- The copy column now depends on who is reading. Visitors get the three to fifteen word rule, a sign in link, and one line on what signing in lifts. Accounts get the sixty word rule, that Jev picks the model, and that a held term blurs the wall copy but not their own view.
- Signed in asks drop the allowlist and the held terms gate. `parseOpenAsk` in `convex/lib/words.ts` flags profanity instead of rejecting it, and `messages.send` accepts a signed in ask with a held term or a blocklist word and sets `wallHidden`. The row keeps its verdict and its model answer. On the wall, in search, on `/a/:id`, and on public profiles the text and answer blur for everyone except the author and the admin, with a `held words` tag for others and `blurred for others` for the author. The author reads it in full on `/me` and in Yours. Visitor asks are unchanged: a held term still turns the ask away.
- The composer label reads "Ask Jev · up to 60 words" for accounts, the textarea is taller, the placeholder and examples switch to open questions, and the word chips only appear for visitors or when a blocklist word means the wall copy will blur. The Wall and Private tooltips say what blurs. The visitor note under the box names the lifted limit and links sign in.
- Open question nudge. Jev already answers "not a yes or no question" as the `open` reply. When a visitor's ask comes back `open`, the Yours card says Jev read it as an open question and offers sign in for a model answer. No extra call, no extra question; the verdict was in the same 100ms response.
- `heldTerms.isHeldTopic` lowercases and strips punctuation before matching, so "merry christmas?" and "Merry Christmas" read the same.
- `profile.setVisibility` no longer reruns the wall word rule; `wallHidden` is decided at post time. `exportData` returns the owner's text and answers unmasked. Admin rows carry `wallHidden`. How it works names the visitor and account limits side by side.

### Added (2026-09-19, accounts, model answers, profiles)

- Sign up and sign in with an email and password through Convex Auth v2 at `/sign-in` and `/sign-up`. The admin sign up window rule is unchanged; every other email registers freely. Each account gets a sequential user number, a handle from the email, and an avatar letter in the hero top row with a small menu (your asks and settings, public profile, admin for the admin, sign out) (20:20).
- Jev picks the model. A seventh typed question, `route`, sorts a signed in ask into one of four lanes: a quick fact (Gemini 3.5 Flash Lite), an explanation (Claude Haiku 4.5), some reasoning (GPT 5.4 mini), or something recent (Perplexity Sonar). The lane's model writes a short answer through the Convex AI Gateway and it streams in under the ask with the model's name, the one line reason, latency, and cost. Anonymous asks are untouched: same six questions, same speed.
- Wall | Private toggle on the composer for accounts. Wall asks keep the wall rules. Private asks take up to sixty words of anything that is not profanity and never appear on the wall or in search. The box grows into a textarea and the examples switch to open questions.
- `/a/:id`, a page per ask with Jev's verdict, the model answer, and a thread. Follow ups stay with the same model and count toward your asks.
- `/me`: your history with All, Private, On the wall, and Archived filters; per ask Show on wall or Make private, Archive, Delete; profile form (handle, display name, bio, GitHub, LinkedIn, X, photo upload through Convex file storage, public profile switch); change password; export everything as JSON; delete account with a typed confirmation.
- `/u/:handle`, a public profile with photo, user number, joined time, links, and the account's live wall asks. Profiles are private until the owner opts in.
- Signed in rate limits: twenty asks a minute per user and per IP with a burst of ten, up from five. Model answers have their own budget of twelve a minute and two hundred a day per account.
- Cost panel gains Model answers, Answer spend, and Per answer rows once the first answer lands, priced from a per model table in `convex/lib/pricing.ts`. Every stat has a tooltip.
- Admin: the dashboard splits into Asks and Users. Asks gains a Private filter, the author handle and visibility on each row, the model and route, the answer text, and a Hide answer toggle that also appears on wall cards. Users lists accounts newest first with All, Active, Paused, Blocked filters and a search by email or handle; each row opens a drawer with usage (asks, public and private counts, answers, tokens, spend, last ask) and the account's recent asks, plus Pause, Block, and Restore. Blocking hides the account's public asks and records the email in `blockedEmails` so it cannot register again. Paused accounts see a banner and cannot post.
- Tooltips across the app on Radix Tooltip: the sign in link, the composer toggle, the wall author and visibility tags, the answer model, the cost rows, profile fields, and the history filters.
- One door to Jev in `convex/lib/jev.ts`. `JEV_PROVIDER` unset calls TypeSafe with the existing key. `JEV_PROVIDER=gateway` plus `JEV_GATEWAY_URL` routes the same request through the Convex AI Gateway on a deployment service token and falls back to TypeSafe if the gateway fails. The hero and the Judge fact card name the live provider. The switch prompt is in `prds/ask-anything-accounts.md`.
- New dependencies: `@convex-dev/agent`, `@convex-dev/ai-sdk-provider`, `ai`, `@radix-ui/react-tooltip`. New tables: `sequences`, `userUsage`, `blockedEmails`. New message fields: `userId`, `visibility`, `threadId`, `route`, `routeConfidence`, `judgeProvider`, `answerModel`, `answerStatus`, `answerText`, `answerHidden`, answer tokens and latency, `archived`. Two one time migrations in `convex/migrations.ts`, run on dev.

### Changed (2026-09-19, accounts, model answers, profiles)

- Client side routing is a small `useRoute` hook and a `Link` component in place of the pathname `if` chain. Every page except home lazy loads, so the home bundle does not carry the agent, the AI SDK, or the account pages.
- `messages.wall`, `search`, and `stats.mood` read only public live rows through a new `by_visibility_and_status` index. `messages.mine` returns your session's asks and, signed in, your account's asks including private ones.
- The Composer's sign in hint names the lifted limit. The hero copy gains a bold "New." paragraph on model answers and the How it works section gains a paragraph on the four lanes plus Answers and Accounts fact cards.
- `admin.setHidden` now clears `hiddenByBlock` so a manual hide is never undone by a later restore.

### Changed (2026-09-19, terms and privacy cover accounts and moderation)

- Both legal pages now describe the signed in layer before it ships, so the policy is in place the day accounts open. Terms add sections for accounts, public versus private asks, model answers routed through the Convex AI Gateway, account deletion, and a moderation and enforcement section: the admin may hide asks and answers, remove content, pause or block accounts, restore them, change limits, or shut the Service down, at any time and in particular when abuse is believed to be happening, with the reason and time recorded. Privacy splits what is collected into everyone versus account holders, names the model providers as recipients of the ask text and verdict, states plainly what the admin can see, and adds retention and self service export and delete. Both pages say features may arrive after the date and are covered when they do (19:13).

### Added (2026-09-19, terms and privacy)

- Two pages at `/terms` and `/privacy`, linked from a third line in the colophon under "Demo app not associated with TypeSafe AI" together with a link to the source. Both use the app's own type and tokens: the admin top row with a back link and the theme toggle, a compressed heading, a mono last updated line, and sections split by dotted rules. The copy describes this app as the code has it. No accounts, one anonymous id in the browser, the IP read for a one minute rate limit window and not stored on the ask, the ask text alone sent to TypeSafe, every live ask public with no self service delete. The terms name the maintainer, state that TypeSafe AI and Convex, Inc. are third party providers and not parties, and carry the liability cap, indemnity, waiver of legal action, and California law (18:58).

### Security (2026-09-19, review and sign up window)

- A full review of the function API, in source and by probing both deployments without a session. Every admin function refused the call, the wall projection carried no session ids, and the internal functions were unreachable. Two findings were closed (18:40).
- Creating the admin account now needs `ADMIN_SIGNUP_OPEN=1` on the deployment and an empty `users` table. Before this, anyone who guessed the admin email could have registered it first and owned `/admin`. The sign in form shows the "Create the admin account" button only while the window is open and otherwise says how to open it. Once the one row exists nothing can add a second, even if `ADMIN_USERNAME` changes.
- `messages.send` requires a session id of 32 to 64 characters, up from 8. The browser has always sent a 36 character UUID; the floor only shuts out a tampered client that picks a short id someone else could guess and read through `mine`. Stored ids shorter than that are regenerated on load.

### Added (2026-09-19, README)

- A real README for the public repo. Opens with what Ask Jev is and the live URL, then how a message travels from the browser through the word gates, rate limits, the TypeSafe call, and back to every open tab. A stack table links each piece: TypeSafe docs, Convex, the sharded counter, rate limiter, Auth v2, and static hosting components, React, Vite, Phosphor, obscenity, the safe words list, Google Fonts, Cloudflare. Then features, local setup including the anonymous Convex mode, environment variables, scripts, layout, cost math, and credits. Admin is named as a feature only; no route or URL appears.

### Changed (2026-09-19, scrub personal data)

- Email addresses removed from `task.md`. The admin username is now referred to only as the value of `ADMIN_USERNAME`.

### Added (2026-09-17, admin filter and search)

- A tools row on `/admin` under the counts. Left, a segmented filter in mono: All, Live, Held, Hidden, active one filled with ink. Right, an always open search pill reusing the wall search shell. Search runs over every status through the same full text index; the filter applies to the list and to hits alike, so Hidden plus a word finds exactly the pulled rows containing it. Each filter is an index read, with a new `by_hidden` index for the hidden one (09:47).

### Changed (2026-09-17, hide is a blur)

- Hiding a card on the wall now changes one thing: the text blurs. The reply chip, mood, topic, cost, latency, and the Jev answers chart stay where they were, with a mono "hidden by admin" note in the meta row. The dashed border is gone. Server side, hidden rows keep every judgment field and only the words are masked, so nothing readable reaches the browser (09:47).

### Added (2026-09-17, favicon)

- A site icon. The ember stat card shrunk to a tab: ember rounded square with a compressed ultrabold J in obsidian, the same pairing as the Ask button. `public/favicon.svg` is the source, drawn as a filled path so it needs no font and reads at 16px. `favicon.ico` (48, 32, 16) and `apple-touch-icon.png` (180) are generated from it with ImageMagick. Three link tags in `index.html` (09:30).

### Added (2026-09-17, wall search)

- Full text search over the wall. A Phosphor magnifier in a ghost circle sits under the wall intro; click it and it stretches into a pill input matching the ask box. Matches replace the feed, best first, with the count in the label; the X or Escape brings the live feed back. Backed by a Convex search index on `messages.text` scoped to live rows, so results update on their own as new asks land. Rows the admin hid never appear in results (09:16).

### Added (2026-09-17, scroll arrows)

- Two floating arrows on the bottom right of the page, Phosphor `ArrowUp` and `ArrowDown` in ghost circles on a paper fill so they read over cards in both themes. The top arrow appears once the hero has scrolled away; the bottom arrow hides once the colophon is within reach. Hidden arrows fade, slide, and drop out of the tab order. Smooth scroll follows the page setting, so reduced motion makes it instant (09:08).

### Changed (2026-09-17, Jev knows what it is)

- The reply prompt now tells the model in one sentence what Jev is: a judge that answers every ask with yes, no, or it depends, in one call, with no memory, chat, or browsing. Asks aimed at Jev ("do you know", "can you remember") were coming back "not a yes or no question" because the model had nothing to answer from. Verified on dev with no change to ordinary asks (09:04).

### Added (2026-09-17, reply override)

- `messages.overrideReply`, an internal mutation run from the CLI, corrects Jev's reply on a single row and sets its confidence to 1. For the rare ask Jev misread before a prompt fix (09:04).

### Changed (2026-09-17, held topics list grown)

- `HELD_TERMS` on dev now holds 172 terms: explicit sexual terms and phrases from two public word lists, filtered to what the safe list lets through and stripped of everyday words, plus religious names, roles, texts, and the major faiths. `isHeldTopic` matches whole words and whole phrases on word boundaries only; the letters only substring pass was removed because it produced false holds like `eat out` inside `great outdoors`. Verified end to end on dev (08:54).

### Added (2026-09-17, guide above the ask box)

- A one line guide between the label and the input: "Jev answers yes, no, or it depends. Ask something that can be settled that way." followed by three example asks (`is the ocean salty`, `can pigs fly`, `will it rain tomorrow`) as mono text buttons. Clicking one fills the box and focuses it. When a ready ask does not open with a yes or no verb, the count note adds "for a yes or no, start with is, can, or will". Motivated by prod, where about four in ten asks were coming back "not a yes or no question". No backend change, no extra tokens (08:48).

### Added (2026-09-17, held topics)

- A server side list of topics the wall does not host, read from the `HELD_TERMS` environment variable on the deployment. `messages.send` checks the normalized text after the public word gates and the rate limits; a match is stored as `blocked` and never sent to Jev. The poster sees the same "Held back by Jev" line as any other held post, the wall shows nothing, and the admin list has the row. The list is not in the repo or the client bundle (08:37).

### Changed (2026-09-17, prod auth keys)

- Production (`fastidious-oyster-877`) now has its own Auth v2 signing keys plus `ADMIN_USERNAME`. Auth v2 has no `--prod` flag, so the pair was generated and set with `npx convex env set --prod`. Dev keys were left alone (08:35).

### Changed (2026-09-17, bar charts on Jev's answers)

- Jev's answers now read as a small horizontal bar chart instead of "joyful · 95% sure" text. Each row is the question on the left, the answer word in ink on the right, then a 6px band from a shared left baseline with the percent in a fixed width column, so the four bars in a card line up and can be compared at a glance. "Jev says" shows a bar for every reply, including "not a yes or no question". A held "Fits the wall?" row fills the bar in accent and reads as how sure Jev is the post does not belong. Bars grow in over 480ms and stay still under `prefers-reduced-motion`. Drawn in CSS on the existing tokens, no chart library (08:34).

### Changed (2026-09-17, How it works emphasis)

- "is it a yes, a no, or it depends" in the How it works intro is now bold and in ink, so the headline question stands out of the muted paragraph. One CSS rule, `.intro .subheading b` (08:28).

### Added (2026-09-17, admin, IP rate limit, clock)

- Secret admin page at `/admin`. Convex Auth v2 alpha with the username + password provider; the username is the admin email. Sign up is gated in `convex/users.ts`: it throws unless the username matches the `ADMIN_USERNAME` environment variable, so only one account can ever exist. Every admin function runs `requireAdmin`, which compares the signed in user to that same variable. The route is not linked anywhere, `public/robots.txt` disallows it, and the page sets a `noindex, nofollow` meta tag on mount.
- Admin dashboard: live, held back, and submitted counts, then every message in every status with its reply, topic, harm score, and a Hide / Unhide button per row.
- Hidden messages. `messages.hidden` is set by `admin.setHidden`. The public `wall` and `mine` queries mask the text server side (each letter becomes a bullet, word shape kept) and drop reply, topic, cost, latency, and answers. The wall card and the Yours row blur the masked text, switch to a dashed border, and read "hidden by admin". Original text never leaves the server.
- IP rate limit. `messages.send` reads the caller IP from `ctx.meta.getRequestMetadata()` and enforces a fixed window of 5 posts per minute per IP before the per session bucket. Blocked posts return `retryAfterMs` and the composer shows the existing "Slow down" note.
- Clock to one million. `START_MS` (12:31 AM PDT, Sep 17, 2026) in `convex/lib/counters.ts`, returned as `startedAt` by `stats.counts`. The count panel gains two rows under Tokens in: "On the clock", a stopwatch ticking every second since the start, and "At this pace", the time left at the observed rate ("Waiting" until the first live post, "Done" at the goal). A mono caption under the rows names the start time.
- New dependencies: `@convex-dev/auth@alpha`. New env vars on the deployment: `AUTH_PRIVATE_KEY`, `AUTH_JWKS` (from `npx @convex-dev/auth`), `ADMIN_USERNAME`.
- Moderation from the wall. When the admin is signed in, every wall card ends its meta row with a Hide or Unhide pill that calls the same `admin.setHidden`, so moderation no longer requires the dashboard. The hero nav also shows an `Admin` link for that session. Visitors see neither: `useIsAdmin` skips the `admin.me` query unless a session exists (08:26).

### Changed (2026-09-17, admin, IP rate limit, clock)

- Per session limit tightened from 10 per minute to 5 per minute, burst 3.
- `src/main.tsx` wraps the app in `ConvexAuthProvider` instead of `ConvexProvider`. `src/App.tsx` splits into a router shell and a `Home` component so `/admin` can render on its own.
- `convex/convex.config.ts` mounts auth HTTP routes under `/auth` beside the static site at `/` and the app routes at `/api`.

### Changed (2026-09-17, fact cards link out)

- In How it works, the Judge card links to the TypeSafe docs introduction, the Database card links to convex.dev, and the Hosting card links to the static hosting component page. The whole card is the anchor, opens in a new tab, and the value line carries the same arrow glyph as the top row. Value turns accent on hover and focus.

### Added (2026-09-17, section anchors top left)

- Top left of the hero now opens with a mono nav: "The wall" and "How it works", linking to `#wall` and `#how`. A dotted divider separates it from the "Powered by" credit; the divider drops at 520px and below where the credit wraps to its own row. Both sections get `scroll-margin-top` so the anchor lands with room above the heading.

### Changed (2026-09-17, colophon at the bottom)

- The "Demo app built by waynesutton.ai" credit moved out of the hero top row into a centered colophon at the very end of the page, with a second line "Demo app not associated with TypeSafe AI". Top row now holds only "Powered by Convex and TypeSafe" on the left and the theme toggle on the right.

### Changed (2026-09-17, Caldera light mode, no header, no footer)

- Light mode is now Caldera: pumice canvas `#e2e2df`, limestone surfaces `#f7f6f2`, obsidian text `#070607`, one ember accent `#fc5000` for the Ask button and the count panel, sulfur `#f5f28e` for the Jev says tag. Flat: no shadows, no card borders, surfaces layer by color, dividers are 1.5px dotted. Radii 40px on the panel, 24px on cards, 16px on rows, 100px on the input, full pill on buttons.
- Type: Archivo at width 62 and weight 900 for the display, headings, odometer, and stat values. DM Sans 500 for body. DM Mono 12px for labels. Loaded from Google Fonts alongside Inter.
- Dark mode keeps its palette, Inter at 400, hairlines, 8px cards, and the periwinkle Ask button. The blurred gradient wash is gone. Every light versus dark difference lives in the two token blocks at the top of `styles.css`.
- Layout, both themes: no header, no footer. `Nav.tsx` and `Footer.tsx` removed. A mono caption row at the top of the hero carries the Convex, TypeSafe, and waynesutton.ai credits plus a mono theme toggle (`ThemeToggle.tsx`). Four crop marks frame the first screen.
- Hero: centered display headline, then three columns like a poster. Left: `Not a chatbot` label, the copy, Jev status. Middle: the composer and Yours. Right: the count panel with the odometer, progress line, and four cost rows split by dotted rules. No nested cards. The odometer is sized off the panel width with container units so it never overflows in either skin.
- Wall cards trade the 4px mood bar for a mood dot beside the mood word. Wall and How it works open with a mono label over the heading. Section dividers are dotted.
- `public/og.png` regenerated in the new skin from `scripts/og-card.html`. OG alt text updated.

### Added (2026-09-17, custom domain)

- Configured `https://www.askjev.ai` for the existing production Convex app, with Cloudflare DNS, an apex-to-www 301 preserving paths and query strings, and Always Use HTTPS. Verified live HTTPS and backend connection. No app deployment; the newer local design and share card remain unpublished.

### Changed (2026-09-17, stats above the fold)

- Hero is now a two column grid. Headline, subline, and the composer sit left; the odometer, progress line, and the four cost cards sit right in a 2 by 2 grid. Everything is visible without scrolling on a 1280 by 800 laptop. Under 1000px it stacks with the stats directly under the input.
- The separate count section is gone. The "asks so far" line under the composer now shows only Jev status since the number sits beside it.
- Counter and stat values scale down to fit the right column. Hero bottom hairline removed to avoid a double line against the wall.

### Changed (2026-09-17, honest copy)

- Removed the dark top bar. The white pill nav is now the only header. Hero height budget adjusted. `pill--forest` variant removed with it. The powered by credit stays in the footer and How it works stays in the nav links.

- Footer: the safe-words attribution link is gone. Right side now reads "Demo app built by waynesutton.ai" with a link.

- Hero subline, How it works, meta descriptions, and the share card now say what Jev does instead of implying it writes back: "Jev does not write replies. It judges each ask in about 100 milliseconds: yes, no, or it depends, plus mood, topic, and whether it fits the wall." `public/og.png` regenerated. Hero subline max width raised to 640px for the longer line.

### Added (2026-09-17, share card)

- Open Graph and X large image card. `public/og.png` (1200 x 630) rendered from `scripts/og-card.html` with the hero wash, headline, composer card, and "Powered by Convex and TypeSafe". `index.html` gains canonical, `og:*` (type, site_name, title, description, url, image with type, width, height, alt, locale) and `twitter:*` (summary_large_image, title, description, image, alt) tags pointing at the prod site `https://fastidious-oyster-877.convex.site`.

### Changed (2026-09-17, daylight redesign)

- New light default. Off white canvas `#f9f9f9`, white cards, hairline borders at ink 10%, no shadows, no gradients on buttons. Inter at weight 400 everywhere; hierarchy comes from size only. Radii: nav 32px, cards 8px, inputs 4px, buttons pill. Four accents (forest `#00543d`, periwinkle `#abcbf9`, pink `#ffbbfc`, butter `#fce88b`) appear only as 4px left edge bars and filled pills, never as text.
- Dark mode stays as a toggle. `data-theme` on `html`, stored in `localStorage` under `ask-jev-theme`, applied by an inline script in `index.html` before paint. `useTheme` hook plus a Phosphor sun and moon button in the nav.
- Input box in the middle. The hero is a frosted wash of the four accents (CSS radial gradients under `blur(70px)`, slow drift, off under reduced motion) with a centered headline, one line of subtext, and the composer inside a white card. Yours sits under the composer in the same card, trimmed to the last three, answers collapsed by default with Jev's headline answer as a chip.
- Counter moved to its own section under the hero. Cost tracker is now four stat cards with one accent bar each: forest, pink, periwinkle, butter.
- Wall cards carry a mood colored left bar (low ash, flat periwinkle, calm forest, happy butter, joyful pink) with the mood word beside it. The Jev reply chip is a filled periwinkle pill.
- Dark top bar ("Powered by Convex and TypeSafe", forest pill to How it works) and a sticky white pill nav with wordmark, links, theme toggle, and a dark "Ask" pill that focuses the input.
- How it works and footer use centered intros and flat cards. Footer credits are ink links with Phosphor arrows; the ember accent is gone.
- Chips are outlined pills. Relative times are lowercase (`3m ago`).
- Added `@phosphor-icons/react` for ArrowRight, ArrowUpRight, Sun, Moon, CaretDown.

### Added (2026-09-17)

- Jev answers the ask. A sixth question, `reply` in `convex/questions.ts`, is a Choice over yes, no, depends, open, statement. It rides in the same request as the other five, so no extra latency and about nine more input tokens per message ($0.000032 to $0.000041). Stored as `reply` and `replyConfidence` on the message, exposed in `answers` and at the top level of `publicMessage`. The toggle opens with a "Jev says" row (`yes · 97% sure`, `no · 100% sure`, `it depends`, `not a yes or no question`, `that is not a question`). Wall cards show a cream `Jev: yes`, `Jev: no`, or `Jev: depends` chip first when there is a headline answer. Rows judged before this shipped skip the row and chip.
- How it works and the meta description now say six typed questions, including yours.

### Changed (2026-09-17)

- Renamed the app to Ask Jev, up to a million times. Nav wordmark "Ask Jev", page title, meta description, hero line "Ask Jev anything. Up to a million times.", package name `ask-jev`, counter screen reader text.
- Messages are now three to fifteen words instead of exactly five. `MIN_WORDS` and `MAX_WORDS` in `convex/lib/words.ts`, `parseFiveWords` renamed `parseMessage`. Composer note counts up to three, shows "Ready · n of 15" in range, and "n words. Cut n" over. Input `maxLength` raised to 200. Wall cards past eight words render at 18px so long asks do not tower over short ones.
- Composer label "Ask Jev · 3 to 15 words", placeholder "ask jev anything".
- How it works copy reduced to what the app does: type, Jev judges, Convex stores, every tab updates, this is a demo of Jev and Convex. Facts are Length, Judge, Database, Hosting, Price. The word gates are no longer described anywhere in the UI. They still run unchanged in code, and a blocked word still masks as `***` with Post disabled.
- Jev's answers toggle now shows three plain rows: "How does it feel?", "What is it about?", and "Fits the wall?". The three safety probes (unkind, adult, targets a person) fold into that last row. A clear post reads "yes · 98% sure"; a held post reads "no · sounded unkind" (or "not for a public wall", "aimed at someone") so hazard names never sit next to a harmless message.
- Hero and card status strings say "Jev online" or "Jev offline" instead of naming the allowlist. Cost strip projection drops the word "About" so it no longer wraps.

### Added

- Profanity blocklist as gate 1, ahead of the allowlist. Uses `obscenity` (English dataset plus recommended transformers) in `convex/lib/words.ts`, so it runs in the browser for instant feedback and again in `messages.send` for enforcement. Catches leetspeak (sh1t), stretched letters (fuuuck), punctuation (f.u.c.k) and letters spread across words (f u c k). A blocked word renders as `***` in the chips, Post is disabled, and the note reads "That word is not allowed here". The server throws the same message for tampered clients. Nothing crude is ever stored or shown.
- Five demo words added to the allowlist in code: jev, jevs, convex, typesafe, demo.
- Realtime cost tracker. Each judged message stores `inputTokens` and `outputTokens` from the TypeSafe `usage` field. Sharded counters `judged`, `inputTokens`, `outputTokens` feed `stats.cost`, which returns total spend, per message cost, and a projection to one million at the list price of $0.042 per million input tokens (output free).
- Hero cost strip (`CostTracker`) with Jev spend, per message, to one million, tokens in. Wall cards show each message's cost and latency.
- `convex/lib/pricing.ts` holds the price so a sheet change is a one line edit.
- "Show Jev's answers" toggle on every judged card (wall and your own posts). Reveals the five raw answers: three hazard probabilities, mood level with confidence, topic with confidence. Any hazard at or above `BLOCK_THRESHOLD` is highlighted, so a blocked post explains itself. `messages.ts` now exposes an `answers` object on public messages; session ids stay private.

### Changed

- Renamed the app from Five to Million to A Million Jevs. Nav wordmark, page title, meta description, hero line ("Five words. One million messages. Every one judged by Jev."), package name, and docs.
- Dropped all kids and classroom language. How it works now describes three gates and states plainly that this is a demo of Jev and Convex, not a product for kids, and that the word lists exist to keep the wall clean. Jev's `is_adult` criteria now say "public wall" instead of "classroom" and "child".
- Jev's answers are open by default on every judged card. The toggle still collapses them.
- Composer placeholder now reads "type my five words here".
- Removed the vertical "Powered by Convex + TypeSafe" edge label. The footer already carries the credit with links.
- Composer focuses on load for mouse and trackpad users (skipped on touch devices and when the URL has a hash). Label now reads "Say something in five words · start typing here" in cream. Underline is dashed driftwood at rest and solid cream when focused, driven by React state so it holds even in unfocused windows. While the box is empty a CSS caret blinks in place of the native one, so every user sees a blinking cursor on load; the native caret takes over on the first character.

## [0.1.0] - 2026-09-17

### Added

- Five to Million app: a public realtime wall where every message is exactly five words and a counter climbs toward one million.
- Two gates. Allowlist in code using the human verified list from The-Best-Codes/safe-words (12,530 tokens). Jev, TypeSafe's System One model, answers five typed questions per message in one request: is_unkind, is_adult, targets_person, mood, topic.
- Convex backend with `messages` table, paginated `wall` query, `mine` query for the sender's own posts, `send` and `retry` mutations, `judge.run` action with three retries and backoff, `judge.record` mutation applying `BLOCK_THRESHOLD`.
- Official components: `@convex-dev/sharded-counter` for live, blocked, and submitted counts; `@convex-dev/rate-limiter` for per session posting limits; `@convex-dev/static-hosting` to serve the built site from the Convex deployment.
- Graceful no key mode. Without `TYPESAFE_API_KEY` posts publish on the allowlist alone and the UI says "allowlist only". Setting the key flips the gate with no redeploy.
- UI in the ORYZO warm dark editorial style: dim leading zero odometer, hairline progress, underline composer with live word chips, one filled pill button, dashed dividers, ember credits only in the footer.
- Anonymous local development via `CONVEX_AGENT_MODE=anonymous npx convex dev`. No Convex account needed to run.
- `scripts/buildSafeWords.mjs` to regenerate the word list.
