# Ask Jev anything: gateway answers, accounts, profiles

Created: 2026-09-19 19:20 UTC
Last Updated: 2026-09-19 22:45 UTC
Status: Done on dev. Prod deploy and env steps in `task.md`.

Plan: `.cursor/plans/ask_anything_with_accounts_0d3af35d.plan.md`

## Problem

Jev judges. It does not write. About four in ten prod asks were open questions ("what should i cook tonight", "how does this work") that Jev could only mark "not a yes or no question". Visitors wanted an answer. The wall also had no accounts, so nothing was private, nothing had a history, and the one admin account could only hide text.

## What shipped

Anonymous use is unchanged: three to fifteen safe list words, Jev's verdict in about 100ms, five posts a minute per IP and per session, the wall, the counter, the cost rows.

Signed in, the same ask goes through one extra step. Jev answers a seventh typed question, `route`, that sorts the ask into one of four lanes. The lane names a model on the Convex AI Gateway. An action streams a short answer into a thread under the ask, and the wall card or ask page shows the model's name, a one line reason, latency, and cost. Follow ups stay in the thread with the same model.

| Lane      | Model                          | When Jev picks it           |
| --------- | ------------------------------ | --------------------------- |
| `quick`   | `google/gemini-3.5-flash-lite` | wants a quick fact          |
| `explain` | `anthropic/claude-haiku-4.5`   | wants an explanation        |
| `reason`  | `openai/gpt-5.4-mini`          | needs some reasoning        |
| `current` | `perplexity/sonar`             | asks about something recent |

Accounts run on Convex Auth v2 (alpha), username and password, where the username is an email. Each account gets a sequential user number, a handle, and a profile (display name, bio, GitHub, LinkedIn, X, photo through Convex file storage, public or private). Signed in, an ask is up to sixty words of anything, on the wall or private, with no allowlist and no held terms gate. `/me` holds history with filters (all, private, on the wall, archived), per ask visibility, archive, delete, JSON export, password change, and account deletion.

## Ask anything, for real (second pass, 21:00 UTC)

The hero reads "Ask Jev anything," with a small mono "for real" below and to the right. The copy column and the composer switch on sign in state. Visitors get the three to fifteen word rule, a sign in link, and one line on what signing in lifts. Accounts get the sixty word rule, that Jev picks the model, and that a held term blurs the wall copy for others but not for them.

Held terms and the blocklist for accounts. A signed in ask is never turned away for a word. `parseOpenAsk` flags profanity instead of rejecting it, and `messages.send` accepts a held term or a blocklist word and sets `wallHidden` on the row. Jev still judges it and the lane's model still answers. `toPublic` takes the viewer and computes one `masked` flag: admin hidden, or `wallHidden` and the viewer is not the author or the admin. Masked rows blur the text and drop the answer on the wall, in search, on `/a/:id`, and on public profiles, tagged `held words` for others and `blurred for others` for the author. `/me`, Yours, and the JSON export show the author everything. Visitor asks are unchanged: a held term is still stored as `blocked` without a Jev call. `isHeldTopic` now lowercases and strips punctuation first.

Open question nudge. Jev already answers the reply question with `open` when an ask is not a yes or no. When a visitor's ask comes back `open`, the Yours card says Jev read it as an open question and offers sign in for a model answer. No extra call and no extra question; the verdict was in the same response. This is the "auto detect the type of question" feature, built on the primitive the app already had.

Composer for accounts: label "Ask Jev · up to 60 words", a taller textarea, open question placeholder and examples, the word chips only when a blocklist word means the wall copy will blur, and Wall | Private tooltips that say what blurs. `profile.setVisibility` no longer reruns the wall word rule since `wallHidden` is decided at post time. Admin rows carry `wallHidden`. How it works names both limits side by side.

Signed in rate limits lift to twenty a minute per user and per IP, with a burst of ten. Model answers carry their own budget: twelve a minute, two hundred a day, per user.

The admin account is unchanged in how it signs in and keeps every feature it had. It gains an Asks and Users split on `/admin`, a Private filter, the author handle and model fields on each row, Hide answer on rows and wall cards, and a Users tab with search, status filters, a per user drawer with usage (asks, tokens, spend, last ask), and pause, block, and restore. Blocking hides the user's public asks and stores the email in `blockedEmails` so it cannot sign up again.

