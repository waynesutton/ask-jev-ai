# Security review and the two fixes it produced

Created: 2026-09-19 18:20 UTC
Last Updated: 2026-09-19 18:40 UTC
Status: Done

## Problem

A security pass over the whole app (source review plus unauthenticated probes of the dev and prod function APIs) found the public surface gated and projected correctly, with one medium and one low finding worth closing in code.

Medium. The admin account can be claimed by whoever signs up first. `users.createUser` refuses any username other than `ADMIN_USERNAME`, but nothing stops a stranger who guesses that email from registering it first with their own password. There is no email verification and no sign up secret. Prod had not created its account yet when the review ran, so the window was open there.

Low. `messages.send` accepts any session string of 8 to 64 characters. The real client sends a 36 character UUID, so guessing is not realistic, but a tampered client could pick a short predictable id and make its own posts readable by anyone who guesses it through `messages.mine`.

## Root cause

Sign up was gated on the username only. That is an allowlist of one, which works after the account exists (the username component refuses duplicates) but says nothing about who gets to be first. The session floor was set low enough to admit ids far weaker than the ones the client mints.

## Proposed solution

Two server side changes and one client nudge.

1. `convex/users.ts`. Sign up requires `ADMIN_SIGNUP_OPEN=1` on the deployment, and refuses once any `users` row exists. The operator opens the window, creates the account, and closes it. After that the table holds one row and nothing can add a second, even if `ADMIN_USERNAME` changes later.
2. `convex/admin.ts`. `me` returns `signupOpen` so the sign in form only offers "Create the admin account" while the window is open, and says how to open it otherwise.
3. `convex/messages.ts`. `send` requires 32 to 64 characters for `sessionId`. `src/lib/session.ts` regenerates any stored id shorter than that so a stale value never trips the check.

## Files to change

- `convex/users.ts`
- `convex/admin.ts`
- `convex/messages.ts`
- `src/lib/session.ts`
- `src/components/Admin.tsx`

## Edge cases

- Dev already has its admin row. The one row guard closes sign up there with no action needed.
- Prod has no row yet. The operator must set `ADMIN_SIGNUP_OPEN` before creating the account, then remove it. Steps are in `task.md`.
- If `ADMIN_USERNAME` changes after the row exists, the old account loses access (`requireAdmin` reads the env on every call) and nobody can create a new one without deleting the old row first. That is the intended shape: one account, ever.
- Existing browsers hold a UUID (36 chars) so the new floor changes nothing for them.

## Verification

Review findings, all confirmed by probe against both deployments:

- `admin.list`, `admin.search`, `admin.setHidden` throw `Not signed in` unauthenticated, including `setHidden` on a real dev id.
- `messages.retry` with a wrong session returns the generic `Message not found`.
- `messages.wall` and `messages.search` return the `publicMessage` projection only, no `sessionId`.
- `judge.record`, `messages.overrideReply`, `users.createUser` are not reachable as public functions.
- `npm audit` clean. `.env.local` never committed. No secrets in tracked files.

Fixes:

- Typecheck clean for both tsconfigs.
- Prettier clean on the changed files.
- Prod: after `npm run deploy`, set the flag, sign up, remove the flag, then confirm the create account button is gone from `/admin`.

## Task completion log

- 2026-09-19 18:20 UTC Review complete. Findings above.
- 2026-09-19 18:40 UTC Fixes applied to the five files. Typecheck and prettier clean.
