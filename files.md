# Files

Brief map of the codebase. Keep this current when files are added or change purpose.

## Root

- `README.md` Public repo front page. What Ask Jev is, how a message travels, the stack with links, features, local setup, env vars, scripts, layout, cost, credits.
- `package.json` Scripts and dependencies. `dev`, `dev:backend`, `build`, `typecheck`, `words:build`, `deploy`, `deploy:smoke`.
- `index.html` Vite entry. Loads Inter, applies the stored theme before paint, mounts `#root`.
- `public/og.png` Share card, 1200 x 630. Referenced by the Open Graph and X meta tags in `index.html`.
- `public/favicon.svg` Site icon source. Ember rounded square, compressed heavy J in obsidian as a filled path. To regenerate the fallbacks: `magick -background none -density 512 public/favicon.svg -resize 180x180 public/apple-touch-icon.png` and `magick -background none -density 512 public/favicon.svg -resize 48x48 \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 16x16 \) public/favicon.ico`.
- `public/favicon.ico` 48, 32, and 16 px frames for older browsers and link previews. Generated from `favicon.svg`.
- `public/apple-touch-icon.png` 180 px home screen icon for iOS. Generated from `favicon.svg`.
- `scripts/og-card.html` Source for the share card in the Caldera light skin, same tokens and fonts as the site. To regenerate: copy to `public/og-card.html`, open `http://localhost:5173/og-card.html` at 1200 x 630, screenshot, save as `public/og.png`, delete the copy.
- `vite.config.ts` React plugin. Reads `STATIC_HOSTING_BASE_PATH` for the static hosting deploy.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` TypeScript project references for the app and Vite config.
- `.env.local` Written by `npx convex dev`. Holds the local deployment URL. Not committed.
- `public/robots.txt` Disallows `/admin` for every crawler.
- `.gitignore` Ignores `node_modules`, `dist`, `.convex`, env files.

## scripts

- `scripts/buildSafeWords.mjs` Downloads the human verified word list and generates `convex/lib/safeWords.ts`.

## convex

- `convex/convex.config.ts` Installs the sharded counter, rate limiter, Convex Auth v2 (core, password provider, username), and static hosting components. Static site owns `/`, auth routes live under `/auth`, app HTTP routes under `/api`. Declares `AUTH_PRIVATE_KEY` and `AUTH_JWKS`.
- `convex/auth.config.ts` Custom JWT provider pointed at the deployment's own `/auth/.well-known/jwks.json`.
- `convex/auth.ts` `setupCore` and `setupUsernamePassword` exports: `signOut`, `refreshSession`, `isAuthenticated`, `signInWithPassword`, `signUpWithPassword`. Attaches `internal.users.createUser`.
- `convex/users.ts` `createUser` callback for auth. Throws "Sign up is closed" unless the username matches `ADMIN_USERNAME`.
- `convex/admin.ts` Admin only. `me` (signed in, is admin, configured), paginated `list` narrowed by `filter` (all, live, blocked, hidden) with reply, topic, harm, full text `search` across every status with the same filter, `setHidden`.
- `convex/lib/admin.ts` `normalizeUsername`, `adminUsername` (reads `ADMIN_USERNAME`), `requireAdmin` (resolves the auth user and compares to the env var).
- `convex/schema.ts` `users` table (`username`, `by_username`) and `messages` table with `by_status`, `by_session`, and `by_hidden` indexes, the `search_text` full text index on `text` filtered by status, plus the optional `hidden` flag. Exports the `messageStatus` validator.
- `convex/questions.ts` The six Jev questions (`reply` answers the ask: yes, no, depends, open, statement; three safety probes; mood; topic), `REPLIES`, mood and topic labels, `BLOCK_THRESHOLD`, `MAX_JUDGE_ATTEMPTS`. The one file to read to understand the policy.
- `convex/messages.ts` Public API. `send` (blocklist, allowlist, IP limit then session limit, insert, schedule judge), `retry`, `wall` (paginated live messages), `search` (full text over live asks, hidden rows dropped, up to 24), `mine` (your recent posts, any status). `toPublic` masks text and strips answers on rows the admin hid. `overrideReply` is an internal mutation for CLI backfills of a misread reply.
- `convex/judge.ts` `run` internal action calls TypeSafe with retries. `record` internal mutation applies the threshold, patches status, bumps counters.
- `convex/stats.ts` `counts` (live, blocked, submitted, goal, `startedAt`), `cost` (judged, tokens, total USD, per message, projected to goal), `gate` (is `TYPESAFE_API_KEY` set), `mood` (mean Score over recent live posts).
- `convex/lib/pricing.ts` Jev list price ($0.042 per million input tokens, output free) and `costUsd()`.
- `convex/lib/words.ts` Shared message parser, `MIN_WORDS` 3 to `MAX_WORDS` 15. Gate 1 is a profanity blocklist (`obscenity`, English dataset, catches leetspeak and spaced letters) that masks as `***`. Gate 2 is the allowlist plus five demo words (jev, jevs, convex, typesafe, demo). Used by both browser and server.
- `convex/lib/safeWords.ts` Generated. 12,530 human verified plain English tokens as a `Set`.
- `convex/lib/typesafe.ts` Typed fetch client for `POST https://api.typesafe.ai/v1/systemone`. Question and answer types.
- `convex/lib/counters.ts` `ShardedCounter` instance, keys `live`, `blocked`, `submitted`, `judged`, `inputTokens`, `outputTokens`, `GOAL`, and `START_MS` (when the run to one million began, stored as UTC).
- `convex/lib/heldTerms.ts` Server only. `isHeldTopic` reads a comma separated `HELD_TERMS` env var and matches whole words and whole phrases on word boundaries. `send` stores a match as `blocked` without calling Jev. The list is never in the repo or the browser; only terms the safe list lets through matter, since `parseMessage` rejects the rest first.
- `convex/lib/rateLimits.ts` `RateLimiter` instance. `ip`: fixed window, 5 per minute, keyed by caller IP. `post`: token bucket, 5 per minute, burst 3, keyed by session.
- `convex/tsconfig.json` TypeScript config for the Convex runtime.
- `convex/_generated/` Generated by `npx convex dev`. Do not edit.