## Profiles at /:handle and the docs page (third pass, 21:30 UTC)

The ask was a profile page like Cursor's usage page at `askjev.ai/username`, public or private, and a long docs page linked top and bottom.

Address. Profiles moved from `/u/:handle` to `/:handle`. The router matches every fixed route first, so `/docs` or `/me` can never be read as a handle, and `RESERVED_HANDLES` in `convex/lib/auth.ts` refuses those words at sign up and on rename. `/u/:handle` still resolves so old links hold.

Data. A profile page must not scan a user's asks. New table `userDaily`, one row per user per UTC day, written by `bumpDaily` in the same four mutations that already write `userUsage`: `messages.send` (asks by visibility), `judge.record` (verdict, Jev tokens, latency, reply id, topic id, filed under the ask's day so a retry cannot split one ask across two days), `answer.recordUsage` (answers, model tokens, micro USD, model id), and `answer.followUp`. Three record fields keyed by id (reply, topic, model) so the page never joins. `profile.stats` reads at most 400 rows by index, sums the records, and zeroes `privateAsks` for anyone but the owner or the admin. `migrations.backfillDaily` clears and rebuilds the table in pages. `deleteAccount` deletes the rows.

Page. Head with avatar, name, a Public or Private pill the owner clicks to flip (calls `profile.update` with the flag), Share (copies the URL), and Edit. Rail with joined date, user number, links, bio. Then: asks, answers, longest and current streak; a year of asks as a heatmap in five levels; a segmented bar of how Jev replied; the models Jev picked, ranked, with the lane's one line reason from `ROUTES`; tokens over thirty days as an area chart; asks over thirty days as bars, stacked Wall and Private for the owner; the top topics; the wall asks through the existing `Wall` list. Everything is hand drawn SVG in the app's tokens, so no chart dependency and both themes come free. `byHandle`, `stats`, and `publicAsks` all show a private profile to its owner, so a private account still gets the full page.

Docs. `/docs` is thirteen sections behind a sticky table of contents. Every number is imported from the constant that enforces it: word limits from `convex/lib/words.ts`, the seven Jev questions and the lane table from `convex/questions.ts`, prices from `convex/lib/pricing.ts`, rate limits from `convex/lib/limits.ts`, the goal from `convex/lib/counters.ts`. Change a constant and the docs change with it. Nothing about moderation tooling is on the page. Linked from the hero nav, the How it works section, and the colophon.

## Settings first on /me, with an anchor row (seventh pass, 22:45 UTC)

The ask: put Your asks under Profile and Account on `/me`, and add anchor links at the top to each section.

Order. History was first because it was the reason the page existed. Once the profile form grew to seven fields and the account card to three actions, a user with fifty asks had to scroll past all of them to change a handle. The two forms are bounded; the history is not. Bounded content goes first, the list goes last.

Anchors. `ME_SECTIONS` in `Me.tsx` is the one list of id and title, in page order, and drives both the nav and nothing else; each section carries its id. The links are plain `href="#me-asks"` anchors, not the app `Link`: the pathname does not change, so `usePath` never fires and the browser does the scroll on its own. `.me__section` has `scroll-margin-top: 24px` so the section's top rule is not flush against the viewport. The row is styled like the docs contents (mono, muted, ink on hover), ruled above to close the header, and pulled 16px into the first section so it sits between two rules rather than floating in the body gap. Coarse pointer padding matches the other mono links.

Verified on dev signed in as the throwaway: section order in the DOM is `me-profile`, `me-account`, `me-asks`; clicking Your asks puts the section at 24px, the URL at `/me#me-asks`, and the page is still the account route.

Files: `src/components/Me.tsx`, `src/styles.css`.

## Form fields get their border back (sixth pass, 22:40 UTC)

The ask: the input boxes on the profile page had no edge, so a blank field looked like card background and there was nowhere obvious to type.

Cause. The composer redo in the fourth pass moved the border off the textarea and onto the box that wraps it, so the bar and the button could sit inside one outline. `.auth__input`, used by every field on `/me`, `/sign-in`, and `/sign-up`, had been leaning on the textarea rule and went flat with it.

