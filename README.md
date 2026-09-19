# Ask Jev

A public wall where anyone asks a question in three to fifteen words and Jev, TypeSafe's judgment model, answers yes, no, or it depends in about 100 milliseconds. Every judged ask lands on the wall in realtime, with a running count toward one million and the exact cost of getting there.

Live at [askjev.ai](https://www.askjev.ai).

## Why this exists

Most AI demos generate text. Jev does not. It reads a sentence and returns typed answers with probabilities: a choice, a yes or no, a score. That makes it usable as a primitive inside ordinary code rather than a chatbot bolted onto a page.

This app is a small, honest test of that idea. One call per message. Six questions in that call. Code decides what happens next.

## How a message travels

1. You type an ask. The browser checks it against a profanity blocklist and a 12,530 word human verified allowlist before the Ask button turns on.
2. A Convex mutation runs the same checks server side, applies an IP rate limit and a per session rate limit, stores the message as `judging`, and schedules the judge.
3. A Convex action sends `{ message }` to the TypeSafe System One API with six questions: does Jev say yes, no, or it depends; is it unkind; is it adult; does it target a person; what is the mood; what is the topic.
4. A mutation records the answers, token usage, and latency. Any safety probability at or above `0.6` marks the ask `blocked`. Otherwise it goes `live`.
5. Every open tab sees the wall, the counter, and the cost tracker move at once. No polling, no websockets to manage.

The whole policy lives in one file: `convex/questions.ts`.

## Stack

| Layer                | What                                                                                   | Link                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Judge                | Jev, TypeSafe System One. Called over HTTP with `fetch`, no SDK.                       | [docs.typesafe.ai](https://docs.typesafe.ai)                                                                |
| Backend and database | Convex. Queries, mutations, actions, scheduler, full text search index on the wall.    | [convex.dev](https://convex.dev)                                                                            |
| Counters             | `@convex-dev/sharded-counter` for live, blocked, submitted, judged, and token totals.  | [Sharded Counter](https://www.convex.dev/components/sharded-counter)                                        |
| Rate limits          | `@convex-dev/rate-limiter`. Fixed window per IP, token bucket per session.             | [Rate Limiter](https://www.convex.dev/components/rate-limiter)                                              |
| Auth                 | `@convex-dev/auth` v2 (alpha). Username and password, sign up gated to one admin.      | [Convex Auth](https://labs.convex.dev/auth)                                                                 |
| Hosting              | `@convex-dev/static-hosting`. The built Vite app is served from the Convex deployment. | [Static Hosting](https://www.convex.dev/components/static-hosting)                                          |
| Frontend             | React 19, Vite, TypeScript. Plain CSS with two skins on one set of tokens.             | [react.dev](https://react.dev), [vite.dev](https://vite.dev)                                                |
| Icons                | Phosphor.                                                                              | [phosphoricons.com](https://phosphoricons.com)                                                              |
| Word gates           | `obscenity` for the blocklist, The Best Codes safe words for the allowlist.            | [obscenity](https://github.com/jo3-l/obscenity), [safe-words](https://github.com/The-Best-Codes/safe-words) |
| Type                 | Archivo, DM Sans, DM Mono in light. Inter in dark.                                     | [Google Fonts](https://fonts.google.com)                                                                    |
| Domain               | Cloudflare DNS in front of the Convex site.                                            | [Cloudflare](https://www.cloudflare.com)                                                                    |

## Features

- Realtime wall of live asks with Jev's reply chip, mood, topic, cost, and latency per card
- Jev's answers on every card as a small bar chart, open by default
- Odometer counter with dim leading zeros and a progress line toward one million
- Cost tracker: total spend, per message, projection to the goal, tokens in, a stopwatch since the run began, and time left at the observed pace
- Full text search over the wall, backed by a Convex search index
- Your recent asks with status: judging, live, held, or failed with retry
- Light and dark skins, stored per browser, applied before first paint
- Server only held topics list read from an environment variable, never in the repo or the bundle
- Admin features: sign in, filter and search every message in every status, hide or unhide from the dashboard or straight from the wall. Hidden text is masked server side so it never reaches the browser
- Graceful no key mode. Without `TYPESAFE_API_KEY` posts publish on the allowlist alone and the UI says Jev is offline

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

| Name                            | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `TYPESAFE_API_KEY`              | Turns the judge on. Without it the wall runs on the allowlist alone.  |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | RS256 pair for Convex Auth. Generate with `npx @convex-dev/auth`.     |
| `ADMIN_USERNAME`                | The one username allowed to create an account and use admin features. |
| `HELD_TERMS`                    | Optional. Comma separated topics stored as held without calling Jev.  |

## Scripts

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                                  |
| `npm run dev:backend` | `convex dev`, watches and pushes the backend                     |
| `npm run build`       | Production build to `dist`                                       |
| `npm run typecheck`   | Type checks the app and the Convex functions                     |
| `npm run words:build` | Regenerates `convex/lib/safeWords.ts` from the upstream list     |
| `npm run deploy`      | Builds and uploads the site through the static hosting component |

## Layout

```
convex/          Schema, questions, send and judge pipeline, stats, admin, auth
convex/lib/      Typed TypeSafe client, word gates, counters, rate limits, pricing
src/             React app, hooks, styles
prds/            One product doc per feature with what shipped and how it was verified
scripts/         Word list builder and the share card source
```

`files.md` describes every file. `changelog.md` follows Keep a Changelog. `task.md` holds the to do list and a timestamped log of completed work.

## Cost

Jev's list price is $0.042 per million input tokens, output free. A judged ask has cost between $0.000032 and $0.000041 so far, which puts one million asks somewhere between $32 and $41. The tracker on the page does this math live from the token counts TypeSafe returns, not from estimates.

## Credits

Built by [Wayne Sutton](https://waynesutton.ai) as a demo of Jev and Convex. Not associated with TypeSafe AI.