## src

- `src/main.tsx` Creates the `ConvexReactClient` from `VITE_CONVEX_URL`, wraps `App` in `ConvexAuthProvider` (refresh and sign out from `api.auth`, no ambient sign ins).
- `src/App.tsx` Routes `/admin` to `Admin`, everything else to `Home`. Home is the page layout, no header or footer: hero with a mono top row (section anchors to the wall and how it works, an `Admin` link only for the signed in admin, "Powered by" credit, theme toggle), crop marks, centered display headline, and three columns (copy, composer with Yours, ember count panel), then wall, how it works, and a centered two line colophon (builder credit, TypeSafe AI disclaimer).
- `src/styles.css` Two skins on one structure. Light is Caldera (pumice, limestone, ember, Archivo compressed display, DM Sans 500, DM Mono labels, 40px and pill radii, flat). Dark keeps ink, charcoal, Inter, hairlines, 8px cards. Every difference is a token on `:root` or `html[data-theme="dark"]`. No Tailwind.
- `src/vite-env.d.ts` Vite client types.
- `src/lib/session.ts` Anonymous session id in `localStorage`.
- `src/lib/format.ts` Number grouping, odometer split (dim leading zeros), percent, USD with sub cent precision, time ago, `stopwatch` (`Nd hh:mm:ss`), `roughDuration` (`~Nm`, `~Nh`, `~Nd`, `~Ny Nd`).
- `src/hooks/useCountUp.ts` Eases the counter between values. Honours reduced motion.
- `src/hooks/useNow.ts` Ticking clock for relative timestamps.
- `src/hooks/useTheme.ts` Light or dark, stored in localStorage, light by default.
- `src/hooks/useIsAdmin.ts` True when the signed in session matches `ADMIN_USERNAME`. Skips the `admin.me` query for visitors. Decides what to render only; the server re-checks every admin call.
- `src/components/ThemeToggle.tsx` Mono text button with a sun or moon icon, sits in the hero's top row.
- `src/components/Counter.tsx` The big number with dim leading zeros, progress line, percent and held back stats. Renders inside the count panel, sized by container units.
- `src/components/CostTracker.tsx` Realtime Jev spend as six rows split by dotted rules inside the count panel: total, per message, projection to one million, tokens in, "On the clock" stopwatch since `startedAt`, "At this pace" time left at the observed rate. Caption names the start time.
- `src/components/Composer.tsx` Guide line with three clickable example asks, pill input, live mono word chips, ember Ask button, mono notes. Nudges toward a yes or no opener when a ready ask starts with what, who, or how. Blocked words render as `***` and disable Ask.
- `src/components/Yours.tsx` Your recent posts with status: judging, live, blocked, failed with retry. Blocked posts can reveal Jev's answers. Rows the admin hid blur and read "hidden by admin".
- `src/components/Wall.tsx` Paginated grid of live messages with a mood dot and word, topic, cost, latency, time, and a Jev answers toggle. Hidden cards get a dashed border, blurred masked text, and "hidden by admin" in place of the meta. For the signed in admin each card ends with a Hide or Unhide pill wired to `admin.setHidden`. A search pill in the intro (Phosphor magnifier, expands to an input, 200ms debounce) swaps the grid for `messages.search` results while it has a query. Cards render through the shared `WallCard`.
- `src/components/Admin.tsx` The `/admin` page. Sets `noindex` on mount. Sign in / create account form with Auth v2 error copy, "Not authorized" state for a signed in non admin, and the dashboard: counts, a segmented filter (All, Live, Held, Hidden) beside a static search pill, every matching message paginated or the search hits, Hide / Unhide per row.
- `src/components/JevAnswers.tsx` Per card toggle, open by default, with Jev's answers as a small bar chart: each row is the question, the answer word, and a horizontal band with the percent in a fixed column. Rows are "Jev says" (the reply), feel, topic, and one "Fits the wall?" row that folds the three safety probes into yes or a one line reason. A held row fills its bar in accent.
- `src/components/ScrollArrows.tsx` Two floating ghost circles fixed to the bottom right with Phosphor `ArrowUp` and `ArrowDown`. Each fades out and leaves the tab order when its end of the page is within 320px. Scrolls with the page's own `scroll-behavior`.
- `src/components/HowItWorks.tsx` Centered intro on what Jev does, then five flat fact cards. The Judge, Database, and Hosting cards link to the TypeSafe docs, convex.dev, and the static hosting component page; `Fact` renders an anchor when given `href`.