Fix. `.auth__input` now carries its own rule: 1.5px `--input-border`, 48px min height, focus color on focus, native caret kept while empty (the composer hides its caret in that state and draws one, these fields do not). Radius is `--radius-small`, 16px light and 6px dark. The card radius was tried first and made every 48px field a full pill, which reads as a search bar when nine of them stack; the bio textarea keeps the card radius since it is a tall box like the composer. Checked on `/sign-in` and `/me` in both themes.

Files: `src/styles.css`.

## The panel folds and the wall clears the fold (fifth pass, 22:29 UTC)

The ask: the orange panel was still too tall. Fold part of it behind a closed toggle, keep the numbers people share at the top, and get the wall header above the fold.

What stays open. The count, the progress bar, the percent of one million and the held line, then three rows: Jev spend (what this has cost), To one million (what it would cost), At this pace (how long it will take). Those are the three someone screenshots. Per message, Tokens in, Model answers, Answer spend, Per answer, On the clock, and the clock footnote move into a `panel__more` block behind a "More numbers" row that reads "Fewer numbers" when open. Closed by default. The choice is remembered in `localStorage` (`jev:numbers-open`) so a return visitor who wanted the long list keeps it. The toggle is ruled like one more stat row and uses the same caret as Show Jev's answers on wall cards, so the two folds in the app read as one control.

Root cause of the fold problem. `.hero` had `min-height: 100vh` from the stats above the fold pass, which made the hero fill the screen no matter how short its contents got. Shortening the panel alone would not have moved the wall. The min height is gone, the hero bottom padding is 48px, and `#wall` gets 48px of top padding instead of the section default of 80. Measured at 1440 by 900 on dev: panel bottom 682px, "The wall." heading 814 to 890.

One more. In dark mode the display face is wider and "~256y 181d left" wrapped the "At this pace" label to three lines. `roughDuration` now drops the day remainder past a year (`~2.5y` under ten years, `~257y` after) and stat labels are `nowrap`.

Files: `src/components/CostTracker.tsx`, `src/lib/format.ts`, `src/styles.css`.

## Hero redo and the gateway credit (fourth pass, 21:45 UTC)

The ask: a fold closer to ChatGPT or Claude, the orange counter kept, no example questions, the visitor and sign in copy as bulleted lists on the left, a longer input box that grows, a button that is not a circle, and the Convex AI Gateway named in a few places so the app reads as a demo of it.

Layout. Still three columns, now weighted toward the composer: `Lanes` (left), composer with Yours (center, the widest), counter panel (right, unchanged). The headline dropped one size and `hero__body` lost its vertical centering, so the fold starts higher and one reply fits under the box on a 1280 by 800 laptop. Under 1100px the counter moves under the composer; under 800px the composer comes first, then the lists, then the counter.

Lanes. `src/components/Lanes.tsx`. Visitors see two short lists. "Without an account": yes, no, or it depends in about 100ms; 3 to 15 plain words; 5 asks a minute; every ask on the wall. "Sign in for the rest": any question up to 60 words; Jev picks one of 4 models and a short answer streams through the Convex AI Gateway; wall or private; a history and a profile; 20 asks a minute. Signed in, it collapses to one list. Every number is an import from the constant the server enforces, so the copy cannot drift.

Composer. One box, in the spirit of the live site's input rather than the pill and circle that shipped in the earlier pass. Header row with the label and the segmented Wall | Private (accounts) or a "Sign in to ask anything" link (visitors). Textarea grows with the text via `useLayoutEffect` to `MAX_BOX_HEIGHT` (about eight lines) then scrolls. Bottom bar inside the box: mono word count left, fixed height 40px ember Ask pill right, so the button holds its shape as the box grows. Examples removed. Chips only once something is typed.

Gateway credit. The "Powered by" line in the top row reads Convex, AI Gateway, and TypeSafe. The Lanes list links the gateway. How it works has a paragraph on what the gateway does here (4 models from 4 providers behind one endpoint, Convex holds the provider keys, a Convex action gets a short lived token, one bill) and its Answers card reads "Convex AI Gateway · 4 models, Jev picks." `/docs` explains the same under "How Jev picks the model." Model and provider counts are derived from `ROUTES`.

