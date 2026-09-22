# Ask Jev

A public wall where anyone asks a question in three to fifteen words and Jev, TypeSafe's judgment model, answers yes, no, or it depends in about 100 milliseconds. Every judged ask lands on the wall in realtime, with a running count toward one million and the exact cost of getting there.

Sign in and you can ask Jev anything, for real. Up to sixty words, no word list, and Jev picks which model should answer. A short answer streams in under your ask through the Convex AI Gateway, with the model's name and a one line reason for the pick. Put it on the wall or keep it private, and keep a history on your profile.

Live at [askjev.ai](https://www.askjev.ai).

## Open source

The whole app is in this repo: the Convex backend in `convex/`, the React app in `src/`, the product docs in `prds/`. Clone it, run it against your own deployment, or open an [issue](https://github.com/waynesutton/ask-jev-ai/issues).

It is built almost entirely from open source Convex pieces:

- [Convex Auth v2](https://auth-v2.previews.convex.dev/getting-started) (alpha, `npm i @convex-dev/auth@alpha`) for Google, GitHub, and email and password sign in
- [Convex components](https://www.convex.dev/components): [Agent](https://www.convex.dev/components/agent), [Sharded Counter](https://www.convex.dev/components/sharded-counter), [Rate Limiter](https://www.convex.dev/components/rate-limiter), [Static Hosting](https://www.convex.dev/components/static-hosting)
- [Convex AI Gateway](https://docs.convex.dev/ai-gateway/overview) (beta) for Jev and the model answers, so the app stores no provider keys

## Why this exists

Most AI demos generate text. Jev does not. It reads a sentence and returns typed answers with probabilities: a choice, a yes or no, a score. That makes it usable as a primitive inside ordinary code rather than a chatbot bolted onto a page.

This app is a small, honest test of that idea. One call per message. Six questions in that call, seven when you are signed in. Code decides what happens next, including which model gets to write.

## How a message travels

1. You type an ask. As a visitor the browser checks it against a profanity blocklist and a 12,530 word human verified allowlist before the Ask button turns on. Signed in there is no word list and the limit is sixty words; a blocklist word only warns you that the wall copy will blur.
2. A Convex mutation runs the same checks server side, applies an IP rate limit and a per session or per user rate limit, stores the message as `judging`, and schedules the judge. A visitor ask that carries a held term is turned away. A signed in ask that carries a held term or a blocklist word is accepted and flagged `wallHidden`: it blurs on the wall and in search for everyone except the author and the admin, and reads in full on the author's account page.
3. A Convex action sends `{ message }` to Jev through the Convex AI Gateway with six questions: does Jev say yes, no, or it depends; is it unkind; is it adult; does it target a person; what is the mood; what is the topic. Signed in asks carry a seventh: which of four lanes should answer this, a quick fact, an explanation, some reasoning, or something recent.
4. A mutation records the answers, token usage, and latency. Any safety probability at or above `0.6` marks the ask `blocked`. Otherwise it goes `live`.
5. For a signed in live ask, an action opens a thread and streams a short answer from the lane's model through the Convex AI Gateway. Tokens and cost are recorded per answer and per account. Follow ups stay in the thread with the same model.
6. Every open tab sees the wall, the counter, and the cost tracker move at once. No polling, no websockets to manage.

The whole policy lives in one file: `convex/questions.ts`. The lanes and their models are the `ROUTES` table in that file.

## Stack

| Layer                | What                                                                                                                                                                               | Link                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Judge                | Jev, TypeSafe System One, through the Convex AI Gateway Decisions endpoint (`typesafe/jev-1.13`) on a deployment token. No key. TypeSafe direct is the fallback when a key is set. | [Decisions](https://docs.convex.dev/ai-gateway/api#post-alphadecisions), [docs.typesafe.ai](https://docs.typesafe.ai) |
| Answers              | Convex AI Gateway. Gemini 3.5 Flash Lite, Claude Haiku 4.5, GPT 5.4 mini, Perplexity Sonar. Jev picks the lane.                                                                    | [AI Gateway](https://docs.convex.dev/ai-gateway/overview)                                                             |
| Threads              | `@convex-dev/agent` for threads, streaming, and usage callbacks, with `@convex-dev/ai-sdk-provider` as the model.                                                                  | [Agent](https://www.convex.dev/components/agent)                                                                      |
| Backend and database | Convex. Queries, mutations, actions, scheduler, file storage, full text search index on the wall.                                                                                  | [convex.dev](https://convex.dev)                                                                                      |
| Counters             | `@convex-dev/sharded-counter` for live, blocked, submitted, judged, token, and answer totals.                                                                                      | [Sharded Counter](https://www.convex.dev/components/sharded-counter)                                                  |
| Rate limits          | `@convex-dev/rate-limiter`. Fixed window per IP, token bucket per session or per user, a budget per account for answers.                                                           | [Rate Limiter](https://www.convex.dev/components/rate-limiter)                                                        |
| Auth                 | `@convex-dev/auth` v2 (alpha). Google, GitHub, or email and password for everyone; one email is the admin and keeps password only.                                                 | [Convex Auth](https://auth-v2.previews.convex.dev/getting-started)                                                    |
| Hosting              | `@convex-dev/static-hosting`. The built Vite app is served from the Convex deployment.                                                                                             | [Static Hosting](https://www.convex.dev/components/static-hosting)                                                    |
| Frontend             | React 19, Vite, TypeScript. Plain CSS with two skins on one set of tokens. A forty line router.                                                                                    | [react.dev](https://react.dev), [vite.dev](https://vite.dev)                                                          |
| Icons and tooltips   | Phosphor icons, Radix Tooltip.                                                                                                                                                     | [phosphoricons.com](https://phosphoricons.com), [Radix](https://www.radix-ui.com/primitives/docs/components/tooltip)  |
| Word gates           | `obscenity` for the blocklist, The Best Codes safe words for the allowlist.                                                                                                        | [obscenity](https://github.com/jo3-l/obscenity), [safe-words](https://github.com/The-Best-Codes/safe-words)           |
| Type                 | Archivo, DM Sans, DM Mono in light. Inter in dark.                                                                                                                                 | [Google Fonts](https://fonts.google.com)                                                                              |
| Domain               | Cloudflare DNS in front of the Convex site.                                                                                                                                        | [Cloudflare](https://www.cloudflare.com)                                                                              |

## Features

- Realtime wall of live asks with Jev's verdict chip and its confidence (`Jev: yes · 94%`), mood, topic, cost, and latency per card. A quiet `close call` tag under 60%, `leaning no` on a depends, and `close to the line` when an ask came near the hold threshold
- "How sure was Jev" folds open under every card: the verdict with its bar, whether the ask fits the wall, and Jev's runner up when the call was close. Closed by default, remembered per browser
- "Was Jev right?" Thumbs up and down under every yes, no, or depends. One vote per person per ask, flip or take back, tallies live on the card, and an agreement rate in the count panel. Votes measure Jev and never change a verdict
- A Link button on every card copies its permanent `/a/:id` address
- Odometer counter with dim leading zeros and a progress line toward one million
- Cost tracker: total spend, per message, projection to the goal, tokens in, a stopwatch since the run began, and time left at the observed pace
- Full text search over the wall, backed by a Convex search index
- Your newest ask under the box with status: judging, live, held, or failed with retry. One card with an X. Signed in it stays until you close it or ask again and links to your history on `/me`. Signed out, a live ask drains for four seconds, then slides toward the wall and fades; hover holds it. A visitor's ask on a held topic stays put with a sign in line: the same ask goes through signed in, judged and answered, blurred on the wall for everyone but you
- Accounts with Google, GitHub, or email and password. Twenty asks a minute instead of five, a sequential user number, a handle, and an avatar menu in the top row. Sign up and sign in also sit on every public profile, and bring you back to it after
- A visitor's ask on a held topic says why it was held and that the same ask goes through signed in
- Model answers for signed in asks. Jev sorts the ask into one of four lanes, the lane's model answers through the Convex AI Gateway, and the card shows the model, the one line reason, latency, and cost. Each ask gets a page with a thread for follow ups
- Follow up on any ask. Every card carries "Ask a follow up", or "Sign in to ask follow up questions" for visitors, which brings you back to the ask once you are in. A thread follows its ask: your own public ask continues in a public thread anyone can read, your own private ask in a private one, and making the ask private takes the thread with it. Anyone else's ask, including a visitor's yes or no, opens a private thread only you and the admin can read, answered by the model Jev picked for that ask with the ask and Jev's verdict as context. Your side threads list under Follow ups on `/me`
- Ask anything once signed in. Up to sixty words, no word list, on the wall or private. An ask with a held term or a blocklist word still gets its verdict and its answer; it blurs on the wall for others and reads in full on your account page
- Open question line for visitors. Jev's own verdict on the ask tells the app when a three to fifteen word question was not a yes or no, and the card says so where the answer would sit, on the wall, in Yours, and on the ask page, with a sign in link and a way back to the box to ask a yes or no. Signed in readers see a quiet line explaining why the anonymous ask has no answer
- Your account page: history with filters, per ask visibility, archive, delete, profile with photo and links, public or private profile, change password, export as JSON, delete account
- Profiles at `/handle`, public or private. User number, joined date, GitHub, LinkedIn, X, then usage: asks and answers, streaks, a year of asks as a heatmap, how Jev replied, the models Jev picked and why, tokens and asks over thirty days, top topics, and the account's wall asks. Owners see their private counts; nobody else does
- `/about`, the How it works section again with the full docs under it in a ruled band. Every number on the page is imported from the constant the server enforces. `/docs` still resolves and lands on the band
- The fold: two bulleted lists on the left (what a visitor gets, what signing in lifts), a composer that grows with the text and holds a fixed Ask pill in its bottom bar, and the orange counter on the right. Every number in the lists is imported from the constant the server enforces
- The Convex AI Gateway is named where an answer comes from: the top row credit, the fold, How it works, and `/about`. Convex holds the provider keys; this app stores none
- Tooltips where a term needs one: the toggle, the tags, the model line, the cost rows
- Light and dark skins, stored per browser, applied before first paint
- Server only held topics list read from an environment variable, never in the repo or the bundle
- Admin features: sign in, filter and search every message in every status including private, hide or unhide asks and model answers from the dashboard or straight from the wall, a Users tab with usage per account (asks, tokens, spend) and pause, block, and restore. Blocked emails cannot sign up again. Hidden text is masked server side so it never reaches the browser
- Jev runs through the Convex AI Gateway by default, on the same deployment token as the model answers, so the app stores no TypeSafe key. If the gateway call fails and `TYPESAFE_API_KEY` is set, the same request goes to TypeSafe directly and the row records which door answered. The hero line and the Judge card name the live provider
- Graceful no Jev mode. If the gateway refuses the deployment (free plan, anonymous local backend) and no `TYPESAFE_API_KEY` is set, asks publish unjudged on the allowlist alone instead of retrying
- Terms of service and privacy policy at `/terms` and `/privacy`, written for what this app stores and where it goes, linked from the colophon with About, Open source, and Support
- Errors read as sentences. Server rules throw `ConvexError` with plain copy ("That handle is taken"), the client shows that copy, and anything unexpected gets a short fallback while the raw error and its request id go to the console

## Run it locally

```bash
git clone git@github.com:waynesutton/ask-jev-ai.git
cd ask-jev-ai
npm install
```

Start the backend in one terminal. This creates `.env.local` with your deployment URL.

```bash
npm run dev:backend
```

No Convex account yet? Run it anonymously instead:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Start the frontend in another terminal and open the URL it prints.

```bash
npm run dev
```

## Environment variables

Set these on the Convex deployment with `npx convex env set NAME value`. None of them live in the repo.

| Name                            | Purpose                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `TYPESAFE_API_KEY`              | Optional. TypeSafe direct as the fallback for Jev, or the primary with `JEV_PROVIDER=typesafe`.                                             |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | RS256 pair for Convex Auth. Generate with `npx @convex-dev/auth`.                                                                           |
| `AUTH_GOOGLE_CLIENT_ID`         | Google OAuth web client id for this deployment.                                                                                             |
| `AUTH_GOOGLE_CLIENT_SECRET`     | Google client secret, stored only in Convex.                                                                                                |
| `AUTH_GITHUB_CLIENT_ID`         | GitHub OAuth application client id for this deployment.                                                                                     |
| `AUTH_GITHUB_CLIENT_SECRET`     | GitHub client secret, stored only in Convex.                                                                                                |
| `AUTH_ALLOWED_ORIGINS`          | Optional comma separated exact return origins in addition to `CONVEX_SITE_URL`. Dev: `http://localhost:5173,http://localhost:5199`.         |
| `ADMIN_USERNAME`                | The email that gets admin features. Other emails sign up freely.                                                                            |
| `ADMIN_SIGNUP_OPEN`             | Set to `1` only while creating the admin account, then remove it.                                                                           |
| `HELD_TERMS`                    | Optional. Comma separated topics stored as held without calling Jev.                                                                        |
| `JEV_PROVIDER`                  | Optional. Unset means Jev goes through the Convex AI Gateway first. `typesafe` pins TypeSafe direct first with the gateway as the fallback. |
| `JEV_GATEWAY_URL`               | Optional. Overrides the Decisions endpoint, `https://ai-gateway.convex.dev/alpha/decisions`, if it moves out of alpha.                      |

Jev and the model answers both need the AI Gateway enabled on the Convex deployment, which means a paid Convex plan and a project linked deployment. No provider keys are stored here; the gateway holds them. Whichever provider is primary, the other is tried once on failure when it is configured, so a gateway outage or a bad key never takes the wall down.

OAuth callbacks are `/oauth/google/callback` and `/oauth/github/callback` on the deployment's HTTP site URL. Each provider has its own component prefix ahead of the static site's `/` route. OAuth links only verified emails, refuses the admin email, and rechecks blocked or deleted accounts on every sign in. Legacy accounts keep password sign in. OAuth-only accounts cannot acquire a password through public sign up.

OAuth implementation status and remaining provider setup are tracked in `prds/google-github-sign-in.md`. Local code is not evidence of deployed OAuth: provider credentials, a separately authorized deployment, and browser round-trip tests are required before launch. Never put client secrets in `VITE_` variables or committed files.

## Scripts

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                                      |
| `npm run dev:backend` | `convex dev`, watches and pushes the backend                         |
| `npm run build`       | Production build to `dist`                                           |
| `npm run typecheck`   | Type checks the app and the Convex functions                         |
| `npm test`            | Local tests: Jev door, OAuth identity, reply backfill. No deployment |
| `npm run words:build` | Regenerates `convex/lib/safeWords.ts` from the upstream list         |
| `npm run deploy`      | Builds and uploads the site through the static hosting component     |

One off backfills live in `convex/migrations.ts` and run with `npx convex run`. `migrations:backfillReply '{"dryRun":true}'` counts live asks judged before Jev's `reply` question existed; without `dryRun` it asks Jev the one `reply` Choice per row (about $0.00003 each) so those cards can show a verdict chip or the open question line. `limit` caps a run and the log prints the cursor to resume from. Add `--prod` to run it there.

## Layout

```
convex/          Schema, questions, send and judge pipeline, answers, profiles, stats, admin, auth
convex/lib/      Jev door, typed TypeSafe client, word gates, counters, rate limits, pricing, usage
src/             React app, router, hooks, styles
prds/            One product doc per feature with what shipped and how it was verified
scripts/         Word list builder and the share card source
```

`files.md` describes every file. `changelog.md` follows Keep a Changelog. `task.md` holds the to do list and a timestamped log of completed work.

## Cost

Jev's list price is $0.042 per million input tokens, output free. A judged ask has cost between $0.000032 and $0.000044 so far, which puts one million asks somewhere between $32 and $44. The tracker on the page does this math live from the token counts TypeSafe returns, not from estimates.

Model answers are priced per model from the table in `convex/lib/pricing.ts` at list price, tokens in and out, and shown on their own rows so the Jev numbers stay the Jev numbers. The first answer on dev, Claude Haiku 4.5, 82 tokens each way, cost $0.000492.

## Credits

Built by [Wayne Sutton](https://waynesutton.ai) as a demo of Jev and Convex. Not associated with TypeSafe AI.
