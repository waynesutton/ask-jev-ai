# Stats above the fold

Created: 2026-09-17 06:24 UTC
Last Updated: 2026-09-17 06:28 UTC
Status: Done

## Problem

The odometer and the four cost cards live in their own section under the hero. On a laptop they are a full scroll below the input. The live count is the hook of the demo and nobody sees it without scrolling.

## Proposed solution

Two column hero, like the reference. Left: headline, subline, composer card, Yours, Jev status. Right: the counter block (eyebrow, odometer, progress, percent and held back) with the four stat cards in a 2 by 2 grid under it. Hero stays vertically centered at `calc(100vh - 64px)`, so both columns sit above the fold on 1280 by 800 and up. Under 900px the grid stacks: copy and composer first, stats right after.

Counter and stat values scale down to fit a 40 percent column. The right column has no wrapping card so cards are not nested inside cards. The `#count` section goes away. The "asks so far" line under the composer becomes just the Jev status since the number is now beside it.

## Files to change

- `src/App.tsx` move `Counter` and `CostTracker` into the hero, drop the count section
- `src/styles.css` hero grid, counter and stats sizing in the hero, mobile stack
- `src/components/CostTracker.tsx` value size one step down

## Edge cases

- Yours grows under the composer. The right column is aligned to the top of the grid so the stats do not jump.
- Long stat values like `$0.000036` fit at 24px in a 2 by 2 grid down to a 460px column.
- 375px: single column, no horizontal overflow.

## Verification

- 1280 by 800: headline, input, odometer, and four stat cards all visible without scrolling.
- 375: stacks, stats right after the composer.
- Typecheck clean.

## Completion log

- 2026-09-17 06:24 UTC PRD written.
- 2026-09-17 06:28 UTC Shipped. At 1280 by 800 the counter sits at y 178 to 250 and the last stat card ends at y 550, so all of it is above the fold. At 375 the page stacks with no horizontal overflow and the stats start right after the composer. Typecheck clean.
