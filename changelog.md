# Changelog

All notable changes to this project are documented here. Format follows Keep a Changelog. Dates are UTC.

## [Unreleased]

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
