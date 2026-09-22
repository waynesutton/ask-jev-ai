# About page: How it works plus the docs on one route

Created: 2026-09-22 08:20 UTC
Last Updated: 2026-09-22 08:30 UTC
Status: Done

## Problem

The hero nav says Docs and points at `/docs`, a reading page with a sticky contents rail. The How it works section on the home page is the short version of the same story. A visitor who wants the story and then the rules has to read the section, scroll back up, and find the Docs link. The two surfaces also do not share a shell: the section is a two column poster, the docs page is a centered reading column.

## Proposed solution

One route, `/about`, that reads as one ledger top to bottom.

1. The top row (back link, theme toggle), same as every other page.
2. The How it works section, the same component the home page renders, in an `about` variant: the heading is the page h1, the pill reads "Read the full docs" and scrolls to the docs band, the rule above the section is gone since the top row already opens the page.
3. A ruled docs band, `#docs`, laid out on the same two columns as the how grid (`minmax(240px, 3fr) 9fr`): the sticky contents rail sits under the head, the sections sit under the cards. Head of the band: mono label "Docs", heading "How it works, in full.", last updated, the lede.

The home page keeps its How it works section. Its pill goes to `/about#docs`. The hero nav and colophon say About and go to `/about`. `/docs` still resolves and moves the address to `/about#docs` so old links land on the long version.

## Files to change

- `src/components/Docs.tsx` renamed to `src/components/About.tsx`. Exports `About`. Reads `stats.gate` for the how section, renders the shell, `HowItWorks variant="about"`, then the docs band. Copy: "This page is the long version of How it works" becomes "the section above".
- `src/components/HowItWorks.tsx`. New optional `variant` prop. `about` renders h1 and h2 titles, a plain `#docs` pill, and `how--page`. `home` (default) renders h2 and h3 and a `Link` to `/about#docs`.
- `src/lib/router.ts`. Route `docs` becomes `about`; `/about` and `/docs` both parse to it.
- `src/App.tsx`. Lazy `About`, route name, nav and colophon links.
- `src/styles.css`. `.how--page`, `.about__docs`, `.docs__layout` on the how grid columns, docs breakpoint moved from 900 to 1100 so the rail stacks when the how head does. `#docs` scroll margin.
- `README.md`, `files.md`, `changelog.md`, `task.md`.

## Edge cases

- Hash on a client side push. `onLinkClick` scrolls to top after `navigate`, so `About` scrolls to `location.hash` on mount, after the lazy chunk renders.
- Heading order. Home: h2 head, h3 step titles. About: h1 head, h2 step titles, h2 docs head, h3 section titles. No level is skipped on either page.
- `RESERVED_HANDLES` already holds `about` and `docs`, so no handle can shadow either address.
- The 800px `.section` padding rule runs after `.how--page`; both set 48 on top, so the override only matters above 800.

## Verification

- `npm run typecheck` clean.
- Dev server: `/about` renders the how section then the docs band, sticky rail on desktop, stacked at 1024 and 375, both skins.
- `/docs` lands on `/about#docs` with the docs head at the top of the viewport.
- Home pill "Read the docs" lands on the docs band. Hero nav About lands at the top of `/about`.
- No horizontal overflow at 375.

## Task completion log

- 2026-09-22 08:20 UTC PRD written, work started.
- 2026-09-22 08:30 UTC Built and verified on dev. `/docs` rewrites to `/about#docs` and lands with the band head 32px from the top; the home pill lands the same way through the client side push; heading order h1, h2, h2, h3; 1440 columns aligned; 375 rail wraps as a row with `scrollWidth` 375. Typecheck clean. Not deployed.
