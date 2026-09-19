# Terms and privacy pages

Created: 2026-09-19 18:50 UTC
Last Updated: 2026-09-19 19:13 UTC
Status: Done

## Problem

Ask Jev is a public, open source demo that stores what strangers type, sends it to a third party model, and shows it to everyone in realtime. It has no terms of service and no privacy policy. That leaves the maintainer exposed on three fronts: liability for model output and user content, liability that could bounce onto the infrastructure providers (Convex, TypeSafe) because nothing says they are not parties, and no written answer to "what do you do with my IP and my words".

The source text supplied for this work is the OpenSync policy. OpenSync has accounts, API keys, email, embeddings, exports, and private sessions. Ask Jev has none of those. Copying it would be wrong on the facts and a wrong policy is worse than none.

## Proposed solution

Two client side routes, `/terms` and `/privacy`, rendered by one shared `LegalPage` shell in `src/components/Legal.tsx`. Content is written for this app only, from the code as it exists today:

- No accounts, no email, no cookies. One anonymous UUID in `localStorage` (`ftm.session`) plus the theme key.
- The ask (three to fifteen words), the session id, and Jev's judgments are stored in Convex. IP is read on each post for a five per minute fixed window and held by the rate limiter for that window only.
- The ask text alone goes to TypeSafe. No session id, no IP.
- Every live ask is public the moment it lands. There is no self service delete; removal goes through the maintainer.
- The maintainer is Wayne Sutton (waynesutton.ai). TypeSafe AI and Convex, Inc. are third party providers, not parties to the terms, with no responsibility for the Service or its content.
- Liability cap, indemnity, waiver of legal action, California law, severability, kept from the source and pointed at this Service.

The colophon at the end of the home page gains a third mono line under "Demo app not associated with TypeSafe AI": Terms, Privacy, Source.

## Second pass: cover the accounts plan

The plan in `.cursor/plans/ask_anything_with_accounts_0d3af35d.plan.md` adds open sign up, profiles, public and private asks, model answers through the Convex AI Gateway, threads, export, account deletion, per account rate limits, a usage table, and admin moderation (hide answer, pause, block, restore, blocked emails). Every one of those changes what is collected, who sees it, and what the admin can do. The legal pages were rewritten to cover them before they ship, with a line in each saying features may arrive after the date and are covered when they do.

Terms additions: Accounts, Public and private asks, Jev's answers and model answers, Moderation and enforcement (the admin may restrict or block access at any time and in particular when abuse is believed to be happening; reason and timestamp recorded; decision final), Deleting your account. Who runs it, Your words, liability, indemnity, and third party services widened to the gateway and the model providers.

Privacy additions: collection split into everyone versus account holders, model providers as recipients, a section on what is public, what is private, and what the admin sees, retention for account data and blocked emails, self service export and delete under rights, Argon2id and ownership checks under security.

Honesty notes carried from the plan: private means not shown to the public, not encrypted or hidden from the admin. Deletion leaves an orphaned password hash in the auth alpha and keeps blocked emails. Public asks are detached, not deleted, on account deletion so the count stays honest.

## Files to change

- `src/components/Legal.tsx` (new). `Terms` and `Privacy` exports, shared `LegalPage` shell with the hero top row (back link, theme toggle), heading, last updated label, sections.
- `src/App.tsx`. Route `/terms` and `/privacy`. Colophon gains the links row.
- `src/styles.css`. `.legal` block after `.admin`, `.colophon__links`.
- `files.md`, `changelog.md`, `task.md`, `README.md` (one line under Features and Layout).

## Edge cases

- Static hosting already serves `index.html` for `/admin`, so `/terms` and `/privacy` resolve the same way. Trailing slashes are stripped before matching.
- No `LICENSE` file exists in the repo today. The terms say the code is available under the license in the repository rather than naming MIT. Adding a `LICENSE` is a separate decision for the owner.
- Document title is set on mount and restored on unmount so a back navigation to the wall shows the right title.
- Both pages must read correctly in light and dark; the shell reuses tokens only.

## Verification steps

1. `npm run typecheck` clean.
2. `npx prettier --check` on the touched files.
3. In the browser: `/terms` and `/privacy` render, back link returns to `/`, theme toggle works, colophon shows three links, no horizontal overflow at 375.

## Task completion log

- 2026-09-19 18:50 UTC PRD written.
- 2026-09-19 18:58 UTC Shipped. `src/components/Legal.tsx`, routes in `src/App.tsx`, `.legal` and `.colophon__links` in `src/styles.css`, colophon links. Typecheck and prettier clean. Verified on dev in the browser: `/terms` and `/privacy` render in light and dark with the right document titles, the colophon Terms link routes to `/terms`, no horizontal overflow. Docs synced. Open item for the owner: the repo has no `LICENSE` file, so the terms point to "the license in the repository" rather than naming one.
- 2026-09-19 19:13 UTC Second pass shipped. `src/components/Legal.tsx` rewritten to cover the accounts plan and admin moderation. Shell, routes, and styles unchanged. Typecheck and prettier clean. Verified on dev: both pages render every new section.
