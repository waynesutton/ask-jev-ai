# Deploy accounts, Google and GitHub sign in, and Jev through the gateway

Created: 2026-09-22 03:25 UTC
Last Updated: 2026-09-22 03:35 UTC
Status: In Progress. Dev verified to the provider handoff. Prod not deployed.

## Problem

Prod runs the first version of the wall: visitor asks, Jev's verdict, the counter. Everything built since 2026-09-19 lives on dev only: accounts, model answers through the Convex AI Gateway, profiles, follow up threads, votes, Google and GitHub sign in, Jev itself through the gateway, and the fixed share card. Five days of work and one schema change need to land on prod in one pass without emptying the wall or locking the admin out.

This file is the order of operations. `setup-off-Google-GitHub.md` (ignored by git) covers provider consoles, credentials, and the Part E checklist it refers to.

## Where things stand

| Area               | Dev                                                                | Prod                                                                   |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Backend and schema | Current tree, pushed 2026-09-22                                    | Original schema. 22,538 live, 1,662 blocked, one admin row             |
| Env vars           | All ten                                                            | All ten, including four OAuth credentials, allowed origins, held terms |
| OAuth start        | Both buttons hand off to the provider with the dev callback, PKCE  | Not deployed                                                           |
| OAuth round trip   | Not run. Needs throwaway accounts                                  | Not run                                                                |
| Jev                | Gateway first, TypeSafe fallback. Both paths seen on rows and logs | Ships in this pass. Key stays as fallback                              |
| Static site        | Vite locally                                                       | Old build on `www.askjev.ai`, old share card copy                      |

## Have these ready

- [ ] A throwaway Google account. Never the admin's.
- [ ] A throwaway GitHub account with a verified email.
- [ ] The admin password for `/admin`.
- [ ] The Convex dashboard open on this project's team, Billing tab.
- [ ] About 45 minutes where you can watch the site. The blank wall window is under a minute but you want to see it close.
- [ ] Terminal at the repo root. `.env.local` points the CLI at dev. `--prod` targets prod in the same project. Do not run `npx convex login` unless the CLI says you are logged out.

## The plan on one screen

| Phase | What                                   | Time   | Gate to pass before the next phase                       |
| ----- | -------------------------------------- | ------ | -------------------------------------------------------- |
| 1     | Commit what is on disk                 | 3 min  | `git status --short` is empty, checks green              |
| 2     | Dev round trip with throwaways         | 10 min | Both providers create a row and return to the right page |
| 3     | Pre flight on prod                     | 3 min  | Ten env names, one user row, spending limit set          |
| 4     | `npm run deploy`                       | 3 min  | Build, schema, components, upload all report done        |
| 5     | Three migrations                       | 1 min  | Wall refills, `backfillUsers` returns `1`                |
| 6     | Smoke the live site as a visitor       | 5 min  | Verdict lands with `judgeProvider: "gateway"`, admin in  |
| 7     | Sign in and answers on prod            | 10 min | Answer streams, follow up works, throwaways deleted      |
| 8     | Watch the first hour, leak check, docs | 10 min | No steady fallback stream, clean `rg`, docs committed    |

If a gate fails, stop. Fix on dev. Do not skip forward.

## How the deploy works

`npm run deploy` runs `npx @convex-dev/static-hosting deploy`. It builds the site with the prod `VITE_CONVEX_URL`, runs `npx convex deploy` (schema, components, functions), rebuilds if the mount path moved, and uploads `dist/` to Convex storage. Never run `npx convex deploy` alone; the site would not ship and the old build would talk to the new backend.

Components installing on prod for the first time: `agent`, `oauthGoogle`, `oauthGithub`. The rest already exist there.

### Why the wall goes blank for a few seconds

The wall reads `by_visibility_and_status` with `visibility = "public"`. Rows from before accounts have no `visibility`, so the wall is empty from the moment the schema lands until `backfillVisibility` writes the field. It pages 500 rows per transaction and reschedules itself, about 49 hops for 24,200 rows. Under a minute. Counters are untouched; the odometer never moves. The composer works the whole time.

### Rollback

The deploy is atomic. If `npx convex deploy` fails, prod is unchanged. Once the migrations have written `visibility`, the old schema no longer validates the rows, so there is no clean way back. Fix forward. Every new field is optional and every new function is additive, so a redeploy of the previous build would still read the data if it ever came to that.

## Phase 1. Commit what is on disk

Uncommitted: the Jev gateway work, the `index.html` canonical and share card fix (URLs, title, description), and the docs that go with them. Ship what is in git, not what is on disk.

```sh
npm run typecheck && npm test && npm run build
git add -A
git commit -m "feat: Jev through the Convex AI Gateway, share card points at askjev.ai"
git push
```

- [ ] Typecheck, 34 tests, and build are green.
- [ ] `git status --short` prints nothing.

## Phase 2. Dev round trip with throwaways

Dev has the OAuth functions and both buttons reach the provider. Close the loop once here so prod is not the first time.