Profile verified. Signed in as the throwaway `profiledemo`, posted one wall ask and one private ask, then compared `userDaily`, `userUsage`, the four `messages` rows, and the rendered `/profiledemo` page. All four agree: asks 4, answers 4, wall 2, private 2, claude haiku 4.5 twice and gemini 3.5 flash lite twice, 5,461 tokens, $0.00093, topics nature 3 and tech 1. The "On the wall" list shows only the two public asks.

## Decisions

- Jev stays the judge. The AI Gateway model only writes the answer. Jev's verdict lands first, so the wall stays as fast as before.
- Jev is called through `convex/lib/jev.ts`. Since 2026-09-21 the default is the Convex AI Gateway Decisions endpoint, `POST https://ai-gateway.convex.dev/alpha/decisions` with model `typesafe/jev-1.13`, on a `getServiceToken("ai-gateway")` token. The endpoint takes the System One body unchanged, so only the URL and the model id differ from the direct call. `JEV_PROVIDER=typesafe` pins TypeSafe direct first. Whichever is primary, the other is tried once on failure when configured. `JEV_GATEWAY_URL` overrides the endpoint if it moves out of alpha. When the gateway refuses the deployment and no key is set, `JevUnavailableError` publishes the ask unjudged instead of retrying.
- The judge stays on `fetch` rather than `convexGateway.evaluationModel()` with AI SDK `evaluate`. The app already types the System One request and response, the Decisions body is the same shape, and the SDK's evaluation interface is marked experimental. One function, `gatewayDecisions`, is the only place to change if the alpha shape moves.
- Answers use `@convex-dev/agent` for threads, streaming deltas, and usage callbacks, with `convexGateway()` from `@convex-dev/ai-sdk-provider` as the model. One `Agent` per model id, cached.
- The wall card gets a periodic mirror of the streaming text on the message row (`answerText`, patched every 350ms) so the home page never loads the agent's React bundle. The ask page streams for real through `useUIMessages`.
- Client side routing is a forty line `useRoute` hook and a `Link` wrapper. Static hosting falls back to `index.html`, so no router package.
- Private is default for profiles. A user opts in to a public profile at `/:handle`. Owners see their full profile either way.
- Account deletion cascades: private asks and their threads are deleted, public asks are detached (`userId` cleared) so the count to a million stays honest, usage row and photo are deleted, the username row is removed so the email is free again. The auth alpha exposes no `deleteUser` on the core component, so one inert `accounts` row stays behind with no username pointing at it. The admin account cannot delete itself from the UI.
- Prices are a per model table in `convex/lib/pricing.ts` in micro USD, summed on sharded counters so `stats.cost` stays one read.

## Admin compatibility

The existing admin row was validated against the new schema on push, then backfilled with `internal.migrations.backfillUsers` to gain `userNumber` 1, `handle`, and `status: "active"`. `requireAdmin` still compares the signed in username to `ADMIN_USERNAME`. Admin sign in on `/admin` uses the shared `AuthForm`; the create account toggle became a link to `/sign-up`, which only registers the admin while `ADMIN_SIGNUP_OPEN=1` and the table is empty, exactly as before. Every admin function runs `requireAdmin` first. Verified on dev: the admin row is intact after the push and a non admin account sees "Not authorized" on `/admin`.

## Switch Jev to the Convex AI Gateway

Done 2026-09-21, the day Convex launched the gateway with Jev on it. The plan had assumed `typesafe-ai/jev` and an unknown path; the shipped endpoint is `POST /alpha/decisions` with model `typesafe/jev-1.13` and the System One body unchanged, so `gatewayDecisions` in `convex/lib/jev.ts` is a thin URL and model swap. Two changes from the plan: the gateway became the default instead of an opt in, since it needs no env at all, and the fallback runs both ways so `JEV_PROVIDER=typesafe` is a safe pin rather than a one way door.

Verified on dev in this order:

1. Ask with no env change. Row `judgeProvider: "gateway"`, "is the sky blue on a clear day", yes at 0.99, 217ms. Hero "Jev online · Convex AI Gateway", Judge card "Jev via Convex AI Gateway".
2. `npx convex env set JEV_GATEWAY_URL https://ai-gateway.convex.dev/alpha/nope`. Next ask: log `Jev gateway failed, falling back to typesafe` with the gateway's own 400 listing `/alpha/decisions` as supported; row `judgeProvider: "typesafe"`, "can penguins fly south for winter", no at 0.98, 357ms.
3. `npx convex env remove JEV_GATEWAY_URL`.

