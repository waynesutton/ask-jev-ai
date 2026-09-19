# Admin wall controls, IP rate limit, and the clock to one million

Created: 2026-09-17 07:50 UTC
Last Updated: 2026-09-17 08:26 UTC
Status: Done

## Problem

Three gaps before sharing the app widely.

1. There is no way to pull a message off the wall once Jev lets it through.
   Jev catches most of it, but a human needs a kill switch.
2. Spam protection is per browser session only. A script that mints a new
   session id per request walks straight past the token bucket.
3. The stats panel says how much one million will cost but not how long it
   will take. The run started at 12:31 AM PDT on Sep 17, 2026 and nothing on
   the page shows that.

## Proposed solution

### Admin at /admin

- Convex Auth v2 (alpha) with the username + password provider. The username
  is the admin email. Sign up is gated in the app's `createUser` callback:
  it throws unless the username matches the `ADMIN_USERNAME` environment
  variable on the deployment, so only one account can ever be created.
- `/admin` is a client side route inside the existing single page app.
  Static hosting already falls back to `index.html` for extensionless paths.
  Not linked from anywhere, `robots.txt` disallows it, and the page sets a
  `noindex` meta tag on mount.
- Every admin query and mutation calls `requireAdmin(ctx)`, which resolves
  the signed in user via `getAuthUserId` and compares the stored username to
  `ADMIN_USERNAME`. Auth alone is not enough; the env var is the allowlist.
- Dashboard: live counts, a paginated list of every message in every status,
  and a hide / unhide toggle per row.
- Hidden messages stay on the wall but the public query masks the text
  (same word shape, letters replaced) and drops reply, topic, harm, and
  answers. The card blurs the masked text and reads "hidden by admin".
  The masked text never reaches the browser, so blur is not the only guard.

### Rate limiting

- Convex 1.38+ exposes the caller IP in mutations via
  `ctx.meta.getRequestMetadata()`. No HTTP action detour needed.
- New limit `ip`: fixed window, 5 per minute per IP. Checked first.
- Existing session limit tightened to 5 per minute with a burst of 3.
- If the IP is null (scheduled, admin key) the IP check is skipped and the
  session limit still applies.

### Clock to one million

- `START_MS` constant, 2026-09-17T07:31:00Z, exported from
  `convex/lib/counters.ts` and returned by `stats.counts` as `startedAt`.
- Two new rows under "Tokens in": a stopwatch that ticks every second since
  the start, and "At this pace" that divides remaining by the observed rate
  and shows days left. A caption below notes the start time.

## Files to change

Backend

- `convex/convex.config.ts` add auth core, password provider, username
  component, and the two auth env vars
- `convex/auth.config.ts` new, custom JWT provider pointed at the auth
  component's JWKS
- `convex/auth.ts` new, `setupCore` and `setupUsernamePassword` exports
- `convex/users.ts` new, gated `createUser`
- `convex/lib/admin.ts` new, `requireAdmin`
- `convex/admin.ts` new, `me`, `list`, `setHidden`
- `convex/schema.ts` add `users` table and `messages.hidden`
- `convex/messages.ts` mask hidden rows in `toPublic`, IP limit in `send`
- `convex/lib/rateLimits.ts` add `ip` limit, tighten `post`
- `convex/lib/counters.ts` add `START_MS`
- `convex/stats.ts` return `startedAt`

Frontend

- `src/main.tsx` `ConvexAuthProvider` in place of `ConvexProvider`
- `src/App.tsx` route `/admin` to the admin page
- `src/components/Admin.tsx` new, sign in, sign up, dashboard
- `src/components/Wall.tsx` and `Yours.tsx` render hidden state
- `src/components/CostTracker.tsx` clock rows
- `src/lib/format.ts` duration formatters
- `src/styles.css` hidden card, admin page
- `public/robots.txt` new

## Edge cases

- Sign up with any username other than `ADMIN_USERNAME` fails with a clear
  message. Second sign up with the right username fails as taken.
- Admin signed in but `ADMIN_USERNAME` changed: every admin call throws and
  the dashboard shows "Not authorized" with a sign out button.
- Hidden message the sender still sees under "Yours": masked there too.
- Message hidden while `judging`: stays hidden when the verdict lands since
  `record` patches only verdict fields.
- Rate limit hit on IP: the composer already shows "Slow down. Try again
  in Ns" from `retryAfterMs`, so no new client path.
- Shared IPs (office, campus): 5 per minute is per IP, so a room of people
  shares one budget. Acceptable for a demo; noted here on purpose.
- Clock before any live message: "At this pace" shows "Waiting".
- Static hosting at `/` and auth at `/auth`: longest prefix wins in the
  Convex router, verified by fetching `/auth/.well-known/jwks.json`.

## Verification

- `npm run typecheck`
- `npx convex dev --once` pushes without schema or component errors
- `curl $CONVEX_SITE_URL/auth/.well-known/jwks.json` returns keys
- Visit `/admin`, create the admin account with `ADMIN_USERNAME`, hide a
  message, confirm the wall card blurs and reads "hidden by admin"
- Try sign up with another username, expect rejection
- Post 6 messages in a minute from one browser, expect "Slow down"
- Stopwatch ticks once a second; "At this pace" shows days left

## Task completion log

- 2026-09-17 07:50 UTC PRD written, research done on Auth v2 alpha.2 API
  shapes (`status: "complete" | "error"`, `provider: { name, accountId,
  profile }` in `createUser`) and `ctx.meta.getRequestMetadata()`.
- 2026-09-17 07:48 UTC Shipped and verified on the dev deployment.
  Backend: `npx convex dev --once` pushed clean with auth core, password
  provider, username, and the `users` table. Sign up with a username other
  than `ADMIN_USERNAME` rejected with "Sign up is closed"; `admin.setHidden`
  without a session throws "Not signed in". IP limit: six `send` calls in a
  minute from one IP, the sixth returned `retryAfterMs`. Frontend: `/admin`
  renders sign in, the dashboard lists every row with Hide / Unhide, a
  hidden row blurs on the wall and reads "hidden by admin", and the count
  panel shows "On the clock" ticking each second plus "At this pace".
  Typecheck and prettier clean.
- 2026-09-17 08:26 UTC Follow up: Hide / Unhide on the wall cards for the
  signed in admin (`useIsAdmin`, `Wall.tsx`), plus an `Admin` nav link.
  Verified a hide then unhide round trip in the browser.