1. `npm run dev`, open `http://localhost:5199/sign-in` (or 5173).
2. Continue with Google using the throwaway. Land on `/` signed in.
   `npx convex data users --order desc --limit 1` shows the new row with `handle`, `userNumber`, `status: "active"`.
3. Sign out. Open any wall ask, tap "Sign in to ask follow up questions", Continue with Google. Land on `/a/<id>#follow-up` with the composer focused.
4. Continue with GitHub using the throwaway. New row.
5. Start Google, hit Cancel on Google's screen. The page says "You cancelled the sign in".
6. Sign in with an existing password account. Still works.
7. Delete both throwaways from `/me`.

Admin refusal (Part E step 7) needs a Google account on the admin email or a temporary `ADMIN_USERNAME` swap on dev. Either run it here or note in `task.md` that `convex/oauth.test.ts` covers it.

- [ ] Steps 2 through 6 behaved as written.
- [ ] Both throwaway rows are gone from dev.

## Phase 3. Pre flight on prod

```sh
git status --short                           # empty
npx convex env list --prod | sed 's/=.*//'   # ten names, no values
npx convex data users --prod                 # one row, the admin
```

Then in the dashboard, Billing: set a spending limit before the gateway starts taking signed in asks. AI Gateway spend counts toward it. The disable threshold pauses every project on the team, so pick the number with the whole app in mind.

- [ ] Ten env names match `setup-off-Google-GitHub.md`.
- [ ] One user row.
- [ ] Spending limit saved.

## Phase 4. Deploy

```sh
npm run deploy
```

Watch for, in order: Vite build ok, schema validated against 24,200 rows, three new components, static upload done. Takes a couple of minutes.

- [ ] All four lines appeared. No red.

## Phase 5. Migrations, immediately

```sh
npx convex run --prod migrations:backfillVisibility '{}'
npx convex run --prod migrations:backfillUsers '{}'
npx convex run --prod migrations:backfillDaily '{}'
```

`backfillVisibility` and `backfillDaily` return at once and keep going in the background. `backfillUsers` returns the number of rows touched.

```sh
npx convex logs --prod --history 200 | grep -i backfill
```

- [ ] `backfillUsers` returned `1`.
- [ ] Logs show `backfillVisibility done` and `backfillDaily done`, or the wall has refilled at `https://www.askjev.ai`.

## Phase 6. Smoke the live site as a visitor

1. `https://www.askjev.ai` loads. Wall has rows, odometer reads about 22,5xx, hero says "Jev online · Convex AI Gateway".
2. View source. `<title>` is "Ask Jev anything, for real" and `og:url` is `https://www.askjev.ai/`.
3. Post a visitor ask. The card appears live.
   `npx convex data messages --prod --order desc --limit 1` shows `judgeProvider: "gateway"` and `visibility: "public"`.
4. Callbacks are mounted. Both return `HTTP/2 400`, not `200` or `404`:

   ```sh
   curl -si https://www.askjev.ai/oauth/google/callback | head -1
   curl -si https://www.askjev.ai/oauth/github/callback | head -1
   ```

5. `/admin`: sign in with the admin password. Asks and Users tabs render, Private filter works. If sign in fails, stop and say so. The admin row exists on prod, so the sign up window will not reopen on its own and needs a one off fix.
6. Correct the two misread rows:

   ```sh
   npx convex run --prod messages:overrideReply '{"messageId":"j5731bkb3n22m7m188nvvzeqgn8ej3n8","reply":"yes"}'
   npx convex run --prod messages:overrideReply '{"messageId":"j5798c6x9x69t3kef7kndbm5z18ejkja","reply":"yes"}'
   ```

- [ ] New row says `gateway`.
- [ ] Both callbacks return 400.
- [ ] Admin is in.

## Phase 7. Sign in and answers on prod

With the throwaway Google account:

1. `/sign-in`, Continue with Google. Land on `/` signed in, avatar in the top row.
2. Ask something open, on the wall. Verdict lands, then a short answer streams under it with the model name. The row shows `answerStatus: "done"` and `answerModel`. This is the first prod answer through the gateway.
3. Ask a follow up on the ask page. The model replies in the thread.
4. `/me` shows the ask, the profile, and the account section. `/handle` renders.
5. Continue with GitHub on the second throwaway. Second row.
6. Sign out, sign back in with Google. No new row.
7. From `/admin`, pause the Google throwaway. Its composer is disabled. Restore it.
8. Delete both throwaways from `/me`. Wall asks detach and stay; the count is unchanged.

- [ ] An answer streamed and the row carries `answerModel`.
- [ ] Both throwaways deleted, count unchanged.

## Phase 8. Watch the first hour, leak check, docs

Watch:

- Dashboard, Usage, AI Gateway: spend by model. Functions, AI tab: `judge.run` and `answer.run` appear.
- `npx convex logs --prod` for `Jev gateway failed, falling back to typesafe`. A few during a gateway blip are fine and those rows say `typesafe`. A steady stream means pin TypeSafe first with `npx convex env set JEV_PROVIDER typesafe --prod`. No redeploy.
- Latency on new rows against the TypeSafe rows before them. Dev showed 217ms through the gateway against 357ms direct.

Leak check:

```sh
git status --short
git check-ignore -v setup-off-Google-GitHub.md
rg -n "GOCSPX|client_secret|CLIENT_SECRET=" --glob '!node_modules' --glob '!dist' .
rg -n --fixed-strings "$(npx convex env get ADMIN_USERNAME)" --glob '!node_modules' --glob '!dist' .
```

Expected: clean status, one `.gitignore` line, only `convex.config.ts` and the ignored handoff for the first search, nothing for the second.

Docs: move the prod items in `task.md` to completed with the UTC time, add a `### Deployed` line to `changelog.md`, commit.

- [ ] No steady fallback stream after an hour.
- [ ] Leak check clean.
- [ ] `task.md` and `changelog.md` committed.

## If it breaks

| Symptom                                  | Most likely cause                                   | Do this                                                                          |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Schema push fails naming a row and field | A prod row has a value the new validator rejects    | Nothing changed on prod. Fix the validator or the row on dev, redeploy           |
| Wall still blank after two minutes       | `backfillVisibility` stopped rescheduling           | Run it again. It is idempotent and skips rows that already have `visibility`     |
| Callback returns 200                     | Static site served the path, `http.ts` not mounted  | `npx convex deploy` did not run. Rerun `npm run deploy`, check the deploy output |
| Callback returns 404                     | Component not installed                             | Check `convex.config.ts` shipped, rerun deploy                                   |
| Google returns `redirect_uri_mismatch`   | Console lists a different callback than prod's      | Add `https://www.askjev.ai/oauth/google/callback` in the console. No redeploy    |
| Verdict row says `typesafe` on every ask | Gateway refused, fallback carried it                | Read the log line. If it is a plan or access issue, pin `JEV_PROVIDER typesafe`  |
| Verdict row says `unjudged`              | `JevUnavailableError`, no provider configured       | Confirm `TYPESAFE_API_KEY` still set on prod and the gateway plan is active      |
| Answer never streams                     | `answer.run` failed or the gateway model id changed | Functions, AI tab in the dashboard. Check the model ids in `convex/questions.ts` |
| Admin password refused                   | Password flow changed under auth v2                 | Stop. Do not create a new admin. Report it with the log line                     |

## Edge cases

- A visitor lands on the wall during the blank window. They see "Loading" for up to a minute, then rows. The composer works throughout.
- `AUTH_ALLOWED_ORIGINS` on prod lists the apex and the `.convex.site` fallback. `CONVEX_SITE_URL` (`https://www.askjev.ai`) is always allowed. A sign in started from the apex returns there and the 301 sends it to www.
- The gateway on prod uses the same team as dev, so plan and access are already proven. A `JevUnavailableError` on prod would mean the plan changed; the row publishes unjudged and the log says why.
- Auth v2 alpha leaves an inert account row when a user deletes their account. Signing back in with the same Google account may error. Known, tracked in `task.md`.
- The share card image (`public/og.png`) still shows the old hero. The text around it is current. Regenerating the image with `scripts/og-card.html` is a separate task.

## Files

No code changes in this PRD. It reads `convex/migrations.ts`, `convex/schema.ts`, `convex/convex.config.ts`, `convex/auth.ts`, `convex/lib/jev.ts`, `convex/questions.ts`, `index.html`, `package.json`, and the ignored `setup-off-Google-GitHub.md`.

## Verification

Dev, 2026-09-22 03:15 UTC:

- `npx convex function-spec` lists `auth.js:startSignInGoogle`, `startSignInGithub`, `completeSignInGoogle`, `completeSignInGithub`, and the three migrations. Prod lists only password and session functions.
- `curl -si <dev site url>/oauth/google/callback` and `.../github/callback` return `HTTP/2 400`. Prod's `/oauth/google/callback` returns `200` from the static site, as expected before deploy.
- `/sign-in` on `localhost:5199` shows Continue with Google, Continue with GitHub, "or use email", the form. Clicking Google lands on `accounts.google.com` with `redirect_uri=<dev site url>/oauth/google/callback`, `code_challenge_method=S256`, `scope=openid email profile`. Clicking GitHub lands on `github.com/login` with the dev client id and the same callback host.
- Env names on both deployments match the ten the handoff expects.
- `npm run typecheck`, `npm test` (34 tests), and the Vite build are clean.

## Completion log

- 2026-09-22 03:25 UTC Wrote this runbook after checking dev and prod state. Dev verified up to the provider handoff. Prod untouched.
- 2026-09-22 03:35 UTC Rewrote as phases with gates, a "have these ready" list, and an "if it breaks" table. Share card title and description updated in `index.html` and folded into Phase 1 and Phase 6.