Prod needs only `npm run deploy`; the step is in `task.md`. If the gateway is slower or verdicts drift over the first week, `npx convex env set JEV_PROVIDER typesafe --prod` pins TypeSafe first with no redeploy.

## Files

New: `convex/answer.ts`, `convex/profile.ts`, `convex/migrations.ts`, `convex/lib/auth.ts`, `convex/lib/jev.ts`, `convex/lib/limits.ts`, `convex/lib/usage.ts`, `src/lib/router.ts`, `src/hooks/useMe.ts`, `src/hooks/useSmoothText.ts`, `src/components/{AdminUsers,AnswerBlock,AskPage,AuthForm,Avatar,Link,Me,Profile,SignIn,Tooltip}.tsx`.

Changed: `convex/{schema,users,auth,admin,messages,judge,questions,stats,convex.config}.ts`, `convex/lib/{counters,pricing,rateLimits,words}.ts`, `src/{App,main}.tsx`, `src/components/{Admin,Composer,CostTracker,HowItWorks,Wall,Yours}.tsx`, `src/styles.css`, `package.json`.

New dependencies: `@convex-dev/agent`, `@convex-dev/ai-sdk-provider`, `ai`, `@radix-ui/react-tooltip`.

New env vars: none required. `JEV_PROVIDER=typesafe` pins TypeSafe first; `JEV_GATEWAY_URL` overrides the Decisions endpoint. `TYPESAFE_API_KEY` is now optional and serves as the fallback. The AI Gateway must be enabled on the deployment for Jev and the answers to run.

Tests: `convex/jev.test.ts`.

## Verification

Dev, 2026-09-19, Chrome at 1024 and 375, light and dark.

- `npm run typecheck` clean. `npx convex dev --once` pushed the schema with the existing admin row and twenty messages validating. `backfillVisibility` set `public` on every old row; `backfillUsers` gave the admin `#1` and a handle.
- Signed out home page: composer, count panel, wall cards, and How it works unchanged. Sign in hint under the composer reads twenty asks a minute instead of five.
- Sign up at `/sign-up` with a throwaway email created user `#2`, redirected home, avatar in the top row, Wall | Private toggle visible, placeholder and label switched to sixty words in Private.
- Private ask "explain how a hash map works": Jev judged in 300ms (`open`, `tech`, route `explain` at 0.99), Claude Haiku 4.5 answered in 2.3s through the gateway, 82 tokens in, 82 out, thread created, `visibility: private`, row absent from the wall.
- `/a/:id`: verdict chart, model name, one line why, latency, streamed answer. Follow up "what is a good load factor" streamed a reply in the same thread.
- `userUsage` row: 2 asks, 2 answers, 255 in, 140 out, 955 micro USD, 1234 Jev tokens in.
- `/me`: history with the ask, filters, Show on wall, Archive, Delete, profile form, password, export, delete. Saved display name and GitHub; `/u/tester` rendered the avatar letter, user number, joined time, GitHub link, private profile tag, Edit profile. Archive moved the row out of All.
- `/admin` as the non admin account: Not authorized card with sign out.
- Delete account with the typed phrase: user row, usage row, private ask, and agent thread gone; admin row untouched; client signed out and returned home.
- 375 wide: top row wraps to three lines, toggle and examples wrap, textarea fills the column, no horizontal overflow.

Second pass, 21:00 UTC, dev at 1024 wide, light. Typecheck clean, `npx convex dev --once` pushed `wallHidden`. Hero tag renders below right with clearance from the comma. Signed in as a throwaway account, posted a wall ask carrying a blocklist word: accepted, judged, `wallHidden: true` on the row, author saw the full text in Yours and on the wall card with `blurred for others`. Signed out in a second tab: the same card blurred with `held words`, no answer block, and the ask absent from search. Visitor ask "why does bread rise in the oven" came back `open` and Yours showed the sign in nudge under the card.

Not verified in this pass: admin sign in in the browser (password not available to the agent; the guard and the row were checked instead), photo upload end to end, pause and block from the Users tab in the browser (the mutations ran clean under typecheck and the data paths were exercised through the same helpers).
