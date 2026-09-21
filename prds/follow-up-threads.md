# Follow up threads on every ask

Created: 2026-09-20 01:40 UTC
Last Updated: 2026-09-20 01:40 UTC
Status: In Progress

## Problem

A thread exists today only for the owner of a signed in ask: Jev judges, a model answers, and the owner can keep going on `/a/:id`. Three gaps:

1. A visitor's ask (yes, no, or depends) has no thread and no hint that one is possible. Nothing on the card says "sign in and you can ask why".
2. A signed in person reading someone else's ask, or an anonymous ask on the wall, cannot follow up at all. Follow ups are owner only.
3. Nothing on a wall card, a profile row, or a `/me` row invites a follow up. The only door is the small "Open thread" link under a model answer, which only shows when a thread already exists.

## Proposed solution

One rule: **a thread belongs to the person asking the follow up, anchored on the ask.**

- The owner of a signed in ask keeps the thread they have (`messages.threadId`), where the model answer already lives. Public asks keep that thread readable by anyone. Unchanged.
- Everyone else who is signed in gets their own side thread on that ask, created on their first follow up. One per ask per user. Private to them and the admin. The ask author never sees it, and it never shows on the wall.
- Visitors see "Sign in to ask follow up questions" under every live card. Sign in returns them to the ask.

Jev picks the model with no extra call: every judged ask already carries `route`, so the side thread uses `ROUTES[route].model`. Unjudged asks fall back to the explain route. The first turn of a side thread carries the ask and Jev's verdict (and the model answer when there is one) in the system prompt, so "why not?" lands with context.

### Backend

- `schema.ts`: `threads` table `{ messageId, userId, threadId, model, count, lastAt }` with `by_message_and_user` and `by_user`.
- `answer.ts`:
  - `followUp` branches. Owner with `threadId`: today's path. Anyone else, on a live public ask that is not hidden: find or `createThread` (agent helper, works in a mutation) and insert the row, then `saveMessage` and schedule `reply` with a `system` context string. Same word cap, same `answer` and `answerDaily` buckets, same usage bumps.
  - `reply` takes optional `system`. Passing it per call overrides the agent instructions for that turn; the thread stores no system message, so it is passed every time.
  - `listMessages` accepts either the ask's own thread (public read rules) or a side thread (owner or admin only).
  - `myThreads` query: the viewer's side threads with the ask text, count, model, last activity, newest first, for `/me`.
- `messages.get` returns `followUp`: `null` when the viewer cannot follow up (visitor, paused, blocked, ask not live or masked), else `{ kind: "own" | "side", threadId?: string, model: string }`.
- `profile.ts`: `deleteAccount` deletes the user's side threads and rows; `remove` deletes side threads on a deleted ask. `admin.setHidden` leaves side threads in place; reads check `hidden` and return empty.

### Frontend

- `FollowUp.tsx`: one small link. Visitor: "Sign in to ask follow up questions" to `/sign-in?next=/a/:id`. Signed in: "Ask a follow up" to `/a/:id#follow-up`. Shown on live, unmasked cards on the wall, the Yours strip, `/:handle` rows, and `/me` rows. Replaces the "Open thread" link in `AnswerBlock`; visitors reading a signed in ask with a thread also get "Read the thread".
- `SignIn.tsx` honors `?next=` when it is a same origin path.
- `AskPage.tsx`: the owner's thread renders read only for anyone who may read it. Under it, the viewer's own lane: the owner continues their thread as before; another signed in person sees "Your follow ups. Only you see this thread." with their side thread and a composer; a visitor sees the sign in card. `#follow-up` focuses the composer.
- `Me.tsx`: a "Follow ups" section and anchor listing side threads.
- Docs: the follow ups section describes the rule. Privacy: a data collected entry for side threads.

## Files to change

- `convex/schema.ts`, `convex/answer.ts`, `convex/messages.ts`, `convex/profile.ts`
- `src/components/FollowUp.tsx` (new), `AnswerBlock.tsx`, `AskPage.tsx`, `Wall.tsx`, `Yours.tsx`, `Profile.tsx`, `Me.tsx`, `SignIn.tsx`, `Docs.tsx`, `Legal.tsx`, `src/styles.css`
- `changelog.md`, `files.md`, `task.md`, `README.md`

## Edge cases

- Anonymous poster signs in later: they are not the owner (no `userId` on the row), so they get a side thread like anyone else. The ask stays anonymous.
- Held or hidden ask: no follow up link, `followUp` throws, `listMessages` returns empty for side threads.
- Owner whose model answer has not landed: "Wait for the first answer" as before.
- Paused account: link shows, composer disabled with the paused placeholder, mutation refuses.
- Private ask: only the owner can read it, so only the owner's own thread applies. Side threads are never created on private asks.
- Rate limit: `answer` bucket (12 a minute, capacity 6) and `answerDaily` per user, shared with own thread follow ups.
- Deleting the ask deletes side threads on it. Deleting the account deletes the account's side threads on other people's asks.
- "Read the thread" for visitors used to key off `threadId` alone, which every answered signed in ask has. The page then opened to an empty block, since the first two turns (the ask and its short answer) are shown above the thread. A `followUps` counter on the message row, bumped in the owner lane, now gates the link and the visitor's read only lane. Existing rows start at zero.

## Verification

- Visitor: wall card shows "Sign in to ask follow up questions"; the link lands on `/sign-in`, and signing in returns to `/a/:id`.
- Signed in, other person's ask: "Ask a follow up" opens `/a/:id` with the composer focused; first send creates a `threads` row, the reply streams, the row shows on `/me` under Follow ups.
- Signed in, own ask: unchanged thread; the link reads "Ask a follow up".
- Anonymous ask, signed in viewer: side thread with the verdict in context; ask "why" after a `no` and the model explains the no.
- `npm run typecheck`, `npx convex dev --once`.

## Task completion log

- 2026-09-20 01:40 UTC: PRD written.
- 2026-09-20 02:00 UTC: Built and verified on dev. Visitor wall cards carry "Sign in to ask follow up questions" with `next`; signing in from that link landed on `/a/:id#follow-up` with the composer focused. Owner lane: one thread, "Keep going. claude haiku 4.5 has the context." Side lane on another account's ask: "Your follow ups", model label, context note, focused composer; a send produced a contextual reply and a `threads` row, listed on `/me` Follow ups. `followUps` counter added after the visitor pass found an empty read only block. Both themes checked. Docs, Privacy, README, changelog, files, task updated. Typecheck and `convex dev --once` clean.