## Docs

- `prds/five-to-million.md` Original product requirements and completion log (app was named Five to Million at the time).
- `prds/a-million-jevs.md` Rename to A Million Jevs and the hard profanity block. Alternatives considered, verification, completion log.
- `prds/ask-jev.md` Rename to Ask Jev, three to fifteen words, How it works copy trimmed to what the app does. Verification and completion log.
- `prds/light-redesign.md` PRD for the light default, input in the middle, theme toggle.
- `prds/setup-domain-task.md` Custom domain setup, approved Cloudflare DNS and apex-to-www redirect, no-deploy scope, and live verification log. Gitignored, names deployments.
- `prds/jev-says.md` The sixth question. Jev answers the ask with a Choice, shown as a "Jev says" row and a card chip.
- `prds/stats-above-fold.md` Two column hero so the odometer and cost cards sit beside the input, above the fold.
- `prds/caldera-light.md` Caldera light skin, dark kept minus the wash, no header or footer, three column poster hero.
- `prds/admin-search-filter.md` Admin filter and search, and the blur only hide on the wall.
- `prds/wall-search.md` Full text search over the wall: the index, the `search` query, the pill UI, edge cases, and what was verified.
- `prds/ask-shape.md` Why four in ten prod asks got no answer, the guide above the box that fixes it, a costed plan for an either or pick in the same request, and an assessment of the three answer rows.
- `prds/admin-ratelimit-clock.md` Admin at `/admin` with Convex Auth v2 gated to one email, hidden messages masked server side, IP rate limit, and the clock to one million. Verification and completion log.
- `task.md` To do and completed work with timestamps.
- `changelog.md` Keep a Changelog format.
- `files.md` This file.
